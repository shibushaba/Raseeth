-- Phase 4: owner dashboard summaries + secure messaging helpers

-- ---------------------------------------------------------------------------
-- Today sales summary (caller passes local-day bounds as timestamptz)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_today_sales_summary(
  p_day_start TIMESTAMPTZ,
  p_day_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(12, 2);
  v_sale_count BIGINT;
  v_units BIGINT;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_day_start IS NULL OR p_day_end IS NULL OR p_day_end <= p_day_start THEN
    RAISE EXCEPTION 'Invalid day range';
  END IF;

  SELECT
    COALESCE(SUM(s.total_amount), 0),
    COUNT(*)
  INTO v_total, v_sale_count
  FROM public.sales s
  WHERE s.created_at >= p_day_start
    AND s.created_at < p_day_end;

  SELECT COALESCE(SUM(si.quantity), 0)
  INTO v_units
  FROM public.sale_items si
  INNER JOIN public.sales s ON s.id = si.sale_id
  WHERE s.created_at >= p_day_start
    AND s.created_at < p_day_end;

  RETURN jsonb_build_object(
    'total_amount', v_total,
    'sale_count', v_sale_count,
    'units_sold', v_units
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_today_sales_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_today_sales_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ---------------------------------------------------------------------------
-- Inventory attention summary
-- ---------------------------------------------------------------------------

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

  RETURN jsonb_build_object(
    'total_products', v_total,
    'out_of_stock', v_out,
    'low_stock', v_low,
    'needs_attention', v_out + v_low
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_summary() TO authenticated;

-- ---------------------------------------------------------------------------
-- Unread message count for current user
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_unread_message_count()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.messages
  WHERE receiver_id = auth.uid()
    AND is_read = false;

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_unread_message_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count() TO authenticated;

-- ---------------------------------------------------------------------------
-- Mark all unread messages addressed to current user as read
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_messages_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.messages
  SET is_read = true
  WHERE receiver_id = auth.uid()
    AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_read() TO authenticated;

-- ---------------------------------------------------------------------------
-- Send message to the business counterpart (OWNER ↔ SALESMAN only)
-- Resolves the earliest profile of the opposite role.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_business_message(p_message TEXT)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_receiver UUID;
  v_row public.messages;
  v_text TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_text := trim(COALESCE(p_message, ''));
  IF v_text = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'Message is too long';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  IF v_role = 'OWNER' THEN
    SELECT id INTO v_receiver
    FROM public.profiles
    WHERE role = 'SALESMAN'
    ORDER BY created_at ASC
    LIMIT 1;
  ELSIF v_role = 'SALESMAN' THEN
    SELECT id INTO v_receiver
    FROM public.profiles
    WHERE role = 'OWNER'
    ORDER BY created_at ASC
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_receiver IS NULL THEN
    RAISE EXCEPTION 'No recipient available';
  END IF;

  INSERT INTO public.messages (sender_id, receiver_id, message, is_read)
  VALUES (auth.uid(), v_receiver, v_text, false)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.send_business_message(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_business_message(TEXT) TO authenticated;
