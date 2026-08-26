-- Phase 18 pilot hardening: explicit revoke of client writes on financial ledgers.
-- RPCs remain SECURITY DEFINER and continue to insert as table owner.
-- Matches payments / returns / refunds grant posture.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.sales FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.sale_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.inventory_movements FROM authenticated;

GRANT SELECT ON TABLE public.sales TO authenticated;
GRANT SELECT ON TABLE public.sale_items TO authenticated;
GRANT SELECT ON TABLE public.inventory_movements TO authenticated;

COMMENT ON TABLE public.sales IS
  'Sale headers. Client SELECT only; writes via create_sale RPC.';
COMMENT ON TABLE public.sale_items IS
  'Sale lines with price/cost snapshots. Client SELECT only; writes via create_sale RPC.';
COMMENT ON TABLE public.inventory_movements IS
  'Inventory ledger. Client SELECT only; writes via stock/sale/return RPCs.';
