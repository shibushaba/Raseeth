-- Role helpers and Row Level Security
-- Frontend authorization is UX only; these policies are the real access control.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'OWNER'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_salesman()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'SALESMAN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner() OR public.is_salesman();
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE POLICY "Staff can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Prevent clients from escalating privileges by changing role.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow privileged SQL (auth.uid() null); block client privilege escalation.
  IF auth.uid() IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Role cannot be changed from the client';
  END IF;
  NEW.id := OLD.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- No INSERT/DELETE for clients — profiles are created by the auth trigger.

-- ---------------------------------------------------------------------------
-- products
-- OWNER: read-only
-- SALESMAN: read + insert + update (no delete in MVP)
-- ---------------------------------------------------------------------------

CREATE POLICY "Staff can read products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Salesman can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_salesman() AND created_by = auth.uid());

CREATE POLICY "Salesman can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_salesman())
  WITH CHECK (public.is_salesman());

-- Quantity and product_code must only change via SECURITY DEFINER RPCs.
REVOKE UPDATE ON TABLE public.products FROM authenticated;
GRANT UPDATE (
  name,
  description,
  category,
  purchase_price,
  retail_price,
  wholesale_price,
  updated_at
) ON TABLE public.products TO authenticated;

-- ---------------------------------------------------------------------------
-- inventory_movements
-- Direct INSERT blocked for clients; use SECURITY DEFINER RPCs.
-- SELECT allowed for staff.
-- ---------------------------------------------------------------------------

CREATE POLICY "Staff can read inventory movements"
  ON public.inventory_movements
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Intentionally no INSERT/UPDATE/DELETE policies for authenticated clients.
-- Movements are created only through create_product / create_sale / add_stock RPCs.

-- ---------------------------------------------------------------------------
-- sales
-- OWNER: read-only
-- SALESMAN: read; INSERT only via RPC (no client INSERT policy)
-- ---------------------------------------------------------------------------

CREATE POLICY "Staff can read sales"
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- No INSERT/UPDATE/DELETE for clients — sales go through create_sale RPC.

-- ---------------------------------------------------------------------------
-- messages
-- Participants may read their own thread messages.
-- Both roles may insert messages they send.
-- Receiver may mark as read (update is_read).
-- ---------------------------------------------------------------------------

CREATE POLICY "Users can read own messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

CREATE POLICY "Staff can send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    AND sender_id = auth.uid()
  );

CREATE POLICY "Receiver can mark messages read"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());
