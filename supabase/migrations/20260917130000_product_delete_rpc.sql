-- Safe product delete (no sales history). Updates go via RLS column grant.

CREATE OR REPLACE FUNCTION public.delete_product(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can delete products';
  END IF;

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

REVOKE ALL ON FUNCTION public.delete_product(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_product(UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_product(UUID) IS
  'Deletes a product and its movements when it has never been sold or returned.';
