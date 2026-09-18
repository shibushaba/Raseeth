-- Manager role, shop-scoped inventory/sales, owner network overview, direct messaging

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops (id) ON DELETE RESTRICT;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS products_shop_id_idx ON public.products (shop_id);
CREATE INDEX IF NOT EXISTS sales_shop_id_idx ON public.sales (shop_id);

DO $$
DECLARE
  v_shop_id UUID;
BEGIN
  SELECT id INTO v_shop_id FROM public.shops ORDER BY created_at LIMIT 1;
  IF v_shop_id IS NOT NULL THEN
    UPDATE public.products SET shop_id = v_shop_id WHERE shop_id IS NULL;
    UPDATE public.sales SET shop_id = v_shop_id WHERE shop_id IS NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'MANAGER'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shop_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_salesman() OR public.is_manager();
$$;

CREATE OR REPLACE FUNCTION public.primary_shop_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.shops WHERE manager_id = p_user_id LIMIT 1),
    (
      SELECT sm.shop_id
      FROM public.shop_members sm
      WHERE sm.profile_id = p_user_id
      ORDER BY sm.created_at
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_product_shop_access(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_product_shop UUID;
BEGIN
  IF public.is_owner() THEN
    RETURN;
  END IF;

  v_shop_id := public.primary_shop_id(auth.uid());
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'No shop assigned to this user';
  END IF;

  SELECT shop_id INTO v_product_shop FROM public.products WHERE id = p_product_id;
  IF v_product_shop IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product_shop IS DISTINCT FROM v_shop_id THEN
    RAISE EXCEPTION 'Product belongs to another shop';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Salesman can insert products" ON public.products;
DROP POLICY IF EXISTS "Salesman can update products" ON public.products;

CREATE POLICY "Shop operators can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_shop_operator() AND created_by = auth.uid());

CREATE POLICY "Shop operators can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_shop_operator())
  WITH CHECK (public.is_shop_operator());




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
  v_shop_id UUID;
BEGIN
  IF NOT public.is_shop_operator() THEN
    RAISE EXCEPTION 'Only shop staff can create products';
  END IF;

  v_shop_id := public.primary_shop_id(auth.uid());
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'No shop assigned to this user';
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
    created_by,
    shop_id
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
    auth.uid(),
    v_shop_id
  )
  RETURNING * INTO v_product;

  IF p_initial_quantity > 0 THEN
    PERFORM public.add_stock(v_product.id, p_initial_quantity, v_cost, 'Opening stock');
  END IF;

  RETURN v_product;
END;
$$;



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
  IF NOT public.is_shop_operator() THEN
    RAISE EXCEPTION 'Only shop staff can add stock';
  END IF;

  PERFORM public.assert_product_shop_access(p_product_id);

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

CREATE OR REPLACE FUNCTION public.delete_product(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_shop_operator() THEN
    RAISE EXCEPTION 'Only shop staff can delete products';
  END IF;

  PERFORM public.assert_product_shop_access(p_product_id);

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sale_items WHERE product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'PRODUCT_HAS_SALES|This product has sales history and cannot be deleted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.return_items WHERE product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'PRODUCT_HAS_RETURNS|This product has return history and cannot be deleted';
  END IF;

  DELETE FROM public.inventory_movements WHERE product_id = p_product_id;
  DELETE FROM public.products WHERE id = p_product_id;
END;
$$;

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
  IF NOT public.is_shop_operator() THEN
    RAISE EXCEPTION 'Only shop staff can adjust stock';
  END IF;

  PERFORM public.assert_product_shop_access(p_product_id);

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
  v_shop_id := public.primary_shop_id(auth.uid());
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'No shop assigned to this user';
  END IF;

  IF NOT public.is_shop_operator() THEN
    RAISE EXCEPTION 'Only shop staff can create sales';
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

    IF v_product.shop_id IS DISTINCT FROM v_shop_id THEN
      RAISE EXCEPTION 'Product belongs to another shop';
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


CREATE OR REPLACE FUNCTION public.assign_shop_manager(
  p_shop_id UUID,
  p_manager_id UUID
)
RETURNS public.shops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.shops;
  v_prev_manager UUID;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can assign shop managers';
  END IF;

  SELECT manager_id INTO v_prev_manager FROM public.shops WHERE id = p_shop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF p_manager_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = p_manager_id AND role IN ('SALESMAN', 'MANAGER')
    ) THEN
      RAISE EXCEPTION 'Manager profile not found';
    END IF;

    UPDATE public.profiles SET role = 'MANAGER' WHERE id = p_manager_id;

    INSERT INTO public.shop_members (shop_id, profile_id)
    VALUES (p_shop_id, p_manager_id)
    ON CONFLICT (shop_id, profile_id) DO NOTHING;
  END IF;

  IF v_prev_manager IS NOT NULL AND v_prev_manager IS DISTINCT FROM p_manager_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE manager_id = v_prev_manager AND id <> p_shop_id) THEN
      UPDATE public.profiles SET role = 'SALESMAN' WHERE id = v_prev_manager AND role = 'MANAGER';
    END IF;
  END IF;

  UPDATE public.shops
  SET manager_id = p_manager_id
  WHERE id = p_shop_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;



