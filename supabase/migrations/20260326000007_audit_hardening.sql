-- Phase 5 audit hardening: close client bypasses, tighten messaging, signup role

-- ---------------------------------------------------------------------------
-- 1) Signup: never trust client-supplied role metadata
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'SALESMAN'::public.user_role
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Products: client INSERT must not invent stock (RPC remains the path)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Salesman can insert products" ON public.products;

-- No authenticated INSERT policy → clients cannot insert products directly.
-- create_product SECURITY DEFINER continues to work as table owner.

REVOKE INSERT ON TABLE public.products FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3) Messages: lock UPDATE to is_read; require opposite-role recipient on INSERT
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Receiver can mark messages read" ON public.messages;
DROP POLICY IF EXISTS "Staff can send messages" ON public.messages;

CREATE OR REPLACE FUNCTION public.protect_message_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
      OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
      OR NEW.message IS DISTINCT FROM OLD.message
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Only read status can be updated on messages';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_protect_columns ON public.messages;
CREATE TRIGGER messages_protect_columns
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_message_columns();

CREATE POLICY "Receiver can mark messages read"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

REVOKE UPDATE ON TABLE public.messages FROM authenticated;
GRANT UPDATE (is_read) ON TABLE public.messages TO authenticated;

CREATE POLICY "Staff can send messages to counterpart"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff()
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS sender
      JOIN public.profiles AS receiver ON receiver.id = receiver_id
      WHERE sender.id = auth.uid()
        AND (
          (sender.role = 'OWNER' AND receiver.role = 'SALESMAN')
          OR (sender.role = 'SALESMAN' AND receiver.role = 'OWNER')
        )
    )
  );

-- Prefer RPC for app sends; keep INSERT for compatibility with policy above.
-- Seed / SECURITY DEFINER inserts still work as owner.

-- ---------------------------------------------------------------------------
-- 4) Revoke demo seed from authenticated clients
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.seed_demo_catalog() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_demo_catalog() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 5) create_sale: reject CUSTOM unit_price <= 0
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_sale(p_items JSONB)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale public.sales;
  v_item JSONB;
  v_product public.products;
  v_product_id UUID;
  v_quantity INTEGER;
  v_price_type public.price_type;
  v_unit_price NUMERIC(12, 2);
  v_line_total NUMERIC(12, 2);
  v_sale_total NUMERIC(12, 2) := 0;
  v_idx INTEGER := 0;
BEGIN
  IF NOT public.is_salesman() THEN
    RAISE EXCEPTION 'Only salesmen can create sales';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sale cart cannot be empty';
  END IF;

  IF (
    SELECT COUNT(*) FROM jsonb_array_elements(p_items)
  ) <> (
    SELECT COUNT(DISTINCT value ->> 'product_id') FROM jsonb_array_elements(p_items) AS t(value)
  ) THEN
    RAISE EXCEPTION 'Duplicate products in cart';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
    ORDER BY (value ->> 'product_id')
  LOOP
    v_idx := v_idx + 1;

    BEGIN
      v_product_id := (v_item ->> 'product_id')::UUID;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid product on cart line %', v_idx;
    END;

    v_quantity := COALESCE((v_item ->> 'quantity')::INTEGER, 0);
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Sale quantity must be positive';
    END IF;

    BEGIN
      v_price_type := (v_item ->> 'price_type')::public.price_type;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid price type on cart line %', v_idx;
    END;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    IF v_product.current_quantity < v_quantity THEN
      RAISE EXCEPTION
        'INSUFFICIENT_STOCK|%|%|%',
        v_product.name,
        v_product.current_quantity,
        v_quantity;
    END IF;

    IF v_price_type = 'RETAIL' THEN
      v_unit_price := v_product.retail_price;
    ELSIF v_price_type = 'WHOLESALE' THEN
      v_unit_price := v_product.wholesale_price;
    ELSE
      BEGIN
        v_unit_price := round(COALESCE((v_item ->> 'unit_price')::NUMERIC, -1), 2);
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Invalid custom unit price';
      END;
      IF v_unit_price <= 0 THEN
        RAISE EXCEPTION 'Custom unit price must be greater than zero';
      END IF;
    END IF;

    v_sale_total := v_sale_total + round(v_unit_price * v_quantity, 2);
  END LOOP;

  INSERT INTO public.sales (total_amount, created_by)
  VALUES (round(v_sale_total, 2), auth.uid())
  RETURNING * INTO v_sale;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items) AS t(value)
    ORDER BY (value ->> 'product_id')
  LOOP
    v_product_id := (v_item ->> 'product_id')::UUID;
    v_quantity := (v_item ->> 'quantity')::INTEGER;
    v_price_type := (v_item ->> 'price_type')::public.price_type;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF v_price_type = 'RETAIL' THEN
      v_unit_price := v_product.retail_price;
    ELSIF v_price_type = 'WHOLESALE' THEN
      v_unit_price := v_product.wholesale_price;
    ELSE
      v_unit_price := round((v_item ->> 'unit_price')::NUMERIC, 2);
      IF v_unit_price <= 0 THEN
        RAISE EXCEPTION 'Custom unit price must be greater than zero';
      END IF;
    END IF;

    IF v_product.current_quantity < v_quantity THEN
      RAISE EXCEPTION
        'INSUFFICIENT_STOCK|%|%|%',
        v_product.name,
        v_product.current_quantity,
        v_quantity;
    END IF;

    v_line_total := round(v_unit_price * v_quantity, 2);

    INSERT INTO public.sale_items (
      sale_id, product_id, quantity, unit_price, price_type, total_amount
    )
    VALUES (
      v_sale.id, v_product_id, v_quantity, v_unit_price, v_price_type, v_line_total
    );

    INSERT INTO public.inventory_movements (
      product_id, movement_type, quantity, unit_cost, reference_id, notes, created_by
    )
    VALUES (
      v_product_id,
      'SALE',
      -v_quantity,
      v_unit_price,
      v_sale.id,
      'Sale ' || v_sale.sale_number,
      auth.uid()
    );

    UPDATE public.products
    SET current_quantity = current_quantity - v_quantity
    WHERE id = v_product_id;
  END LOOP;

  RETURN v_sale;
END;
$$;
