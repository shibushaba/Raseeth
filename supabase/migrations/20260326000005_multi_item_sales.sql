-- Phase 3A: multi-item sales (sales header + sale_items)
-- Preserves existing single-line sales by migrating them into sale_items.

-- ---------------------------------------------------------------------------
-- sale_items
-- ---------------------------------------------------------------------------

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  -- Snapshot of the unit price used at sale time (never recalculated later)
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  price_type public.price_type NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sale_items_total_matches_line
    CHECK (total_amount = round(unit_price * quantity, 2))
);

CREATE INDEX sale_items_sale_id_idx ON public.sale_items (sale_id);
CREATE INDEX sale_items_product_id_idx ON public.sale_items (product_id);
CREATE INDEX sale_items_created_at_idx ON public.sale_items (created_at DESC);

-- Migrate legacy single-product sales rows into sale_items
INSERT INTO public.sale_items (
  sale_id,
  product_id,
  quantity,
  unit_price,
  price_type,
  total_amount,
  created_at
)
SELECT
  s.id,
  s.product_id,
  s.quantity,
  s.unit_price,
  s.price_type,
  s.total_amount,
  s.created_at
FROM public.sales s
WHERE s.product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.sale_items si WHERE si.sale_id = s.id
  );

-- Drop legacy line-item columns from sales header
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_total_matches_line;
DROP INDEX IF EXISTS public.sales_product_id_idx;

ALTER TABLE public.sales
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS unit_price,
  DROP COLUMN IF EXISTS price_type;

-- sales.total_amount remains the header total (sum of line items)

-- ---------------------------------------------------------------------------
-- RLS for sale_items
-- ---------------------------------------------------------------------------

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read sale items"
  ON public.sale_items
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- No client INSERT/UPDATE/DELETE — create_sale RPC only.

-- ---------------------------------------------------------------------------
-- Replace single-item create_sale with multi-item JSONB RPC
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_sale(UUID, INTEGER, NUMERIC, public.price_type);

CREATE OR REPLACE FUNCTION public.create_sale(p_items JSONB)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales;
  v_item JSONB;
  v_product public.products;
  v_product_id UUID;
  v_quantity INTEGER;
  v_price_type public.price_type;
  v_unit_price NUMERIC(12, 2);
  v_line_total NUMERIC(12, 2);
  v_sale_total NUMERIC(12, 2) := 0;
  v_idx INTEGER := 0;
