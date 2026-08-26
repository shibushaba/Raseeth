-- Phase 13: Business Pulse — OWNER-only attention signals (deterministic, no AI)
-- Thresholds (keep in sync with src/lib/business-pulse.ts):
--   low stock: qty > 0 AND qty <= 20
--   return spike: current >= 500, previous >= 200, current > previous * 1.5
--   margin drop: coverage >= 0.5 both periods, known net >= 500 both,
--                current_margin < previous_margin - 5
--   inventory activity: ADJUSTMENT count in range >= 3
--   max visible signals: 3

CREATE OR REPLACE FUNCTION public.get_business_pulse(
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
  v_duration INTERVAL;
  v_prev_start TIMESTAMPTZ;
  v_prev_end TIMESTAMPTZ;

  v_out_count BIGINT := 0;
  v_out_name TEXT;
  v_out_id UUID;
  v_low_count BIGINT := 0;
  v_low_name TEXT;
  v_low_id UUID;
  v_low_qty INTEGER;

  v_ret_cur NUMERIC(12, 2) := 0;
  v_ret_prev NUMERIC(12, 2) := 0;
  v_ret_pct NUMERIC(12, 2);

  v_gross_cur NUMERIC(12, 2) := 0;
  v_gross_prev NUMERIC(12, 2) := 0;
  v_known_rev_cur NUMERIC(12, 2) := 0;
  v_known_rev_prev NUMERIC(12, 2) := 0;
  v_cogs_sales_cur NUMERIC(12, 2) := 0;
  v_cogs_sales_prev NUMERIC(12, 2) := 0;
  v_cogs_ret_cur NUMERIC(12, 2) := 0;
  v_cogs_ret_prev NUMERIC(12, 2) := 0;
  v_net_cur NUMERIC(12, 2) := 0;
  v_net_prev NUMERIC(12, 2) := 0;
  v_cogs_cur NUMERIC(12, 2);
  v_cogs_prev NUMERIC(12, 2);
  v_profit_cur NUMERIC(12, 2);
  v_profit_prev NUMERIC(12, 2);
  v_margin_cur NUMERIC(12, 2);
  v_margin_prev NUMERIC(12, 2);
  v_coverage_cur NUMERIC(12, 4) := 0;
  v_coverage_prev NUMERIC(12, 4) := 0;
  v_margin_drop NUMERIC(12, 2);

  v_adj_count BIGINT := 0;

  v_top_id UUID;
  v_top_name TEXT;
  v_top_profit NUMERIC(12, 2);

  v_signals JSONB := '[]'::jsonb;
  v_signal JSONB;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can view business pulse';
  END IF;

  IF p_range_start IS NULL OR p_range_end IS NULL OR p_range_end <= p_range_start THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  v_duration := p_range_end - p_range_start;
  v_prev_end := p_range_start;
  v_prev_start := p_range_start - v_duration;

  -- --- Stock snapshot (current, not range-bound) ---
  SELECT COUNT(*) INTO v_out_count
  FROM public.products
  WHERE current_quantity = 0;

  IF v_out_count = 1 THEN
    SELECT id, name INTO v_out_id, v_out_name
    FROM public.products
    WHERE current_quantity = 0
    ORDER BY name ASC
    LIMIT 1;
  END IF;

  SELECT COUNT(*) INTO v_low_count
  FROM public.products
  WHERE current_quantity > 0
    AND current_quantity <= 20;

  IF v_low_count = 1 THEN
    SELECT id, name, current_quantity
    INTO v_low_id, v_low_name, v_low_qty
    FROM public.products
    WHERE current_quantity > 0
      AND current_quantity <= 20
    ORDER BY name ASC
    LIMIT 1;
  END IF;

  -- --- Return totals (current vs previous comparable period) ---
  SELECT COALESCE(SUM(round(ri.unit_price * ri.quantity, 2)), 0)
  INTO v_ret_cur
  FROM public.return_items ri
  INNER JOIN public.returns r ON r.id = ri.return_id
  WHERE r.created_at >= p_range_start
    AND r.created_at < p_range_end;

  SELECT COALESCE(SUM(round(ri.unit_price * ri.quantity, 2)), 0)
  INTO v_ret_prev
  FROM public.return_items ri
  INNER JOIN public.returns r ON r.id = ri.return_id
  WHERE r.created_at >= v_prev_start
    AND r.created_at < v_prev_end;

  -- --- Margin inputs (mirrors get_business_summary known-cost rules) ---
  SELECT
    COALESCE(SUM(round(si.unit_price * si.quantity, 2)), 0),
    COALESCE(SUM(round(si.unit_price * si.quantity, 2)) FILTER (WHERE si.unit_cost IS NOT NULL), 0),
    COALESCE(SUM(round(si.unit_cost * si.quantity, 2)) FILTER (WHERE si.unit_cost IS NOT NULL), 0)
  INTO v_gross_cur, v_known_rev_cur, v_cogs_sales_cur
  FROM public.sale_items si
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.created_at >= p_range_start
    AND s.created_at < p_range_end;

  SELECT COALESCE(SUM(round(ri.unit_cost * ri.quantity, 2)), 0)
  INTO v_cogs_ret_cur
  FROM public.return_items ri
  INNER JOIN public.returns r ON r.id = ri.return_id
  WHERE r.created_at >= p_range_start
    AND r.created_at < p_range_end
    AND ri.unit_cost IS NOT NULL;

  v_net_cur := round(v_gross_cur - v_ret_cur, 2);
  IF v_gross_cur > 0 THEN
    v_coverage_cur := round(v_known_rev_cur / v_gross_cur, 4);
  END IF;
  IF v_known_rev_cur > 0 OR v_cogs_ret_cur > 0 THEN
    v_cogs_cur := round(v_cogs_sales_cur - v_cogs_ret_cur, 2);
    v_profit_cur := round(v_net_cur - v_cogs_cur, 2);
    IF v_net_cur <> 0 THEN
      v_margin_cur := round((v_profit_cur / v_net_cur) * 100, 2);
    END IF;
  END IF;

  SELECT
    COALESCE(SUM(round(si.unit_price * si.quantity, 2)), 0),
    COALESCE(SUM(round(si.unit_price * si.quantity, 2)) FILTER (WHERE si.unit_cost IS NOT NULL), 0),
    COALESCE(SUM(round(si.unit_cost * si.quantity, 2)) FILTER (WHERE si.unit_cost IS NOT NULL), 0)
  INTO v_gross_prev, v_known_rev_prev, v_cogs_sales_prev
  FROM public.sale_items si
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.created_at >= v_prev_start
    AND s.created_at < v_prev_end;

  SELECT COALESCE(SUM(round(ri.unit_cost * ri.quantity, 2)), 0)
  INTO v_cogs_ret_prev
  FROM public.return_items ri
  INNER JOIN public.returns r ON r.id = ri.return_id
  WHERE r.created_at >= v_prev_start
    AND r.created_at < v_prev_end
    AND ri.unit_cost IS NOT NULL;

  v_net_prev := round(v_gross_prev - v_ret_prev, 2);
  IF v_gross_prev > 0 THEN
    v_coverage_prev := round(v_known_rev_prev / v_gross_prev, 4);
  END IF;
  IF v_known_rev_prev > 0 OR v_cogs_ret_prev > 0 THEN
    v_cogs_prev := round(v_cogs_sales_prev - v_cogs_ret_prev, 2);
    v_profit_prev := round(v_net_prev - v_cogs_prev, 2);
    IF v_net_prev <> 0 THEN
      v_margin_prev := round((v_profit_prev / v_net_prev) * 100, 2);
    END IF;
  END IF;

  -- --- Adjustments in selected range ---
  SELECT COUNT(*) INTO v_adj_count
  FROM public.inventory_movements
  WHERE movement_type = 'ADJUSTMENT'
    AND created_at >= p_range_start
    AND created_at < p_range_end;

  -- --- Top product by gross profit (known-cost only) ---
  WITH sale_lines AS (
    SELECT
      si.product_id,
      SUM(round(si.unit_price * si.quantity, 2)) AS revenue,
      SUM(round(si.unit_cost * si.quantity, 2)) AS cogs
    FROM public.sale_items si
    INNER JOIN public.sales s ON s.id = si.sale_id
    WHERE s.created_at >= p_range_start
      AND s.created_at < p_range_end
      AND si.unit_cost IS NOT NULL
    GROUP BY si.product_id
  ),
  return_lines AS (
    SELECT
      ri.product_id,
      SUM(round(ri.unit_price * ri.quantity, 2)) AS revenue,
      SUM(round(ri.unit_cost * ri.quantity, 2)) AS cogs
    FROM public.return_items ri
    INNER JOIN public.returns r ON r.id = ri.return_id
    WHERE r.created_at >= p_range_start
      AND r.created_at < p_range_end
      AND ri.unit_cost IS NOT NULL
    GROUP BY ri.product_id
  ),
  ranked AS (
    SELECT
      sl.product_id,
      p.name AS product_name,
      round(
        (sl.revenue - COALESCE(rl.revenue, 0))
        - (sl.cogs - COALESCE(rl.cogs, 0)),
        2
      ) AS gross_profit
    FROM sale_lines sl
    LEFT JOIN return_lines rl ON rl.product_id = sl.product_id
    INNER JOIN public.products p ON p.id = sl.product_id
    ORDER BY
      (
        (sl.revenue - COALESCE(rl.revenue, 0))
        - (sl.cogs - COALESCE(rl.cogs, 0))
      ) DESC,
      p.name ASC
    LIMIT 1
  )
  SELECT product_id, product_name, gross_profit
  INTO v_top_id, v_top_name, v_top_profit
  FROM ranked;

  -- Build signals in priority order
  IF v_out_count = 1 AND v_out_name IS NOT NULL THEN
    v_signal := jsonb_build_object(
      'id', 'out_of_stock',
      'type', 'OUT_OF_STOCK',
      'priority', 1,
      'title', 'OUT OF STOCK',
      'description', v_out_name || ' is out of stock.',
      'href', '/inventory'
    );
    v_signals := v_signals || jsonb_build_array(v_signal);
  ELSIF v_out_count > 1 THEN
    v_signal := jsonb_build_object(
      'id', 'out_of_stock',
      'type', 'OUT_OF_STOCK',
      'priority', 1,
      'title', 'OUT OF STOCK',
      'description', v_out_count::text || ' products are out of stock.',
      'href', '/inventory'
    );
    v_signals := v_signals || jsonb_build_array(v_signal);
  END IF;

  IF v_low_count = 1 AND v_low_name IS NOT NULL THEN
    v_signal := jsonb_build_object(
      'id', 'low_stock',
      'type', 'LOW_STOCK',
      'priority', 2,
      'title', 'LOW STOCK',
      'description', v_low_name || ' has ' || v_low_qty::text || ' units left.',
      'href', '/inventory/' || v_low_id::text
    );
    v_signals := v_signals || jsonb_build_array(v_signal);
  ELSIF v_low_count > 1 THEN
    v_signal := jsonb_build_object(
      'id', 'low_stock',
      'type', 'LOW_STOCK',
      'priority', 2,
      'title', 'LOW STOCK',
      'description', v_low_count::text || ' products are running low.',
      'href', '/inventory'
    );
    v_signals := v_signals || jsonb_build_array(v_signal);
  END IF;

  IF v_ret_cur >= 500
     AND v_ret_prev >= 200
     AND v_ret_cur > round(v_ret_prev * 1.5, 2) THEN
    v_ret_pct := round(((v_ret_cur - v_ret_prev) / v_ret_prev) * 100, 0);
    v_signal := jsonb_build_object(
      'id', 'return_spike',
      'type', 'RETURN_SPIKE',
      'priority', 3,
      'title', 'RETURNS UP',
      'description', 'Returns are ' || v_ret_pct::text || '% higher than the previous period.',
      'href', '/sales'
    );
    v_signals := v_signals || jsonb_build_array(v_signal);
  END IF;

  IF v_margin_cur IS NOT NULL
     AND v_margin_prev IS NOT NULL
     AND v_coverage_cur >= 0.5
     AND v_coverage_prev >= 0.5
     AND v_net_cur >= 500
     AND v_net_prev >= 500
     AND v_known_rev_cur >= 500
     AND v_known_rev_prev >= 500
     AND v_margin_cur < (v_margin_prev - 5) THEN
    v_margin_drop := round(v_margin_prev - v_margin_cur, 1);
    v_signal := jsonb_build_object(
      'id', 'margin_drop',
      'type', 'MARGIN_DROP',
      'priority', 4,
      'title', 'MARGIN DOWN',
      'description', 'Gross margin is down ' || v_margin_drop::text || ' percentage points.',
      'href', '/overview'
    );
    v_signals := v_signals || jsonb_build_array(v_signal);
  END IF;

  IF v_adj_count >= 3 THEN
    v_signal := jsonb_build_object(
      'id', 'inventory_activity',
      'type', 'INVENTORY_ACTIVITY',
      'priority', 5,
      'title', 'INVENTORY ACTIVITY',
      'description', v_adj_count::text || ' stock adjustments were recorded recently.',
      'href', '/activity'
    );
    v_signals := v_signals || jsonb_build_array(v_signal);
  END IF;

  IF v_top_id IS NOT NULL AND v_top_profit IS NOT NULL THEN
    v_signal := jsonb_build_object(
      'id', 'top_product',
      'type', 'TOP_PRODUCT',
      'priority', 6,
      'title', 'TOP PRODUCT',
      'description', v_top_name || ' generated the most gross profit this period. ₹'
        || to_char(v_top_profit, 'FM999999990.00') || ' gross profit',
      'href', '/inventory/' || v_top_id::text
    );
    v_signals := v_signals || jsonb_build_array(v_signal);
  END IF;

  -- Cap at 3 highest-priority signals
  SELECT COALESCE(jsonb_agg(sig ORDER BY (sig->>'priority')::int ASC), '[]'::jsonb)
  INTO v_signals
  FROM (
    SELECT value AS sig
    FROM jsonb_array_elements(v_signals) AS t(value)
    ORDER BY (value->>'priority')::int ASC
    LIMIT 3
  ) limited;

  RETURN jsonb_build_object(
    'signals', v_signals,
    'all_good', jsonb_array_length(v_signals) = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_pulse(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_pulse(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_business_pulse(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'OWNER-only Business Pulse signals for a half-open [start, end) range with comparable previous period. Deterministic; no AI.';
