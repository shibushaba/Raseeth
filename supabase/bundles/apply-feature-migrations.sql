-- Raseeth feature migrations (safe bundle — no data purges)
-- Run in Supabase Dashboard → SQL → New query
-- Then: npm run demo:ensure-auth

-- ========== 20261002120000_shop_isolation_rls.sql ==========
-- Shop-scoped read access (owner owns shops via created_by; staff via membership).

CREATE OR REPLACE FUNCTION public.can_access_shop(p_shop_id UUID)
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
    ELSE public.primary_shop_id(auth.uid()) = p_shop_id
  END;
$$;

CREATE OR REPLACE FUNCTION public.list_shops()
RETURNS TABLE (
  id UUID,
  name TEXT,
  manager_id UUID,
  manager_name TEXT,
  worker_count BIGINT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.manager_id,
    m.full_name AS manager_name,
    (
      SELECT count(*)::BIGINT
      FROM public.shop_members sm
      INNER JOIN public.profiles p ON p.id = sm.profile_id
      WHERE sm.shop_id = s.id AND p.role = 'SALESMAN'
    ) AS worker_count,
    s.is_active,
    s.created_at
  FROM public.shops s
  LEFT JOIN public.profiles m ON m.id = s.manager_id
  WHERE
    (public.is_owner() AND s.created_by = auth.uid())
    OR (public.is_manager() AND s.manager_id = auth.uid())
    OR (
      public.is_salesman()
      AND EXISTS (
        SELECT 1 FROM public.shop_members sm
        WHERE sm.shop_id = s.id AND sm.profile_id = auth.uid()
      )
    )
  ORDER BY s.created_at ASC;
$$;

DROP POLICY IF EXISTS "Staff can read shops" ON public.shops;
CREATE POLICY "Read accessible shops"
  ON public.shops
  FOR SELECT
  TO authenticated
  USING (public.can_access_shop(id));

DROP POLICY IF EXISTS "Staff can read shop members" ON public.shop_members;
CREATE POLICY "Read shop members in accessible shops"
  ON public.shop_members
  FOR SELECT
  TO authenticated
  USING (public.can_access_shop(shop_id));

DROP POLICY IF EXISTS "Staff can read products" ON public.products;
CREATE POLICY "Read products in accessible shops"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    shop_id IS NOT NULL AND public.can_access_shop(shop_id)
  );

DROP POLICY IF EXISTS "Staff can read sales" ON public.sales;
CREATE POLICY "Read sales in accessible shops"
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (
    shop_id IS NOT NULL AND public.can_access_shop(shop_id)
  );

DROP POLICY IF EXISTS "Staff can read inventory movements" ON public.inventory_movements;
CREATE POLICY "Read movements in accessible shops"
  ON public.inventory_movements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND public.can_access_shop(p.shop_id)
    )
  );

