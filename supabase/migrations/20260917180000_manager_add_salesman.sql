-- Shop managers invite cashiers (salesmen) to their shop.

CREATE OR REPLACE FUNCTION public.list_my_shop_team()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
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

  IF v_role = 'MANAGER' THEN
    v_shop_id := public.primary_shop_id(auth.uid());
    IF v_shop_id IS NULL THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT p.*
    FROM public.profiles p
    INNER JOIN public.shop_members sm ON sm.profile_id = p.id
    WHERE sm.shop_id = v_shop_id AND p.role = 'SALESMAN'::public.user_role
    ORDER BY p.full_name;
    RETURN;
  END IF;
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
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Only shop managers can add salesmen';
  END IF;

  v_shop_id := public.primary_shop_id(auth.uid());
  IF v_shop_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.shops WHERE id = v_shop_id AND manager_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are not assigned to manage a shop';
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
    jsonb_build_object('full_name', v_name),
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  UPDATE public.profiles
  SET full_name = v_name,
      phone = v_digits
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Could not create salesman profile';
  END IF;

  INSERT INTO public.shop_members (shop_id, profile_id)
  VALUES (v_shop_id, v_user_id)
  ON CONFLICT (shop_id, profile_id) DO NOTHING;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_shop_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_shop_team() TO authenticated;

REVOKE ALL ON FUNCTION public.add_shop_salesman(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_shop_salesman(TEXT, TEXT, TEXT) TO authenticated;
