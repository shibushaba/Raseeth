-- Phase 10B: Weighted Average Cost (WAC) foundation
-- Rounding rule: all monetary values use NUMERIC(12,2) and PostgreSQL round(x, 2)
-- (round half away from zero). WAC is computed in NUMERIC then rounded to 2 decimals
-- before storage. Do not use IEEE floats.

-- ---------------------------------------------------------------------------
-- Schema: product running WAC + optional historical snapshots on lines
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS avg_unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (avg_unit_cost >= 0);

COMMENT ON COLUMN public.products.purchase_price IS
  'Latest purchase/receipt unit price (overwritten on each add_stock).';
COMMENT ON COLUMN public.products.avg_unit_cost IS
  'Current weighted-average inventory cost (WAC). Not erased at zero stock.';

-- Seed current WAC from latest purchase price for existing products (product state only).
-- Does NOT backfill sale_items / return_items (those stay NULL = cost unavailable).
UPDATE public.products
SET avg_unit_cost = purchase_price
WHERE avg_unit_cost = 0 AND purchase_price > 0;

-- avg_unit_cost is RPC-controlled; do not grant client UPDATE on it
-- (existing column grant list intentionally omits avg_unit_cost)

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2)
    CHECK (unit_cost IS NULL OR unit_cost >= 0);

COMMENT ON COLUMN public.sale_items.unit_price IS
  'Selling unit price snapshot at sale time.';
COMMENT ON COLUMN public.sale_items.unit_cost IS
  'Inventory cost (WAC) snapshot at sale time. NULL = legacy / cost unavailable.';

ALTER TABLE public.return_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2)
    CHECK (unit_cost IS NULL OR unit_cost >= 0);

COMMENT ON COLUMN public.return_items.unit_price IS
  'Original selling unit price from the sale item.';
COMMENT ON COLUMN public.return_items.unit_cost IS
  'Inventory cost copied from sale_items.unit_cost. NULL = legacy / cost unavailable.';

