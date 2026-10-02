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
