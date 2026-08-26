-- Phase 8: payment recording (CASH / UPI / CARD), atomic with create_sale

CREATE TYPE public.payment_method AS ENUM ('CASH', 'UPI', 'CARD');

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales (id) ON DELETE RESTRICT,
  payment_method public.payment_method NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_sale_id_idx ON public.payments (sale_id);
CREATE INDEX payments_created_at_idx ON public.payments (created_at DESC);
CREATE INDEX payments_method_idx ON public.payments (payment_method);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- No client INSERT/UPDATE/DELETE — payments only via create_sale RPC.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.payments FROM authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;

-- Replace create_sale(items) with create_sale(items, payments)
DROP FUNCTION IF EXISTS public.create_sale(JSONB);

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

  -- Pass 1: validate items + lock stock + compute sale total
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

  -- Validate payments against server sale total (before writing)
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

  -- Create sale header
  INSERT INTO public.sales (total_amount, created_by)
  VALUES (round(v_sale_total, 2), auth.uid())
  RETURNING * INTO v_sale;

  -- Pass 2: items + movements + stock
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

    v_line_total := round(v_unit_price * v_quantity, 2);

    INSERT INTO public.sale_items (
      sale_id, product_id, quantity, unit_price, price_type, total_amount
    )
    VALUES (
      v_sale.id, v_product_id, v_quantity, v_unit_price, v_price_type, v_line_total
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

  -- Payments
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

REVOKE ALL ON FUNCTION public.create_sale(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_sale(JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_sale(JSONB, JSONB) IS
  'Atomic multi-item sale with exact payment total (CASH/UPI/CARD).';
