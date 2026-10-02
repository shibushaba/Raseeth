-- Per-product minimum quantity for low-stock alerts.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS minimum_quantity INTEGER NOT NULL DEFAULT 5;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_minimum_quantity_nonneg;

ALTER TABLE public.products
  ADD CONSTRAINT products_minimum_quantity_nonneg CHECK (minimum_quantity >= 0);

CREATE OR REPLACE FUNCTION public.create_product(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_purchase_price NUMERIC DEFAULT 0,
  p_retail_price NUMERIC DEFAULT 0,
  p_wholesale_price NUMERIC DEFAULT 0,
  p_initial_quantity INTEGER DEFAULT 0,
  p_minimum_quantity INTEGER DEFAULT 5
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products;
  v_cost NUMERIC(12, 2);
  v_shop_id UUID;
  v_min INTEGER;
BEGIN
  IF NOT public.is_inventory_operator() THEN
    RAISE EXCEPTION 'Only the stock manager can create products';
  END IF;

  v_shop_id := public.primary_shop_id(auth.uid());
  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'No shop assigned to this user';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;

  IF p_purchase_price < 0 OR p_retail_price < 0 OR p_wholesale_price < 0 THEN
    RAISE EXCEPTION 'Prices cannot be negative';
  END IF;

  IF p_initial_quantity < 0 THEN
    RAISE EXCEPTION 'Initial quantity cannot be negative';
  END IF;

  v_min := COALESCE(p_minimum_quantity, 5);
  IF v_min < 0 THEN
    RAISE EXCEPTION 'Minimum quantity cannot be negative';
  END IF;

  v_cost := round(p_purchase_price, 2);

  INSERT INTO public.products (
    name,
    description,
    category,
    purchase_price,
    avg_unit_cost,
    retail_price,
    wholesale_price,
    current_quantity,
    minimum_quantity,
    created_by,
    shop_id
  )
  VALUES (
    trim(p_name),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    NULLIF(trim(COALESCE(p_category, '')), ''),
    v_cost,
    v_cost,
    round(p_retail_price, 2),
    round(p_wholesale_price, 2),
    0,
    v_min,
    auth.uid(),
    v_shop_id
  )
  RETURNING * INTO v_product;

  IF p_initial_quantity > 0 THEN
    PERFORM public.add_stock(v_product.id, p_initial_quantity, v_cost, 'Opening stock');
  END IF;

  RETURN v_product;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stock_alert_products(p_shop_id UUID DEFAULT NULL)
RETURNS SETOF public.products
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public.products p
  WHERE public.can_access_shop(p.shop_id)
    AND (p_shop_id IS NULL OR p.shop_id = p_shop_id)
    AND (
      p.current_quantity = 0
      OR (
        p.current_quantity > 0
        AND p.current_quantity <= p.minimum_quantity
      )
    )
  ORDER BY p.current_quantity ASC, p.name ASC
  LIMIT 500;
END;
$$;

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
    AND current_quantity <= minimum_quantity;

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

REVOKE ALL ON FUNCTION public.get_stock_alert_products(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_alert_products(UUID) TO authenticated;

-- Owner network stock attention uses per-product minimums.
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
    AND (
      p.current_quantity = 0
      OR (
        p.current_quantity > 0
        AND p.current_quantity <= p.minimum_quantity
      )
    );

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
