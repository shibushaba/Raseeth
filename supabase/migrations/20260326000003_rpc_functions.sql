-- Atomic business operations.
-- Sales and stock changes must never be split across separate client requests.

-- ---------------------------------------------------------------------------
-- create_product
-- Creates product; if initial_quantity > 0, writes PURCHASE movement and sets qty.
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

  INSERT INTO public.products (
    name,
    description,
    category,
    purchase_price,
    retail_price,
    wholesale_price,
    current_quantity,
    created_by
  )
  VALUES (
    trim(p_name),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    NULLIF(trim(COALESCE(p_category, '')), ''),
    round(p_purchase_price, 2),
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
      round(p_purchase_price, 2),
      'Initial stock on product creation',
      auth.uid()
    );

    UPDATE public.products
    SET current_quantity = p_initial_quantity
    WHERE id = v_product.id
    RETURNING * INTO v_product;
  END IF;

  RETURN v_product;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product(
  TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_product(
  TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER
) TO authenticated;

-- ---------------------------------------------------------------------------
-- create_sale
-- Validates stock, inserts sale, inserts SALE movement, decrements quantity.
-- All steps succeed or the whole transaction rolls back.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_sale(
  p_product_id UUID,
  p_quantity INTEGER,
  p_unit_price NUMERIC,
  p_price_type public.price_type
)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products;
  v_sale public.sales;
  v_total NUMERIC(12, 2);
BEGIN
  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can create sales';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Sale quantity must be positive';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'Unit price cannot be negative';
  END IF;

  -- Lock product row for the duration of this transaction
  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product.current_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory: available %, requested %',
      v_product.current_quantity, p_quantity;
  END IF;

  v_total := round(p_unit_price * p_quantity, 2);

  INSERT INTO public.sales (
    product_id,
    quantity,
    unit_price,
    price_type,
    total_amount,
    created_by
  )
  VALUES (
    p_product_id,
    p_quantity,
    round(p_unit_price, 2),
    p_price_type,
    v_total,
    auth.uid()
  )
  RETURNING * INTO v_sale;

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
    p_product_id,
    'SALE',
    -p_quantity,
    round(p_unit_price, 2),
    v_sale.id,
    'Sale ' || v_sale.sale_number,
    auth.uid()
  );

  UPDATE public.products
  SET current_quantity = current_quantity - p_quantity
  WHERE id = p_product_id;

  RETURN v_sale;
END;
$$;

REVOKE ALL ON FUNCTION public.create_sale(
  UUID, INTEGER, NUMERIC, public.price_type
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale(
  UUID, INTEGER, NUMERIC, public.price_type
) TO authenticated;

-- ---------------------------------------------------------------------------
-- add_stock
-- Records PURCHASE movement, increases quantity, updates latest purchase_price.
-- Historical movement unit_cost remains the cost at time of receipt.
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
  v_movement public.inventory_movements;
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

  IF NOT EXISTS (
    SELECT 1 FROM public.products WHERE id = p_product_id FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Product not found';
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
    round(p_unit_cost, 2),
    NULLIF(trim(COALESCE(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING * INTO v_movement;

  UPDATE public.products
  SET
    current_quantity = current_quantity + p_quantity,
    purchase_price = round(p_unit_cost, 2)
  WHERE id = p_product_id;

  RETURN v_movement;
END;
$$;

REVOKE ALL ON FUNCTION public.add_stock(
  UUID, INTEGER, NUMERIC, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_stock(
  UUID, INTEGER, NUMERIC, TEXT
) TO authenticated;

-- ---------------------------------------------------------------------------
-- adjust_stock (optional controlled adjustment with reason)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id UUID,
  p_quantity INTEGER,
  p_reason TEXT
)
RETURNS public.inventory_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products;
  v_movement public.inventory_movements;
BEGIN
  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can adjust stock';
  END IF;

  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity cannot be zero';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Adjustment reason is required';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product.current_quantity + p_quantity < 0 THEN
    RAISE EXCEPTION 'Adjustment would result in negative inventory';
  END IF;

  INSERT INTO public.inventory_movements (
    product_id,
    movement_type,
    quantity,
    notes,
    created_by
  )
  VALUES (
    p_product_id,
    'ADJUSTMENT',
    p_quantity,
    trim(p_reason),
    auth.uid()
  )
  RETURNING * INTO v_movement;

  UPDATE public.products
  SET current_quantity = current_quantity + p_quantity
  WHERE id = p_product_id;

  RETURN v_movement;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_stock(
  UUID, INTEGER, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_stock(
  UUID, INTEGER, TEXT
) TO authenticated;
