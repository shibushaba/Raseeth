-- Phase 19: OWNER-only daily trend for dashboard charts (read-only)

CREATE OR REPLACE FUNCTION public.get_business_trend(
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
  v_day TIMESTAMPTZ;
  v_day_end TIMESTAMPTZ;
  v_gross NUMERIC(12, 2);
  v_returns NUMERIC(12, 2);
  v_net NUMERIC(12, 2);
  v_cogs_sales NUMERIC(12, 2);
  v_cogs_returns NUMERIC(12, 2);
  v_cogs NUMERIC(12, 2);
  v_profit NUMERIC(12, 2);
  v_points JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only owners can view business trend';
  END IF;

  IF p_range_start IS NULL OR p_range_end IS NULL OR p_range_end <= p_range_start THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  v_day := p_range_start;

  WHILE v_day < p_range_end LOOP
    v_day_end := LEAST(v_day + interval '1 day', p_range_end);

    SELECT COALESCE(SUM(round(si.unit_price * si.quantity, 2)), 0)
    INTO v_gross
    FROM public.sale_items si
    INNER JOIN public.sales s ON s.id = si.sale_id
    WHERE s.created_at >= v_day
      AND s.created_at < v_day_end;

    SELECT COALESCE(SUM(round(ri.unit_price * ri.quantity, 2)), 0)
    INTO v_returns
    FROM public.return_items ri
    INNER JOIN public.returns r ON r.id = ri.return_id
    WHERE r.created_at >= v_day
      AND r.created_at < v_day_end;

    v_net := round(v_gross - v_returns, 2);

    SELECT COALESCE(SUM(round(si.unit_cost * si.quantity, 2)), 0)
    INTO v_cogs_sales
    FROM public.sale_items si
    INNER JOIN public.sales s ON s.id = si.sale_id
    WHERE s.created_at >= v_day
      AND s.created_at < v_day_end
      AND si.unit_cost IS NOT NULL;

    SELECT COALESCE(SUM(round(ri.unit_cost * ri.quantity, 2)), 0)
    INTO v_cogs_returns
    FROM public.return_items ri
    INNER JOIN public.returns r ON r.id = ri.return_id
    WHERE r.created_at >= v_day
      AND r.created_at < v_day_end
      AND ri.unit_cost IS NOT NULL;

    IF v_cogs_sales > 0 OR v_cogs_returns > 0 THEN
      v_cogs := round(v_cogs_sales - v_cogs_returns, 2);
      v_profit := round(v_net - v_cogs, 2);
    ELSE
      v_profit := NULL;
    END IF;

    v_points := v_points || jsonb_build_array(
      jsonb_build_object(
        'period_start', v_day,
        'net_sales', v_net,
        'gross_profit', v_profit
      )
    );

    v_day := v_day_end;
  END LOOP;

  RETURN jsonb_build_object('points', v_points);
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_trend(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_trend(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.get_business_trend(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'OWNER-only daily net sales + gross profit buckets for dashboard charts.';
