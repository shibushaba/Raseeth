-- Managers must pass is_staff() for profile RLS, products, sales, messages, etc.

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner() OR public.is_salesman() OR public.is_manager();
$$;

COMMENT ON FUNCTION public.is_staff() IS
  'OWNER, MANAGER, or SALESMAN — used for staff RLS and messaging.';

-- Demo manager phone (safe to re-run).
UPDATE public.profiles p
SET phone = '9876500003'
FROM auth.users u
WHERE p.id = u.id AND u.email = 'manager@raseeth.demo';
