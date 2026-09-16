-- Phone-based login: profiles.phone maps to auth.users.email for sign-in.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_phone_digits(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(d) = 12 AND left(d, 2) = '91' THEN substring(d FROM 3 FOR 10)
    ELSE d
  END
  FROM (
    SELECT regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g') AS d
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.get_email_for_phone_login(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_digits text;
  v_email text;
BEGIN
  v_digits := public.normalize_phone_digits(p_phone);

  IF v_digits IS NULL OR length(v_digits) <> 10 THEN
    RETURN NULL;
  END IF;

  SELECT u.email
  INTO v_email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE public.normalize_phone_digits(p.phone) = v_digits
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_for_phone_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_for_phone_login(text) TO anon, authenticated;

-- Demo accounts (safe to re-run).
UPDATE public.profiles p
SET phone = '9876500001'
FROM auth.users u
WHERE p.id = u.id AND u.email = 'owner@raseeth.demo';

UPDATE public.profiles p
SET phone = '9876500002'
FROM auth.users u
WHERE p.id = u.id AND u.email = 'salesman@raseeth.demo';
