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