-- ---------------------------------------------------------------------------
-- create_product — set avg_unit_cost with initial stock
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_product(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_purchase_price NUMERIC DEFAULT 0,
  p_retail_price NUMERIC DEFAULT 0,
  p_wholesale_price NUMERIC DEFAULT 0,
  p_initial_quantity INTEGER DEFAULT 0
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products;
  v_cost NUMERIC(12, 2);
BEGIN
  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can create products';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;

  IF p_purchase_price < 0 OR p_retail_price < 0 OR p_wholesale_price < 0 THEN
    RAISE EXCEPTION 'Prices cannot be negative';
  END IF;

  IF p_initial_quantity < 0 THEN
    RAISE EXCEPTION 'Initial quantity cannot be negative';
  END IF;

  v_cost := round(p_purchase_price, 2);

  INSERT INTO public.products (
    name,
    description,
    category,
    purchase_price,
    avg_unit_cost,
    retail_price,
    wholesale_price,
    current_quantity,
    created_by
  )
  VALUES (
    trim(p_name),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    NULLIF(trim(COALESCE(p_category, '')), ''),
    v_cost,
    v_cost,
    round(p_retail_price, 2),
    round(p_wholesale_price, 2),
    0,
    auth.uid()
  )
  RETURNING * INTO v_product;

  IF p_initial_quantity > 0 THEN
    INSERT INTO public.inventory_movements (
      product_id,
      movement_type,
      quantity,
      unit_cost,
      notes,
      created_by
    )
    VALUES (
      v_product.id,
      'PURCHASE',
      p_initial_quantity,
      v_cost,
      'Initial stock on product creation',
      auth.uid()
    );

    UPDATE public.products
    SET
      current_quantity = p_initial_quantity,
      avg_unit_cost = v_cost,
      purchase_price = v_cost
    WHERE id = v_product.id
    RETURNING * INTO v_product;
  END IF;

  RETURN v_product;
END;
$$;

-- ---------------------------------------------------------------------------
-- add_stock — update WAC atomically
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_stock(
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_cost NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.inventory_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products;
  v_movement public.inventory_movements;
  v_receipt NUMERIC(12, 2);
  v_new_avg NUMERIC(12, 2);
  v_qty INTEGER;
BEGIN
  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can add stock';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Stock quantity must be positive';
  END IF;

  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
    RAISE EXCEPTION 'Unit cost cannot be negative';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_receipt := round(p_unit_cost, 2);
  v_qty := v_product.current_quantity;

  IF v_qty = 0 THEN
    v_new_avg := v_receipt;
  ELSE
    v_new_avg := round(
      (
        (v_qty::NUMERIC * v_product.avg_unit_cost)
        + (p_quantity::NUMERIC * v_receipt)
      ) / (v_qty + p_quantity)::NUMERIC,
      2
    );
  END IF;

  INSERT INTO public.inventory_movements (
    product_id,
    movement_type,
    quantity,
    unit_cost,
    notes,
    created_by
  )
  VALUES (
    p_product_id,
    'PURCHASE',
    p_quantity,
    v_receipt,
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING * INTO v_movement;

  UPDATE public.products
  SET
    current_quantity = current_quantity + p_quantity,
    purchase_price = v_receipt,
    avg_unit_cost = v_new_avg
  WHERE id = p_product_id;

  RETURN v_movement;
END;
$$;

-- ---------------------------------------------------------------------------
-- create_sale — snapshot WAC into sale_items.unit_cost
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_sale(
  p_items JSONB,
  p_payments JSONB
)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales;
  v_item JSONB;
  v_pay JSONB;
  v_product public.products;
  v_product_id UUID;
  v_quantity INTEGER;
  v_price_type public.price_type;
  v_unit_price NUMERIC(12, 2);
  v_unit_cost NUMERIC(12, 2);
  v_line_total NUMERIC(12, 2);
  v_sale_total NUMERIC(12, 2) := 0;
  v_pay_total NUMERIC(12, 2) := 0;
  v_pay_amount NUMERIC(12, 2);
  v_pay_method public.payment_method;
  v_idx INTEGER := 0;
BEGIN
  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can create sales';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sale cart cannot be empty';
  END IF;

  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  IF (
    SELECT COUNT(*) FROM jsonb_array_elements(p_items)
  ) <> (
    SELECT COUNT(DISTINCT value ->> 'product_id') FROM jsonb_array_elements(p_items) AS t(value)
  ) THEN
    RAISE EXCEPTION 'Duplicate products in cart';
  END IF;

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
      IF v_unit_price <= 0 THEN
        RAISE EXCEPTION 'Custom unit price must be greater than zero';
      END IF;
    END IF;

    v_sale_total := v_sale_total + round(v_unit_price * v_quantity, 2);
  END LOOP;

  v_idx := 0;
  FOR v_pay IN SELECT value FROM jsonb_array_elements(p_payments) AS t(value)
  LOOP
    v_idx := v_idx + 1;

    BEGIN
      v_pay_method := (v_pay ->> 'method')::public.payment_method;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid payment method on payment line %', v_idx;
    END;

    BEGIN
      v_pay_amount := round(COALESCE((v_pay ->> 'amount')::NUMERIC, 0), 2);
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid payment amount on payment line %', v_idx;
    END;

    IF v_pay_amount <= 0 THEN
      RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    v_pay_total := v_pay_total + v_pay_amount;
  END LOOP;

  IF v_pay_total < v_sale_total THEN
    RAISE EXCEPTION 'PAYMENT_UNDER|%|%', v_pay_total, v_sale_total;
  END IF;

  IF v_pay_total > v_sale_total THEN
    RAISE EXCEPTION 'PAYMENT_OVER|%|%', v_pay_total, v_sale_total;
  END IF;

  INSERT INTO public.sales (total_amount, created_by)
  VALUES (round(v_sale_total, 2), auth.uid())
  RETURNING * INTO v_sale;

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
      IF v_unit_price <= 0 THEN
        RAISE EXCEPTION 'Custom unit price must be greater than zero';
      END IF;
    END IF;

    IF v_product.current_quantity < v_quantity THEN
      RAISE EXCEPTION
        'INSUFFICIENT_STOCK|%|%|%',
        v_product.name,
        v_product.current_quantity,
        v_quantity;
    END IF;

    -- Authoritative COGS snapshot (WAC). Movement.unit_cost remains selling price
    -- for backward compatibility; do not use it for profitability.
    v_unit_cost := round(v_product.avg_unit_cost, 2);
    v_line_total := round(v_unit_price * v_quantity, 2);

    INSERT INTO public.sale_items (
      sale_id, product_id, quantity, unit_price, unit_cost, price_type, total_amount
    )
    VALUES (
      v_sale.id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_unit_cost,
      v_price_type,
      v_line_total
    );

    INSERT INTO public.inventory_movements (
      product_id, movement_type, quantity, unit_cost, reference_id, notes, created_by
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

  FOR v_pay IN SELECT value FROM jsonb_array_elements(p_payments) AS t(value)
  LOOP
    v_pay_method := (v_pay ->> 'method')::public.payment_method;
    v_pay_amount := round((v_pay ->> 'amount')::NUMERIC, 2);

    INSERT INTO public.payments (sale_id, payment_method, amount)
    VALUES (v_sale.id, v_pay_method, v_pay_amount);
  END LOOP;

  RETURN v_sale;
END;
$$;

COMMENT ON FUNCTION public.create_sale(JSONB, JSONB) IS
  'Atomic multi-item sale with payments; snapshots WAC into sale_items.unit_cost.';

-- ---------------------------------------------------------------------------
-- create_return — copy sale_items.unit_cost onto return_items
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_return(
  p_items JSONB,
  p_refund_method public.payment_method
)
RETURNS public.returns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_return public.returns;
  v_item JSONB;
  v_sale_item public.sale_items;
  v_sale public.sales;
  v_product public.products;
  v_sale_id UUID;
  v_sale_item_id UUID;
  v_quantity INTEGER;
  v_already INTEGER;
  v_remaining INTEGER;
  v_unit_price NUMERIC(12, 2);
  v_unit_cost NUMERIC(12, 2);
  v_line_total NUMERIC(12, 2);
  v_return_total NUMERIC(12, 2) := 0;
  v_idx INTEGER := 0;
  v_payment_id UUID;
BEGIN
  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can create returns';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Return must include at least one item';
  END IF;

  IF p_refund_method IS NULL THEN
    RAISE EXCEPTION 'Invalid refund method';
  END IF;

  IF (
    SELECT COUNT(*) FROM jsonb_array_elements(p_items)
  ) <> (
    SELECT COUNT(DISTINCT value ->> 'sale_item_id') FROM jsonb_array_elements(p_items) AS t(value)
  ) THEN
    RAISE EXCEPTION 'Duplicate sale items in return';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
    ORDER BY (value ->> 'sale_item_id')
  LOOP
    v_idx := v_idx + 1;

    BEGIN
      v_sale_item_id := (v_item ->> 'sale_item_id')::UUID;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid sale item on return line %', v_idx;
    END;

    v_quantity := COALESCE((v_item ->> 'quantity')::INTEGER, 0);
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Return quantity must be positive';
    END IF;

    SELECT * INTO v_sale_item
    FROM public.sale_items
    WHERE id = v_sale_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sale item not found';
    END IF;

    IF v_sale_item.unit_cost IS NULL THEN
      RAISE EXCEPTION 'COST_UNAVAILABLE|Sale item has no inventory cost snapshot';
    END IF;

    IF v_sale_id IS NULL THEN
      v_sale_id := v_sale_item.sale_id;
      SELECT * INTO v_sale
      FROM public.sales
      WHERE id = v_sale_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale not found';
      END IF;
    ELSIF v_sale_item.sale_id <> v_sale_id THEN
      RAISE EXCEPTION 'All return items must belong to the same sale';
    END IF;

    SELECT COALESCE(SUM(ri.quantity), 0)::INTEGER INTO v_already
    FROM public.return_items ri
    WHERE ri.sale_item_id = v_sale_item.id;

    v_remaining := v_sale_item.quantity - v_already;
    IF v_quantity > v_remaining THEN
      RAISE EXCEPTION 'RETURN_EXCESS|%|%', v_remaining, v_quantity;
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_sale_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    v_unit_price := v_sale_item.unit_price;
    v_return_total := v_return_total + round(v_unit_price * v_quantity, 2);
  END LOOP;

  IF v_return_total <= 0 THEN
    RAISE EXCEPTION 'Return total must be greater than zero';
  END IF;

  INSERT INTO public.returns (sale_id, total_amount, created_by)
  VALUES (v_sale_id, round(v_return_total, 2), auth.uid())
  RETURNING * INTO v_return;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
    ORDER BY (value ->> 'sale_item_id')
  LOOP
    v_sale_item_id := (v_item ->> 'sale_item_id')::UUID;
    v_quantity := (v_item ->> 'quantity')::INTEGER;

    SELECT * INTO v_sale_item
    FROM public.sale_items
    WHERE id = v_sale_item_id
    FOR UPDATE;

    SELECT COALESCE(SUM(ri.quantity), 0)::INTEGER INTO v_already
    FROM public.return_items ri
    WHERE ri.sale_item_id = v_sale_item.id;

    v_remaining := v_sale_item.quantity - v_already;
    IF v_quantity > v_remaining THEN
      RAISE EXCEPTION 'RETURN_EXCESS|%|%', v_remaining, v_quantity;
    END IF;

    IF v_sale_item.unit_cost IS NULL THEN
      RAISE EXCEPTION 'COST_UNAVAILABLE|Sale item has no inventory cost snapshot';
    END IF;

    v_unit_price := v_sale_item.unit_price;
    v_unit_cost := round(v_sale_item.unit_cost, 2);
    v_line_total := round(v_unit_price * v_quantity, 2);

    INSERT INTO public.return_items (
      return_id, sale_item_id, product_id, quantity, unit_price, unit_cost, total_amount
    )
    VALUES (
      v_return.id,
      v_sale_item.id,
      v_sale_item.product_id,
      v_quantity,
      v_unit_price,
      v_unit_cost,
      v_line_total
    );

    INSERT INTO public.inventory_movements (
      product_id, movement_type, quantity, unit_cost, reference_id, notes, created_by
    )
    VALUES (
      v_sale_item.product_id,
      'RETURN',
      v_quantity,
      v_unit_price,
      v_return.id,
      'Return ' || v_return.return_number || ' / ' || v_sale.sale_number,
      auth.uid()
    );

    UPDATE public.products
    SET current_quantity = current_quantity + v_quantity
    WHERE id = v_sale_item.product_id;
  END LOOP;

  SELECT p.id INTO v_payment_id
  FROM public.payments p
  WHERE p.sale_id = v_sale_id
    AND p.payment_method = p_refund_method
  ORDER BY p.created_at
  LIMIT 1;

  INSERT INTO public.refunds (
    return_id, payment_id, refund_method, amount, created_by
  )
  VALUES (
    v_return.id,
    v_payment_id,
    p_refund_method,
    round(v_return_total, 2),
    auth.uid()
  );

  RETURN v_return;
END;
$$;

COMMENT ON FUNCTION public.create_return(JSONB, public.payment_method) IS
  'Atomic return with refund; copies sale_items.unit_cost onto return_items.';