CREATE OR REPLACE FUNCTION public.get_owner_network_overview(
  p_range_start TIMESTAMPTZ,
  p_range_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shops JSONB := '[]'::JSONB;
  v_total_net NUMERIC(12, 2) := 0;
  v_total_sales BIGINT := 0;
  v_best_shop_id UUID;
  v_best_shop_name TEXT;
  v_best_net NUMERIC(12, 2) := 0;
  v_attention BIGINT := 0;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can view network overview';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.net_sales DESC), '[]'::JSONB)
  INTO v_shops
  FROM (
    SELECT
      s.id,
      s.name,
      s.manager_id,
      m.full_name AS manager_name,
      COALESCE(SUM(round(si.unit_price * si.quantity, 2)), 0)
        - COALESCE((
          SELECT SUM(round(ri.unit_price * ri.quantity, 2))
          FROM public.return_items ri
          INNER JOIN public.returns r ON r.id = ri.return_id
          INNER JOIN public.sale_items si2 ON si2.id = ri.sale_item_id
          INNER JOIN public.sales s2 ON s2.id = si2.sale_id
          WHERE s2.shop_id = s.id
            AND r.created_at >= p_range_start
            AND r.created_at < p_range_end
        ), 0) AS net_sales,
      COUNT(DISTINCT sa.id) AS sale_count
    FROM public.shops s
    LEFT JOIN public.profiles m ON m.id = s.manager_id
    LEFT JOIN public.sales sa ON sa.shop_id = s.id
      AND sa.created_at >= p_range_start
      AND sa.created_at < p_range_end
    LEFT JOIN public.sale_items si ON si.sale_id = sa.id
    GROUP BY s.id, s.name, s.manager_id, m.full_name
  ) t;

  SELECT
    COALESCE(SUM((elem ->> 'net_sales')::NUMERIC), 0),
    COALESCE(SUM((elem ->> 'sale_count')::BIGINT), 0)
  INTO v_total_net, v_total_sales
  FROM jsonb_array_elements(v_shops) elem;

  SELECT (elem ->> 'id')::UUID, elem ->> 'name', (elem ->> 'net_sales')::NUMERIC
  INTO v_best_shop_id, v_best_shop_name, v_best_net
  FROM jsonb_array_elements(v_shops) elem
  ORDER BY (elem ->> 'net_sales')::NUMERIC DESC NULLS LAST
  LIMIT 1;

  SELECT COUNT(*) INTO v_attention
  FROM public.products p
  WHERE p.shop_id IS NOT NULL AND p.current_quantity <= 20;

  RETURN jsonb_build_object(
    'total_net_sales', round(v_total_net, 2),
    'total_sale_count', v_total_sales,
    'shop_count', jsonb_array_length(v_shops),
    'attention_count', v_attention,
    'best_shop_id', v_best_shop_id,
    'best_shop_name', v_best_shop_name,
    'best_shop_net_sales', round(COALESCE(v_best_net, 0), 2),
    'shops', v_shops
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shop_business_summary(
  p_shop_id UUID,
  p_range_start TIMESTAMPTZ,
  p_range_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gross NUMERIC(12, 2) := 0;
  v_returns NUMERIC(12, 2) := 0;
  v_net NUMERIC(12, 2) := 0;
  v_units_sold BIGINT := 0;
  v_units_returned BIGINT := 0;
  v_known_sale_rev NUMERIC(12, 2) := 0;
  v_cogs_sales NUMERIC(12, 2) := 0;
  v_cogs_returns NUMERIC(12, 2) := 0;
  v_cogs NUMERIC(12, 2);
  v_profit NUMERIC(12, 2);
  v_margin NUMERIC(12, 4);
  v_coverage NUMERIC(12, 4) := 0;
  v_has_cost BOOLEAN := false;
BEGIN
  IF p_range_end <= p_range_start THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF public.is_owner() THEN
    NULL;
  ELSIF public.is_manager() THEN
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND manager_id = auth.uid()) THEN
      RAISE EXCEPTION 'Not authorized for this shop';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT
    COALESCE(SUM(round(si.unit_price * si.quantity, 2)), 0),
    COALESCE(SUM(si.quantity), 0)
  INTO v_gross, v_units_sold
  FROM public.sale_items si
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.shop_id = p_shop_id
    AND s.created_at >= p_range_start
    AND s.created_at < p_range_end;

  SELECT
    COALESCE(SUM(round(ri.unit_price * ri.quantity, 2)), 0),
    COALESCE(SUM(ri.quantity), 0)
  INTO v_returns, v_units_returned
  FROM public.return_items ri
  INNER JOIN public.returns r ON r.id = ri.return_id
  INNER JOIN public.sale_items si ON si.id = ri.sale_item_id
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.shop_id = p_shop_id
    AND r.created_at >= p_range_start
    AND r.created_at < p_range_end;

  v_net := round(v_gross - v_returns, 2);

  SELECT
    COALESCE(SUM(round(si.unit_price * si.quantity, 2)), 0),
    COALESCE(SUM(round(si.unit_cost * si.quantity, 2)), 0)
  INTO v_known_sale_rev, v_cogs_sales
  FROM public.sale_items si
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.shop_id = p_shop_id
    AND s.created_at >= p_range_start
    AND s.created_at < p_range_end
    AND si.unit_cost IS NOT NULL;

  SELECT COALESCE(SUM(round(ri.unit_cost * ri.quantity, 2)), 0)
  INTO v_cogs_returns
  FROM public.return_items ri
  INNER JOIN public.returns r ON r.id = ri.return_id
  INNER JOIN public.sale_items si ON si.id = ri.sale_item_id
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.shop_id = p_shop_id
    AND r.created_at >= p_range_start
    AND r.created_at < p_range_end
    AND ri.unit_cost IS NOT NULL;

  v_has_cost := v_known_sale_rev > 0 OR v_cogs_returns > 0;

  IF v_gross > 0 THEN
    v_coverage := round(v_known_sale_rev / v_gross, 4);
  END IF;

  IF v_has_cost THEN
    v_cogs := round(v_cogs_sales - v_cogs_returns, 2);
    v_profit := round(v_net - v_cogs, 2);
    IF v_net <> 0 THEN
      v_margin := round((v_profit / v_net) * 100, 2);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'gross_sales', v_gross,
    'returns', v_returns,
    'net_sales', v_net,
    'cogs', v_cogs,
    'gross_profit', v_profit,
    'gross_margin', v_margin,
    'units_sold', v_units_sold - v_units_returned,
    'cost_coverage', v_coverage,
    'has_sales', (v_gross > 0 OR v_returns > 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_shop()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_row RECORD;
BEGIN
  v_shop_id := public.primary_shop_id(auth.uid());
  IF v_shop_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.id, s.name, s.manager_id, m.full_name AS manager_name
  INTO v_row
  FROM public.shops s
  LEFT JOIN public.profiles m ON m.id = s.manager_id
  WHERE s.id = v_shop_id;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'manager_id', v_row.manager_id,
    'manager_name', v_row.manager_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_network_overview(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_network_overview(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
REVOKE ALL ON FUNCTION public.get_shop_business_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shop_business_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_shop() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_shop() TO authenticated;



CREATE OR REPLACE FUNCTION public.get_message_contacts()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  role public.user_role,
  shop_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_shop_id UUID;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role = 'OWNER' THEN
    RETURN QUERY
    SELECT p.id, p.full_name, p.role, s.name
    FROM public.profiles p
    LEFT JOIN public.shops s ON s.manager_id = p.id
    WHERE p.role = 'MANAGER'
    ORDER BY p.full_name;
    RETURN;
  END IF;

  IF v_role = 'MANAGER' THEN
    v_shop_id := public.primary_shop_id(auth.uid());
    RETURN QUERY
    SELECT p.id, p.full_name, p.role, NULL::TEXT
    FROM public.profiles p
    WHERE p.role = 'OWNER'
    ORDER BY p.created_at
    LIMIT 1;
    RETURN QUERY
    SELECT p.id, p.full_name, p.role, NULL::TEXT
    FROM public.profiles p
    INNER JOIN public.shop_members sm ON sm.profile_id = p.id
    WHERE sm.shop_id = v_shop_id AND p.role = 'SALESMAN'
    ORDER BY p.full_name;
    RETURN;
  END IF;

  IF v_role = 'SALESMAN' THEN
    v_shop_id := public.primary_shop_id(auth.uid());
    RETURN QUERY
    SELECT p.id, p.full_name, p.role, s.name
    FROM public.shops s
    INNER JOIN public.profiles p ON p.id = s.manager_id
    WHERE s.id = v_shop_id;
    RETURN;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.send_business_message(TEXT);

CREATE OR REPLACE FUNCTION public.send_business_message(
  p_message TEXT,
  p_receiver_id UUID DEFAULT NULL
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_receiver UUID;
  v_row public.messages;
  v_text TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_text := trim(COALESCE(p_message, ''));
  IF v_text = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Message is too long';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF p_receiver_id IS NOT NULL THEN
    v_receiver := p_receiver_id;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_receiver) THEN
      RAISE EXCEPTION 'Recipient not found';
    END IF;
  ELSE
    IF v_role = 'OWNER' THEN
      SELECT id INTO v_receiver
      FROM public.profiles
      WHERE role = 'MANAGER'
      ORDER BY created_at ASC
      LIMIT 1;
    ELSIF v_role = 'MANAGER' THEN
      SELECT id INTO v_receiver
      FROM public.profiles
      WHERE role = 'OWNER'
      ORDER BY created_at ASC
      LIMIT 1;
    ELSIF v_role = 'SALESMAN' THEN
      SELECT s.manager_id INTO v_receiver
      FROM public.shops s
      INNER JOIN public.shop_members sm ON sm.shop_id = s.id
      WHERE sm.profile_id = auth.uid()
      ORDER BY s.created_at
      LIMIT 1;
    END IF;
  END IF;

  IF v_receiver IS NULL OR v_receiver = auth.uid() THEN
    RAISE EXCEPTION 'No recipient available';
  END IF;

  INSERT INTO public.messages (sender_id, receiver_id, message, is_read)
  VALUES (auth.uid(), v_receiver, v_text, false)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.get_message_contacts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_message_contacts() TO authenticated;
