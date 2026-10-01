-- Owner-only wipe of all sales/returns (keeps products & stock-in movements).

CREATE OR REPLACE FUNCTION public.purge_all_sales_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refunds BIGINT;
  v_return_items BIGINT;
  v_returns BIGINT;
  v_payments BIGINT;
  v_sale_items BIGINT;
  v_movements BIGINT;
  v_sales BIGINT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can purge sales data';
  END IF;

  DELETE FROM public.refunds;
  GET DIAGNOSTICS v_refunds = ROW_COUNT;

  DELETE FROM public.return_items;
  GET DIAGNOSTICS v_return_items = ROW_COUNT;

  DELETE FROM public.returns;
  GET DIAGNOSTICS v_returns = ROW_COUNT;

  DELETE FROM public.payments;
  GET DIAGNOSTICS v_payments = ROW_COUNT;

  DELETE FROM public.sale_items;
  GET DIAGNOSTICS v_sale_items = ROW_COUNT;

  DELETE FROM public.inventory_movements
  WHERE movement_type IN ('SALE', 'RETURN');
  GET DIAGNOSTICS v_movements = ROW_COUNT;

  DELETE FROM public.sales;
  GET DIAGNOSTICS v_sales = ROW_COUNT;

  UPDATE public.products p
  SET current_quantity = COALESCE(
    (
      SELECT SUM(m.quantity)::INTEGER
      FROM public.inventory_movements m
      WHERE m.product_id = p.id
    ),
    0
  );

  PERFORM setval('public.sale_number_seq', 1, false);
  PERFORM setval('public.return_number_seq', 1, false);

  RETURN jsonb_build_object(
    'sales_deleted', v_sales,
    'sale_items_deleted', v_sale_items,
    'payments_deleted', v_payments,
    'returns_deleted', v_returns,
    'return_items_deleted', v_return_items,
    'refunds_deleted', v_refunds,
    'sale_return_movements_deleted', v_movements
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_all_sales_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_all_sales_data() TO authenticated;

COMMENT ON FUNCTION public.purge_all_sales_data() IS
  'Deletes all sales, returns, payments, and SALE/RETURN movements; rebuilds product quantities from remaining movements.';
