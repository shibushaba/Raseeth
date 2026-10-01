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
