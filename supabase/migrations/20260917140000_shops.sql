-- Shops and shop managers (owner-managed; staff can read)

CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shops_manager_id_idx ON public.shops (manager_id);
CREATE INDEX shops_is_active_idx ON public.shops (is_active);

CREATE TABLE public.shop_members (
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, profile_id)
);

CREATE INDEX shop_members_profile_id_idx ON public.shop_members (profile_id);

CREATE TRIGGER shops_set_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read shops"
  ON public.shops
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Staff can read shop members"
  ON public.shop_members
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- ---------------------------------------------------------------------------
-- RPCs (owner-only mutations)
-- ---------------------------------------------------------------------------

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
  ORDER BY s.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.create_shop(p_name TEXT)
RETURNS public.shops
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_row public.shops;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can create shops';
  END IF;

  v_name := trim(p_name);
  IF v_name IS NULL OR length(v_name) = 0 THEN
    RAISE EXCEPTION 'Shop name is required';
  END IF;

  IF length(v_name) > 120 THEN
    RAISE EXCEPTION 'Shop name is too long';
  END IF;

  INSERT INTO public.shops (name, created_by)
  VALUES (v_name, auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
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
  v_role public.user_role;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can assign shop managers';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF p_manager_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = p_manager_id;
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Manager profile not found';
    END IF;
    IF v_role <> 'SALESMAN' THEN
      RAISE EXCEPTION 'Shop manager must be a salesman';
    END IF;

    INSERT INTO public.shop_members (shop_id, profile_id)
    VALUES (p_shop_id, p_manager_id)
    ON CONFLICT (shop_id, profile_id) DO NOTHING;
  END IF;

  UPDATE public.shops
  SET manager_id = p_manager_id
  WHERE id = p_shop_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.list_shops() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_shops() TO authenticated;

REVOKE ALL ON FUNCTION public.create_shop(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_shop(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_shop_manager(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_shop_manager(UUID, UUID) TO authenticated;

-- Default shop for existing single-shop deployments
DO $$
DECLARE
  v_owner_id UUID;
  v_shop_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.shops) THEN
    RETURN;
  END IF;

  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE role = 'OWNER'
  ORDER BY created_at
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.shops (name, created_by)
  VALUES ('Raseeth Shop', v_owner_id)
  RETURNING id INTO v_shop_id;

  INSERT INTO public.shop_members (shop_id, profile_id)
  SELECT v_shop_id, pr.id
  FROM public.profiles pr
  WHERE pr.role = 'SALESMAN';

  UPDATE public.shops
  SET manager_id = (
    SELECT pr.id
    FROM public.profiles pr
    WHERE pr.role = 'SALESMAN'
    ORDER BY pr.created_at
    LIMIT 1
  )
  WHERE id = v_shop_id;
END;
$$;
