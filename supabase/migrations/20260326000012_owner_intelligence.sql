-- Phase 11: Owner intelligence — business summary + top products (OWNER only)

CREATE OR REPLACE FUNCTION public.get_business_summary(
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
  v_gross NUMERIC(12, 2) := 0;
  v_returns NUMERIC(12, 2) := 0;
  v_net NUMERIC(12, 2) := 0;
  v_units_sold BIGINT := 0;
  v_units_returned BIGINT := 0;
  v_known_sale_rev NUMERIC(12, 2) := 0;
  v_cogs_sales NUMERIC(12, 2) := 0;
  v_cogs_returns NUMERIC(12, 2) := 0;
  v_cogs NUMERIC(12, 2);
  v_profit NUMERIC(12, 2);
  v_margin NUMERIC(12, 4);
  v_coverage NUMERIC(12, 4) := 0;
  v_has_cost BOOLEAN := false;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can view business summary';
  END IF;

  IF p_range_start IS NULL OR p_range_end IS NULL OR p_range_end <= p_range_start THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  -- Gross sales + units (all sale lines in range)
  SELECT
    COALESCE(SUM(round(si.unit_price * si.quantity, 2)), 0),
    COALESCE(SUM(si.quantity), 0)
  INTO v_gross, v_units_sold
  FROM public.sale_items si
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.created_at >= p_range_start
    AND s.created_at < p_range_end;

  -- Returns (by return created_at)
  SELECT
    COALESCE(SUM(round(ri.unit_price * ri.quantity, 2)), 0),
    COALESCE(SUM(ri.quantity), 0)
  INTO v_returns, v_units_returned
  FROM public.return_items ri
  INNER JOIN public.returns r ON r.id = ri.return_id
  WHERE r.created_at >= p_range_start
    AND r.created_at < p_range_end;

  v_net := round(v_gross - v_returns, 2);

  -- Known-cost sale revenue + COGS (exclude NULL unit_cost)
  SELECT
    COALESCE(SUM(round(si.unit_price * si.quantity, 2)), 0),
    COALESCE(SUM(round(si.unit_cost * si.quantity, 2)), 0)
  INTO v_known_sale_rev, v_cogs_sales
  FROM public.sale_items si
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.created_at >= p_range_start
    AND s.created_at < p_range_end
    AND si.unit_cost IS NOT NULL;

  SELECT COALESCE(SUM(round(ri.unit_cost * ri.quantity, 2)), 0)
  INTO v_cogs_returns
  FROM public.return_items ri
  INNER JOIN public.returns r ON r.id = ri.return_id
  WHERE r.created_at >= p_range_start
    AND r.created_at < p_range_end
    AND ri.unit_cost IS NOT NULL;

  v_has_cost := v_known_sale_rev > 0 OR v_cogs_returns > 0;

  IF v_gross > 0 THEN
    v_coverage := round(v_known_sale_rev / v_gross, 4);
  ELSE
    v_coverage := 0;
  END IF;

  IF v_has_cost THEN
    v_cogs := round(v_cogs_sales - v_cogs_returns, 2);
    v_profit := round(v_net - v_cogs, 2);
    IF v_net <> 0 THEN
      v_margin := round((v_profit / v_net) * 100, 2);
    ELSE
      v_margin := NULL;
    END IF;
  ELSE
    v_cogs := NULL;
    v_profit := NULL;
    v_margin := NULL;
  END IF;

  RETURN jsonb_build_object(
    'gross_sales', v_gross,
    'returns', v_returns,
    'net_sales', v_net,
    'cogs', v_cogs,
    'gross_profit', v_profit,
    'gross_margin', v_margin,
    'units_sold', v_units_sold - v_units_returned,
    'cost_coverage', v_coverage,
    'has_sales', (v_gross > 0 OR v_returns > 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_business_summary(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'OWNER-only profitability summary for a half-open [start, end) range. NULL cost lines excluded from COGS.';

-- Top products by gross profit (known-cost lines only)
CREATE OR REPLACE FUNCTION public.get_top_products(
  p_range_start TIMESTAMPTZ,
  p_range_end TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_result JSONB;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can view product profitability';
  END IF;

  IF p_range_start IS NULL OR p_range_end IS NULL OR p_range_end <= p_range_start THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 5), 20));

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
      round(sl.revenue - COALESCE(rl.revenue, 0), 2) AS revenue,
      round(sl.cogs - COALESCE(rl.cogs, 0), 2) AS cogs,
      round(
        (sl.revenue - COALESCE(rl.revenue, 0))
        - (sl.cogs - COALESCE(rl.cogs, 0)),
        2
      ) AS gross_profit,
      CASE
        WHEN (sl.revenue - COALESCE(rl.revenue, 0)) = 0 THEN NULL
        ELSE round(
          (
            (
              (sl.revenue - COALESCE(rl.revenue, 0))
              - (sl.cogs - COALESCE(rl.cogs, 0))
            )
            / (sl.revenue - COALESCE(rl.revenue, 0))
          ) * 100,
          2
        )
      END AS margin
    FROM sale_lines sl
    LEFT JOIN return_lines rl ON rl.product_id = sl.product_id
    INNER JOIN public.products p ON p.id = sl.product_id
    ORDER BY
      (
        (sl.revenue - COALESCE(rl.revenue, 0))
        - (sl.cogs - COALESCE(rl.cogs, 0))
      ) DESC,
      p.name ASC
    LIMIT v_limit
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', ranked.product_id,
        'product_name', ranked.product_name,
        'revenue', ranked.revenue,
        'cogs', ranked.cogs,
        'gross_profit', ranked.gross_profit,
        'margin', ranked.margin
      )
      ORDER BY ranked.gross_profit DESC, ranked.product_name ASC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM ranked;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_top_products(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_products(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_top_products(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS
  'OWNER-only top products by gross profit (known-cost lines only).';

-- Extend inventory summary with recent adjustments (7 days)
CREATE OR REPLACE FUNCTION public.get_inventory_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_out BIGINT;
  v_low BIGINT;
  v_adj BIGINT;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.products;

  SELECT COUNT(*) INTO v_out
  FROM public.products
  WHERE current_quantity = 0;

  SELECT COUNT(*) INTO v_low
  FROM public.products
  WHERE current_quantity > 0
    AND current_quantity <= 20;

  SELECT COUNT(*) INTO v_adj
  FROM public.inventory_movements
  WHERE movement_type = 'ADJUSTMENT'
    AND created_at >= (now() - interval '7 days');

  RETURN jsonb_build_object(
    'total_products', v_total,
    'out_of_stock', v_out,
    'low_stock', v_low,
    'needs_attention', v_out + v_low,
    'recent_adjustments', v_adj
  );
END;
$$;
