-- Staff in multiple shops see and sell inventory across all assigned shops.

CREATE OR REPLACE FUNCTION public.is_staff_member_of_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_shop_id IS NULL THEN false
    WHEN public.is_owner() THEN EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = p_shop_id AND s.created_by = auth.uid()
    )
    ELSE EXISTS (
      SELECT 1 FROM public.shop_members sm
      WHERE sm.profile_id = auth.uid() AND sm.shop_id = p_shop_id
    )
    OR EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = p_shop_id AND s.manager_id = auth.uid()
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_shop(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff_member_of_shop(p_shop_id);
$$;

DROP POLICY IF EXISTS "Read shop members in accessible shops" ON public.shop_members;
CREATE POLICY "Read shop members in accessible shops"
  ON public.shop_members
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_owner()
    OR public.is_manager()
  );

CREATE OR REPLACE FUNCTION public.list_my_accessible_shop_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT x.id), ARRAY[]::UUID[])
  FROM (
    SELECT s.id
    FROM public.shops s
    WHERE public.is_owner() AND s.created_by = auth.uid()
    UNION
    SELECT sm.shop_id AS id
    FROM public.shop_members sm
    WHERE sm.profile_id = auth.uid()
    UNION
    SELECT s.id
    FROM public.shops s
    WHERE s.manager_id = auth.uid()
  ) AS x;
$$;

REVOKE ALL ON FUNCTION public.list_my_accessible_shop_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_accessible_shop_ids() TO authenticated;

-- create_sale: allow products from any assigned shop; one shop per sale.
CREATE OR REPLACE FUNCTION public.create_sale(
  p_items JSONB,
  p_payments JSONB,
  p_adjustments JSONB DEFAULT NULL
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
  v_subtotal NUMERIC(12, 2) := 0;
  v_final_total NUMERIC(12, 2);
  v_discount NUMERIC(12, 2) := 0;
  v_tax NUMERIC(12, 2) := 0;
  v_other NUMERIC(12, 2) := 0;
  v_note TEXT;
  v_pay_total NUMERIC(12, 2) := 0;
  v_pay_amount NUMERIC(12, 2);
  v_pay_method public.payment_method;
  v_idx INTEGER := 0;
  v_shop_id UUID;
BEGIN
  v_shop_id := NULL;

  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can create sales';
  END IF;

  IF COALESCE(array_length(public.list_my_accessible_shop_ids(), 1), 0) = 0 THEN
    RAISE EXCEPTION 'No shop assigned to this user';
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

    IF NOT public.is_staff_member_of_shop(v_product.shop_id) THEN
      RAISE EXCEPTION 'Product belongs to another shop';
    END IF;

    IF v_shop_id IS NULL THEN
      v_shop_id := v_product.shop_id;
    ELSIF v_product.shop_id IS DISTINCT FROM v_shop_id THEN
      RAISE EXCEPTION 'All items in one sale must be from the same shop';
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

    v_subtotal := v_subtotal + round(v_unit_price * v_quantity, 2);
  END LOOP;

  v_subtotal := round(v_subtotal, 2);

  IF p_adjustments IS NOT NULL AND jsonb_typeof(p_adjustments) = 'object' THEN
    BEGIN
      v_discount := round(COALESCE((p_adjustments ->> 'discount_amount')::NUMERIC, 0), 2);
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid discount amount';
    END;
    BEGIN
      v_tax := round(COALESCE((p_adjustments ->> 'tax_amount')::NUMERIC, 0), 2);
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid tax amount';
    END;
    BEGIN
      v_other := round(COALESCE((p_adjustments ->> 'other_charges')::NUMERIC, 0), 2);
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid other charges';
    END;
    v_note := NULLIF(trim(COALESCE(p_adjustments ->> 'note', '')), '');
  END IF;

  IF v_discount < 0 OR v_tax < 0 OR v_other < 0 THEN
    RAISE EXCEPTION 'Adjustments cannot be negative';
  END IF;

  IF v_discount > v_subtotal THEN
    RAISE EXCEPTION 'Discount exceeds subtotal';
  END IF;

  v_final_total := round(v_subtotal - v_discount + v_tax + v_other, 2);

  IF v_final_total < 0 THEN
    RAISE EXCEPTION 'Sale total cannot be negative';
  END IF;

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

  IF v_pay_total < v_final_total THEN
    RAISE EXCEPTION 'PAYMENT_UNDER|%|%', v_pay_total, v_final_total;
  END IF;

  IF v_pay_total > v_final_total THEN
    RAISE EXCEPTION 'PAYMENT_OVER|%|%', v_pay_total, v_final_total;
  END IF;

  INSERT INTO public.sales (
    total_amount,
    subtotal_amount,
    discount_amount,
    tax_amount,
    other_charges,
    adjustment_note,
    created_by,
    shop_id
  )
  VALUES (
    v_final_total,
    v_subtotal,
    v_discount,
    v_tax,
    v_other,
    v_note,
    auth.uid(),
    v_shop_id
  )
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
