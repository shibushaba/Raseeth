-- Demo seed data
-- NOTE: Auth users cannot be created reliably from plain SQL against hosted
-- Supabase without service role. This seed:
--   1) Documents the expected demo accounts
--   2) Seeds catalog/sales/messages once the demo profile IDs exist
--
-- After creating the two users in Supabase Auth (or via CLI), update their
-- profiles.role and re-run the data section, OR use the helper below with
-- known UUIDs.
--
-- Recommended demo accounts (create in Dashboard → Authentication → Users):
--   owner@raseeth.demo    / DemoOwner123!     → role OWNER
--   salesman@raseeth.demo / DemoSalesman123!  → role SALESMAN
--
-- Then set roles:
--   UPDATE public.profiles SET role = 'OWNER', full_name = 'Demo Owner'
--     WHERE id = (SELECT id FROM auth.users WHERE email = 'owner@raseeth.demo');
--   UPDATE public.profiles SET role = 'SALESMAN', full_name = 'Demo Salesman'
--     WHERE id = (SELECT id FROM auth.users WHERE email = 'salesman@raseeth.demo');

CREATE OR REPLACE FUNCTION public.seed_demo_catalog()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salesman_id UUID;
  v_owner_id UUID;
  v_cola UUID;
  v_shirt UUID;
  v_rice UUID;
  v_sale_id UUID;
BEGIN
  SELECT id INTO v_salesman_id
  FROM public.profiles
  WHERE role = 'SALESMAN'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE role = 'OWNER'
  ORDER BY created_at
  LIMIT 1;

  IF v_salesman_id IS NULL THEN
    RAISE NOTICE 'No SALESMAN profile found — create demo auth users and set roles first.';
    RETURN;
  END IF;

  -- Idempotent: skip if products already exist
  IF EXISTS (SELECT 1 FROM public.products LIMIT 1) THEN
    RAISE NOTICE 'Products already present — skipping catalog seed.';
    RETURN;
  END IF;

  -- Reset sequences for predictable demo codes
  PERFORM setval('public.product_code_seq', 1, false);
  PERFORM setval('public.sale_number_seq', 1, false);

  INSERT INTO public.products (
    name, description, category,
    purchase_price, retail_price, wholesale_price,
    current_quantity, created_by
  )
  VALUES (
    'Coca Cola 500ml',
    'Chilled soft drink',
    'Beverages',
    35.00, 50.00, 44.00,
    0,
    v_salesman_id
  )
  RETURNING id INTO v_cola;

  INSERT INTO public.products (
    name, description, category,
    purchase_price, retail_price, wholesale_price,
    current_quantity, created_by
  )
  VALUES (
    'Blue Cotton Shirt',
    'Medium, casual fit',
    'Apparel',
    280.00, 499.00, 420.00,
    0,
    v_salesman_id
  )
  RETURNING id INTO v_shirt;

  INSERT INTO public.products (
    name, description, category,
    purchase_price, retail_price, wholesale_price,
    current_quantity, created_by
  )
  VALUES (
    'Basmati Rice 1kg',
    'Premium grain',
    'Grocery',
    90.00, 120.00, 108.00,
    0,
    v_salesman_id
  )
  RETURNING id INTO v_rice;

  -- Initial purchases (bypass RLS via SECURITY DEFINER)
  INSERT INTO public.inventory_movements
    (product_id, movement_type, quantity, unit_cost, notes, created_by)
  VALUES
    (v_cola, 'PURCHASE', 100, 35.00, 'Initial stock', v_salesman_id),
    (v_shirt, 'PURCHASE', 20, 280.00, 'Initial stock', v_salesman_id),
    (v_rice, 'PURCHASE', 50, 90.00, 'Initial stock', v_salesman_id);

  UPDATE public.products SET current_quantity = 100 WHERE id = v_cola;
  UPDATE public.products SET current_quantity = 20 WHERE id = v_shirt;
  UPDATE public.products SET current_quantity = 50 WHERE id = v_rice;

  -- Sample sale (cola × 12 @ retail 50)
  INSERT INTO public.sales (
    product_id, quantity, unit_price, price_type, total_amount, created_by
  )
  VALUES (v_cola, 12, 50.00, 'RETAIL', 600.00, v_salesman_id)
  RETURNING id INTO v_sale_id;

  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity, unit_cost, reference_id, notes, created_by
  )
  VALUES (
    v_cola, 'SALE', -12, 50.00, v_sale_id, 'Demo sale', v_salesman_id
  );

  UPDATE public.products SET current_quantity = 88 WHERE id = v_cola;

  -- Sample adjustment (damaged shirts)
  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity, notes, created_by
  )
  VALUES (v_shirt, 'ADJUSTMENT', -3, 'Damaged', v_salesman_id);

  UPDATE public.products SET current_quantity = 17 WHERE id = v_shirt;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.messages (sender_id, receiver_id, message, is_read)
    VALUES
      (
        v_owner_id,
        v_salesman_id,
        'Please check the stock of the blue shirts.',
        false
      ),
      (
        v_salesman_id,
        v_owner_id,
        'Checked. 14 units remaining after damage write-off — currently 17.',
        false
      );
  END IF;

  RAISE NOTICE 'Demo catalog seeded successfully.';
END;
$$;

REVOKE ALL ON FUNCTION public.seed_demo_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_demo_catalog() TO authenticated;

COMMENT ON FUNCTION public.seed_demo_catalog() IS
  'Seeds demo products/sales/messages after OWNER and SALESMAN profiles exist.';
