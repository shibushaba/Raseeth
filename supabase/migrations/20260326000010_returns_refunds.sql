-- Phase 9b: Returns + Refunds (immutable compensating transactions)

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_return_qty_check
    CHECK (movement_type <> 'RETURN' OR quantity > 0);

CREATE SEQUENCE public.return_number_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'RETURN-' || lpad(nextval('public.return_number_seq')::text, 6, '0');
$$;

CREATE TABLE public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT NOT NULL UNIQUE DEFAULT public.generate_return_number(),
  sale_id UUID NOT NULL REFERENCES public.sales (id) ON DELETE RESTRICT,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX returns_sale_id_idx ON public.returns (sale_id);
CREATE INDEX returns_created_at_idx ON public.returns (created_at DESC);
CREATE INDEX returns_return_number_idx ON public.returns (return_number);
CREATE INDEX returns_created_by_idx ON public.returns (created_by);

CREATE TABLE public.return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns (id) ON DELETE RESTRICT,
  sale_item_id UUID NOT NULL REFERENCES public.sale_items (id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT return_items_line_total_check
    CHECK (total_amount = round(unit_price * quantity, 2))
);

CREATE INDEX return_items_return_id_idx ON public.return_items (return_id);
CREATE INDEX return_items_sale_item_id_idx ON public.return_items (sale_item_id);
CREATE INDEX return_items_product_id_idx ON public.return_items (product_id);

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL UNIQUE REFERENCES public.returns (id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES public.payments (id) ON DELETE RESTRICT,
  refund_method public.payment_method NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX refunds_created_at_idx ON public.refunds (created_at DESC);
CREATE INDEX refunds_method_idx ON public.refunds (refund_method);

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read returns"
  ON public.returns FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Staff can read return items"
  ON public.return_items FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "Staff can read refunds"
  ON public.refunds FOR SELECT TO authenticated
  USING (public.is_staff());

REVOKE INSERT, UPDATE, DELETE ON TABLE public.returns FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.return_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.refunds FROM authenticated;
GRANT SELECT ON TABLE public.returns TO authenticated;
GRANT SELECT ON TABLE public.return_items TO authenticated;
GRANT SELECT ON TABLE public.refunds TO authenticated;

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

    v_unit_price := v_sale_item.unit_price;
    v_line_total := round(v_unit_price * v_quantity, 2);

    INSERT INTO public.return_items (
      return_id, sale_item_id, product_id, quantity, unit_price, total_amount
    )
    VALUES (
      v_return.id,
      v_sale_item.id,
      v_sale_item.product_id,
      v_quantity,
      v_unit_price,
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

REVOKE ALL ON FUNCTION public.create_return(JSONB, public.payment_method) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_return(JSONB, public.payment_method) TO authenticated;

COMMENT ON FUNCTION public.create_return(JSONB, public.payment_method) IS
  'Atomic return with inventory restore and full refund (CASH/UPI/CARD).';