-- Owner: create shop + manager account in one secure transaction.
CREATE OR REPLACE FUNCTION public.create_shop_with_manager(
  p_shop_name TEXT,
  p_manager_name TEXT,
  p_manager_phone TEXT,
  p_manager_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_shop public.shops;
  v_digits TEXT;
  v_name TEXT;
  v_pass TEXT;
  v_user_id UUID;
  v_email TEXT;
  v_existing UUID;
  v_profile public.profiles;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can create shops';
  END IF;

  v_name := trim(COALESCE(p_shop_name, ''));
  IF length(v_name) = 0 THEN
    RAISE EXCEPTION 'Shop name is required';
  END IF;

  INSERT INTO public.shops (name, created_by)
  VALUES (v_name, auth.uid())
  RETURNING * INTO v_shop;

  v_digits := public.normalize_phone_digits(p_manager_phone);
  IF v_digits IS NULL OR length(v_digits) <> 10 THEN
    RAISE EXCEPTION 'Enter a valid 10-digit mobile number for the manager';
  END IF;

  v_pass := COALESCE(p_manager_password, '');
  IF length(v_pass) < 6 THEN
    RAISE EXCEPTION 'Manager password must be at least 6 characters';
  END IF;

  SELECT p.id INTO v_existing
  FROM public.profiles p
  WHERE public.normalize_phone_digits(p.phone) = v_digits
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    PERFORM set_config('raseeth.skip_profile_role_guard', '1', true);
    UPDATE public.profiles
    SET role = 'MANAGER',
        full_name = trim(COALESCE(p_manager_name, full_name))
    WHERE id = v_existing
    RETURNING * INTO v_profile;
    PERFORM set_config('raseeth.skip_profile_role_guard', '0', true);

    INSERT INTO public.shop_members (shop_id, profile_id)
    VALUES (v_shop.id, v_existing)
    ON CONFLICT DO NOTHING;

    UPDATE public.shops SET manager_id = v_existing WHERE id = v_shop.id;

    RETURN jsonb_build_object(
      'shop_id', v_shop.id,
      'shop_name', v_shop.name,
      'manager_id', v_existing,
      'manager_created', false
    );
  END IF;

  v_user_id := gen_random_uuid();
  v_email := v_digits || '@phone.raseeth.local';

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(v_pass, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', trim(COALESCE(p_manager_name, 'Shop Manager'))),
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email', v_user_id::text, now(), now(), now()
  );

  PERFORM set_config('raseeth.skip_profile_role_guard', '1', true);
  UPDATE public.profiles
  SET full_name = trim(COALESCE(p_manager_name, 'Shop Manager')),
      phone = v_digits,
      role = 'MANAGER'
  WHERE id = v_user_id
  RETURNING * INTO v_profile;
  PERFORM set_config('raseeth.skip_profile_role_guard', '0', true);

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Could not create manager profile';
  END IF;

  INSERT INTO public.shop_members (shop_id, profile_id)
  VALUES (v_shop.id, v_user_id);

  UPDATE public.shops SET manager_id = v_user_id WHERE id = v_shop.id;

  RETURN jsonb_build_object(
    'shop_id', v_shop.id,
    'shop_name', v_shop.name,
    'manager_id', v_user_id,
    'manager_created', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_shop_with_manager(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_shop_with_manager(TEXT, TEXT, TEXT, TEXT) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20261002120000_shop_isolation_rls', '20261002120000_shop_isolation_rls') ON CONFLICT (version) DO NOTHING;

-- ========== 20261002130000_owner_network_scope.sql ==========
-- Scope owner network overview to shops they created; limit stock alerts to those shops.

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
    WHERE s.created_by = auth.uid()
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
  INNER JOIN public.shops s ON s.id = p.shop_id
  WHERE s.created_by = auth.uid()
    AND p.shop_id IS NOT NULL
    AND p.current_quantity <= 20;

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

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20261002130000_owner_network_scope', '20261002130000_owner_network_scope') ON CONFLICT (version) DO NOTHING;

-- ========== 20261002200000_stock_manager_role_split.sql ==========
-- Stock manager (MANAGER role): inventory only. Salesman: sales only. Owner adds salesmen per shop.

CREATE OR REPLACE FUNCTION public.is_inventory_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_manager();
$$;

COMMENT ON FUNCTION public.is_inventory_operator() IS
  'Stock / inventory manager for a shop (MANAGER role).';

CREATE OR REPLACE FUNCTION public.is_shop_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_salesman();
$$;

COMMENT ON FUNCTION public.is_shop_operator() IS
  'Floor sales operator (SALESMAN role) — POS and returns only.';

DROP POLICY IF EXISTS "Shop operators can insert products" ON public.products;
DROP POLICY IF EXISTS "Shop operators can update products" ON public.products;

CREATE POLICY "Inventory managers can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_inventory_operator() AND created_by = auth.uid());

CREATE POLICY "Inventory managers can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_inventory_operator())
  WITH CHECK (public.is_inventory_operator());

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
  IF NOT public.is_inventory_operator() THEN
    RAISE EXCEPTION 'Only the stock manager can create products';
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
  IF NOT public.is_inventory_operator() THEN
    RAISE EXCEPTION 'Only the stock manager can add stock';
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
  IF NOT public.is_inventory_operator() THEN
    RAISE EXCEPTION 'Only the stock manager can delete products';
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
  IF NOT public.is_inventory_operator() THEN
    RAISE EXCEPTION 'Only the stock manager can adjust stock';
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


CREATE OR REPLACE FUNCTION public.list_my_shop_team()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role = 'OWNER' THEN
    RETURN QUERY
    SELECT p.*
    FROM public.profiles p
    ORDER BY p.role, p.full_name;
    RETURN;
  END IF;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_shop_salesmen(p_shop_id UUID)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can list shop salesmen';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = p_shop_id AND s.created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  RETURN QUERY
  SELECT p.*
  FROM public.profiles p
  INNER JOIN public.shop_members sm ON sm.profile_id = p.id
  WHERE sm.shop_id = p_shop_id
    AND p.role = 'SALESMAN'::public.user_role
  ORDER BY p.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_add_shop_salesman(
  p_shop_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_password TEXT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_digits TEXT;
  v_shop_id UUID;
  v_name TEXT;
  v_pass TEXT;
  v_user_id UUID;
  v_email TEXT;
  v_existing UUID;
  v_profile public.profiles;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can add salesmen';
  END IF;

  v_shop_id := p_shop_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = v_shop_id AND s.created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  v_name := trim(COALESCE(p_full_name, ''));
  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  IF length(v_name) > 120 THEN
    RAISE EXCEPTION 'Name is too long';
  END IF;

  v_digits := public.normalize_phone_digits(p_phone);
  IF v_digits IS NULL OR length(v_digits) <> 10 THEN
    RAISE EXCEPTION 'Enter a valid 10-digit mobile number';
  END IF;

  v_pass := COALESCE(p_password, '');
  IF length(v_pass) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT p.id
  INTO v_existing
  FROM public.profiles p
  WHERE public.normalize_phone_digits(p.phone) = v_digits
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = v_existing AND role = 'SALESMAN'::public.user_role
    ) THEN
      RAISE EXCEPTION 'This mobile number is already registered to another role';
    END IF;

    UPDATE public.profiles
    SET full_name = v_name
    WHERE id = v_existing
    RETURNING * INTO v_profile;

    INSERT INTO public.shop_members (shop_id, profile_id)
    VALUES (v_shop_id, v_existing)
    ON CONFLICT (shop_id, profile_id) DO NOTHING;

    RETURN v_profile;
  END IF;

  v_user_id := gen_random_uuid();
  v_email := v_digits || '@phone.raseeth.local';

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'This mobile number is already registered';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_pass, extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name), now(), now()
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email', v_user_id::text, now(), now(), now()
  );

  PERFORM set_config('raseeth.skip_profile_role_guard', '1', true);
  UPDATE public.profiles
  SET full_name = v_name, phone = v_digits, role = 'SALESMAN'
  WHERE id = v_user_id
  RETURNING * INTO v_profile;
  PERFORM set_config('raseeth.skip_profile_role_guard', '0', true);

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Could not create salesman profile';
  END IF;

  INSERT INTO public.shop_members (shop_id, profile_id)
  VALUES (v_shop_id, v_user_id)
  ON CONFLICT (shop_id, profile_id) DO NOTHING;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_shop_salesman(
  p_full_name TEXT,
  p_phone TEXT,
  p_password TEXT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Salesmen are added by the shop owner from Shops & team';
END;
$$;

REVOKE ALL ON FUNCTION public.list_shop_salesmen(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_shop_salesmen(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.owner_add_shop_salesman(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_add_shop_salesman(UUID, TEXT, TEXT, TEXT) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20261002200000_stock_manager_role_split', '20261002200000_stock_manager_role_split') ON CONFLICT (version) DO NOTHING;

-- ========== 20261002210000_product_minimum_quantity.sql ==========
-- Per-product minimum quantity for low-stock alerts.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS minimum_quantity INTEGER NOT NULL DEFAULT 5;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_minimum_quantity_nonneg;

ALTER TABLE public.products
  ADD CONSTRAINT products_minimum_quantity_nonneg CHECK (minimum_quantity >= 0);

CREATE OR REPLACE FUNCTION public.create_product(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_purchase_price NUMERIC DEFAULT 0,
  p_retail_price NUMERIC DEFAULT 0,
  p_wholesale_price NUMERIC DEFAULT 0,
  p_initial_quantity INTEGER DEFAULT 0,
  p_minimum_quantity INTEGER DEFAULT 5
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
  v_min INTEGER;
BEGIN
  IF NOT public.is_inventory_operator() THEN
    RAISE EXCEPTION 'Only the stock manager can create products';
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

  v_min := COALESCE(p_minimum_quantity, 5);
  IF v_min < 0 THEN
    RAISE EXCEPTION 'Minimum quantity cannot be negative';
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
    minimum_quantity,
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
    v_min,
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

CREATE OR REPLACE FUNCTION public.get_stock_alert_products(p_shop_id UUID DEFAULT NULL)
RETURNS SETOF public.products
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public.products p
  WHERE public.can_access_shop(p.shop_id)
    AND (p_shop_id IS NULL OR p.shop_id = p_shop_id)
    AND (
      p.current_quantity = 0
      OR (
        p.current_quantity > 0
        AND p.current_quantity <= p.minimum_quantity
      )
    )
  ORDER BY p.current_quantity ASC, p.name ASC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_inventory_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_out BIGINT;
  v_low BIGINT;
  v_adj BIGINT;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.products;

  SELECT COUNT(*) INTO v_out
  FROM public.products
  WHERE current_quantity = 0;

  SELECT COUNT(*) INTO v_low
  FROM public.products
  WHERE current_quantity > 0
    AND current_quantity <= minimum_quantity;

  SELECT COUNT(*) INTO v_adj
  FROM public.inventory_movements
  WHERE movement_type = 'ADJUSTMENT'
    AND created_at >= (now() - interval '7 days');

  RETURN jsonb_build_object(
    'total_products', v_total,
    'out_of_stock', v_out,
    'low_stock', v_low,
    'needs_attention', v_out + v_low,
    'recent_adjustments', v_adj
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_stock_alert_products(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_alert_products(UUID) TO authenticated;

-- Owner network stock attention uses per-product minimums.
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
    WHERE s.created_by = auth.uid()
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
  INNER JOIN public.shops s ON s.id = p.shop_id
  WHERE s.created_by = auth.uid()
    AND p.shop_id IS NOT NULL
    AND (
      p.current_quantity = 0
      OR (
        p.current_quantity > 0
        AND p.current_quantity <= p.minimum_quantity
      )
    );

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

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20261002210000_product_minimum_quantity', '20261002210000_product_minimum_quantity') ON CONFLICT (version) DO NOTHING;

-- ========== 20261002220000_product_shop_sale_fix.sql ==========
-- Align product shop_id with staff shops and fix primary_shop_id for salesmen.

-- Legacy rows block create_sale when shop_id IS NULL.
UPDATE public.products p
SET shop_id = sub.fix_shop
FROM (
  SELECT
    p2.id,
    COALESCE(
      p2.shop_id,
      public.primary_shop_id(p2.created_by),
      (SELECT s.id FROM public.shops s ORDER BY s.created_at ASC LIMIT 1)
    ) AS fix_shop
  FROM public.products p2
  WHERE p2.shop_id IS NULL
) AS sub
WHERE p.id = sub.id
  AND p.shop_id IS NULL
  AND sub.fix_shop IS NOT NULL;

CREATE OR REPLACE FUNCTION public.primary_shop_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (
      SELECT role FROM public.profiles WHERE id = p_user_id
    ) = 'SALESMAN' THEN (
      SELECT sm.shop_id
      FROM public.shop_members sm
      WHERE sm.profile_id = p_user_id
      ORDER BY sm.created_at ASC
      LIMIT 1
    )
    ELSE COALESCE(
      (SELECT id FROM public.shops WHERE manager_id = p_user_id LIMIT 1),
      (
        SELECT sm.shop_id
        FROM public.shop_members sm
        WHERE sm.profile_id = p_user_id
        ORDER BY sm.created_at ASC
        LIMIT 1
      )
    )
  END;
$$;

-- Products tied to the wrong shop block create_sale; align with creator's primary shop when possible.
UPDATE public.products p
SET shop_id = public.primary_shop_id(p.created_by)
WHERE p.created_by IS NOT NULL
  AND public.primary_shop_id(p.created_by) IS NOT NULL
  AND p.shop_id IS DISTINCT FROM public.primary_shop_id(p.created_by)
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = p.created_by
      AND pr.role IN ('SALESMAN', 'MANAGER')
  );

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('20261002220000_product_shop_sale_fix', '20261002220000_product_shop_sale_fix') ON CONFLICT (version) DO NOTHING;