BEGIN
  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can create sales';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sale cart cannot be empty';
  END IF;

  -- Reject duplicate product lines (frontend merges; backend enforces)
  IF (
    SELECT COUNT(*) FROM jsonb_array_elements(p_items)
  ) <> (
    SELECT COUNT(DISTINCT value ->> 'product_id') FROM jsonb_array_elements(p_items) AS t(value)
  ) THEN
    RAISE EXCEPTION 'Duplicate products in cart';
  END IF;

  -- Pass 1: validate every line and lock products (deterministic order by product_id)
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
    ORDER BY (value ->> 'product_id')
  LOOP
    v_idx := v_idx + 1;

    BEGIN
      v_product_id := (v_item ->> 'product_id')::UUID;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid product on cart line %', v_idx;
    END;

    v_quantity := COALESCE((v_item ->> 'quantity')::INTEGER, 0);
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Sale quantity must be positive';
    END IF;

    BEGIN
      v_price_type := (v_item ->> 'price_type')::public.price_type;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid price type on cart line %', v_idx;
    END;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    IF v_product.current_quantity < v_quantity THEN
      RAISE EXCEPTION
        'INSUFFICIENT_STOCK|%|%|%',
        v_product.name,
        v_product.current_quantity,
        v_quantity;
    END IF;

    -- Server-authoritative price for RETAIL / WHOLESALE
    IF v_price_type = 'RETAIL' THEN
      v_unit_price := v_product.retail_price;
    ELSIF v_price_type = 'WHOLESALE' THEN
      v_unit_price := v_product.wholesale_price;
    ELSE
      BEGIN
        v_unit_price := round(COALESCE((v_item ->> 'unit_price')::NUMERIC, -1), 2);
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Invalid custom unit price';
      END;
      IF v_unit_price < 0 THEN
        RAISE EXCEPTION 'Unit price cannot be negative';
      END IF;
    END IF;

    v_sale_total := v_sale_total + round(v_unit_price * v_quantity, 2);
  END LOOP;

  -- Create sale header
  INSERT INTO public.sales (total_amount, created_by)
  VALUES (round(v_sale_total, 2), auth.uid())
  RETURNING * INTO v_sale;

  -- Pass 2: write items + movements + decrement stock
  -- Re-lock and re-read prices consistently with pass 1
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
    ORDER BY (value ->> 'product_id')
  LOOP
    v_product_id := (v_item ->> 'product_id')::UUID;
    v_quantity := (v_item ->> 'quantity')::INTEGER;
    v_price_type := (v_item ->> 'price_type')::public.price_type;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF v_price_type = 'RETAIL' THEN
      v_unit_price := v_product.retail_price;
    ELSIF v_price_type = 'WHOLESALE' THEN
      v_unit_price := v_product.wholesale_price;
    ELSE
      v_unit_price := round((v_item ->> 'unit_price')::NUMERIC, 2);
    END IF;

    -- Re-check stock (another concurrent sale may have raced between passes;
    -- same transaction locks make this safe, but keep the guard)
    IF v_product.current_quantity < v_quantity THEN
      RAISE EXCEPTION
        'INSUFFICIENT_STOCK|%|%|%',
        v_product.name,
        v_product.current_quantity,
        v_quantity;
    END IF;

    v_line_total := round(v_unit_price * v_quantity, 2);

    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      price_type,
      total_amount
    )
    VALUES (
      v_sale.id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_price_type,
      v_line_total
    );

    INSERT INTO public.inventory_movements (
      product_id,
      movement_type,
      quantity,
      unit_cost,
      reference_id,
      notes,
      created_by
    )
    VALUES (
      v_product_id,
      'SALE',
      -v_quantity,
      v_unit_price,
      v_sale.id,
      'Sale ' || v_sale.sale_number,
      auth.uid()
    );

    UPDATE public.products
    SET current_quantity = current_quantity - v_quantity
    WHERE id = v_product_id;
  END LOOP;

  RETURN v_sale;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale(JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_sale(JSONB) IS
  'Atomic multi-item sale: validates stock, creates sale + sale_items + SALE movements, decrements stock.';

-- ---------------------------------------------------------------------------
-- Update seed helper for sale_items shape
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_demo_catalog()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salesman_id UUID;
  v_owner_id UUID;
  v_cola UUID;
  v_shirt UUID;
  v_rice UUID;
  v_sale_id UUID;
BEGIN
  SELECT id INTO v_salesman_id
  FROM public.profiles
  WHERE role = 'SALESMAN'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE role = 'OWNER'
  ORDER BY created_at
  LIMIT 1;

  IF v_salesman_id IS NULL THEN
    RAISE NOTICE 'No SALESMAN profile found — create demo auth users and set roles first.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.products LIMIT 1) THEN
    RAISE NOTICE 'Products already present — skipping catalog seed.';
    RETURN;
  END IF;

  PERFORM setval('public.product_code_seq', 1, false);
  PERFORM setval('public.sale_number_seq', 1, false);

  INSERT INTO public.products (
    name, description, category,
    purchase_price, retail_price, wholesale_price,
    current_quantity, created_by
  )
  VALUES (
    'Coca Cola 500ml', 'Chilled soft drink', 'Beverages',
    35.00, 50.00, 44.00, 0, v_salesman_id
  )
  RETURNING id INTO v_cola;

  INSERT INTO public.products (
    name, description, category,
    purchase_price, retail_price, wholesale_price,
    current_quantity, created_by
  )
  VALUES (
    'Blue Cotton Shirt', 'Medium, casual fit', 'Apparel',
    280.00, 499.00, 420.00, 0, v_salesman_id
  )
  RETURNING id INTO v_shirt;

  INSERT INTO public.products (
    name, description, category,
    purchase_price, retail_price, wholesale_price,
    current_quantity, created_by
  )
  VALUES (
    'Basmati Rice 1kg', 'Premium grain', 'Grocery',
    90.00, 120.00, 108.00, 0, v_salesman_id
  )
  RETURNING id INTO v_rice;

  INSERT INTO public.inventory_movements
    (product_id, movement_type, quantity, unit_cost, notes, created_by)
  VALUES
    (v_cola, 'PURCHASE', 100, 35.00, 'Initial stock', v_salesman_id),
    (v_shirt, 'PURCHASE', 20, 280.00, 'Initial stock', v_salesman_id),
    (v_rice, 'PURCHASE', 50, 90.00, 'Initial stock', v_salesman_id);

  UPDATE public.products SET current_quantity = 100 WHERE id = v_cola;
  UPDATE public.products SET current_quantity = 20 WHERE id = v_shirt;
  UPDATE public.products SET current_quantity = 50 WHERE id = v_rice;

  INSERT INTO public.sales (total_amount, created_by)
  VALUES (600.00, v_salesman_id)
  RETURNING id INTO v_sale_id;

  INSERT INTO public.sale_items (
    sale_id, product_id, quantity, unit_price, price_type, total_amount
  )
  VALUES (v_sale_id, v_cola, 12, 50.00, 'RETAIL', 600.00);

  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity, unit_cost, reference_id, notes, created_by
  )
  VALUES (
    v_cola, 'SALE', -12, 50.00, v_sale_id, 'Demo sale', v_salesman_id
  );

  UPDATE public.products SET current_quantity = 88 WHERE id = v_cola;

  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity, notes, created_by
  )
  VALUES (v_shirt, 'ADJUSTMENT', -3, 'Damaged', v_salesman_id);

  UPDATE public.products SET current_quantity = 17 WHERE id = v_shirt;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.messages (sender_id, receiver_id, message, is_read)
    VALUES
      (
        v_owner_id,
        v_salesman_id,
        'Please check the stock of the blue shirts.',
        false
      ),
      (
        v_salesman_id,
        v_owner_id,
        'Checked. 14 units remaining after damage write-off — currently 17.',
        false
      );
  END IF;

  RAISE NOTICE 'Demo catalog seeded successfully.';
END;
$$;
