-- Let owner RPCs change profile.role (assign_shop_manager) without client escalation.

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('raseeth.skip_profile_role_guard', true) = '1' THEN
      NEW.id := OLD.id;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Role cannot be changed from the client';
  END IF;
  NEW.id := OLD.id;
  RETURN NEW;
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

  PERFORM set_config('raseeth.skip_profile_role_guard', '1', true);

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
    IF NOT EXISTS (
      SELECT 1 FROM public.shops WHERE manager_id = v_prev_manager AND id <> p_shop_id
    ) THEN
      UPDATE public.profiles
      SET role = 'SALESMAN'
      WHERE id = v_prev_manager AND role = 'MANAGER';
    END IF;
  END IF;

  PERFORM set_config('raseeth.skip_profile_role_guard', '0', true);

  UPDATE public.shops
  SET manager_id = p_manager_id
  WHERE id = p_shop_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
