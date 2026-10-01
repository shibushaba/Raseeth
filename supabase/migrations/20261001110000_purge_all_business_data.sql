-- Owner-only full business reset (catalog + sales + messages).

CREATE OR REPLACE FUNCTION public.purge_all_business_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_products BIGINT;
  v_movements BIGINT;
  v_sales BIGINT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can purge business data';
  END IF;

  DELETE FROM public.refunds;
  DELETE FROM public.return_items;
  DELETE FROM public.returns;
  DELETE FROM public.payments;
  DELETE FROM public.sale_items;
  DELETE FROM public.sales;
  DELETE FROM public.inventory_movements;
  DELETE FROM public.messages;
  DELETE FROM public.products;
  GET DIAGNOSTICS v_products = ROW_COUNT;

  SELECT COUNT(*) INTO v_movements FROM public.inventory_movements;
  SELECT COUNT(*) INTO v_sales FROM public.sales;

  PERFORM setval('public.product_code_seq', 1, false);
  PERFORM setval('public.sale_number_seq', 1, false);
  PERFORM setval('public.return_number_seq', 1, false);

  RETURN jsonb_build_object(
    'products_deleted', v_products,
    'inventory_movements_remaining', v_movements,
    'sales_remaining', v_sales
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_all_business_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_all_business_data() TO authenticated;
