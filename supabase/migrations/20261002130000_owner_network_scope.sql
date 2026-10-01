-- Scope owner network overview to shops they created; limit stock alerts to those shops.

CREATE OR REPLACE FUNCTION public.get_owner_network_overview(
  p_range_start TIMESTAMPTZ,
  p_range_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shops JSONB := '[]'::JSONB;
  v_total_net NUMERIC(12, 2) := 0;
  v_total_sales BIGINT := 0;
  v_best_shop_id UUID;
  v_best_shop_name TEXT;
  v_best_net NUMERIC(12, 2) := 0;
  v_attention BIGINT := 0;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can view network overview';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::JSONB ORDER BY t.net_sales DESC), '[]'::JSONB)
  INTO v_shops
  FROM (
    SELECT
      s.id,
      s.name,
      s.manager_id,
      m.full_name AS manager_name,
      COALESCE(SUM(round(si.unit_price * si.quantity, 2)), 0)
        - COALESCE((
          SELECT SUM(round(ri.unit_price * ri.quantity, 2))
          FROM public.return_items ri
          INNER JOIN public.returns r ON r.id = ri.return_id
          INNER JOIN public.sale_items si2 ON si2.id = ri.sale_item_id
          INNER JOIN public.sales s2 ON s2.id = si2.sale_id
          WHERE s2.shop_id = s.id
            AND r.created_at >= p_range_start
            AND r.created_at < p_range_end
        ), 0) AS net_sales,
      COUNT(DISTINCT sa.id) AS sale_count
    FROM public.shops s
    LEFT JOIN public.profiles m ON m.id = s.manager_id
    LEFT JOIN public.sales sa ON sa.shop_id = s.id
      AND sa.created_at >= p_range_start
      AND sa.created_at < p_range_end
    LEFT JOIN public.sale_items si ON si.sale_id = sa.id
    WHERE s.created_by = auth.uid()
    GROUP BY s.id, s.name, s.manager_id, m.full_name
  ) t;

  SELECT
    COALESCE(SUM((elem ->> 'net_sales')::NUMERIC), 0),
    COALESCE(SUM((elem ->> 'sale_count')::BIGINT), 0)
  INTO v_total_net, v_total_sales
  FROM jsonb_array_elements(v_shops) elem;

  SELECT (elem ->> 'id')::UUID, elem ->> 'name', (elem ->> 'net_sales')::NUMERIC
  INTO v_best_shop_id, v_best_shop_name, v_best_net
  FROM jsonb_array_elements(v_shops) elem
  ORDER BY (elem ->> 'net_sales')::NUMERIC DESC NULLS LAST
  LIMIT 1;

  SELECT COUNT(*) INTO v_attention
  FROM public.products p
  INNER JOIN public.shops s ON s.id = p.shop_id
  WHERE s.created_by = auth.uid()
    AND p.shop_id IS NOT NULL
    AND p.current_quantity <= 20;

  RETURN jsonb_build_object(
    'total_net_sales', round(v_total_net, 2),
    'total_sale_count', v_total_sales,
    'shop_count', jsonb_array_length(v_shops),
    'attention_count', v_attention,
    'best_shop_id', v_best_shop_id,
    'best_shop_name', v_best_shop_name,
    'best_shop_net_sales', round(COALESCE(v_best_net, 0), 2),
    'shops', v_shops
  );
END;
$$;
