-- Raseeth POS — initial schema
-- Money uses NUMERIC(12,2). Never use floating-point for currency.
-- Inventory movements are the source of truth; current_quantity is a synchronized cache.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.user_role AS ENUM ('OWNER', 'SALESMAN');

CREATE TYPE public.movement_type AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT');

CREATE TYPE public.price_type AS ENUM ('RETAIL', 'WHOLESALE', 'CUSTOM');

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX profiles_role_idx ON public.profiles (role);

-- ---------------------------------------------------------------------------
-- Product code / sale number sequences
-- ---------------------------------------------------------------------------

CREATE SEQUENCE public.product_code_seq START 1 INCREMENT 1;

CREATE SEQUENCE public.sale_number_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'PRD-' || lpad(nextval('public.product_code_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.generate_sale_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'SALE-' || lpad(nextval('public.sale_number_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT NOT NULL UNIQUE DEFAULT public.generate_product_code(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  purchase_price NUMERIC(12, 2) NOT NULL CHECK (purchase_price >= 0),
  retail_price NUMERIC(12, 2) NOT NULL CHECK (retail_price >= 0),
  wholesale_price NUMERIC(12, 2) NOT NULL CHECK (wholesale_price >= 0),
  current_quantity INTEGER NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_product_code_idx ON public.products (product_code);
CREATE INDEX products_name_idx ON public.products (name);
CREATE INDEX products_category_idx ON public.products (category);

-- ---------------------------------------------------------------------------
-- Inventory movements (source of truth for stock)
-- ---------------------------------------------------------------------------

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  movement_type public.movement_type NOT NULL,
  -- Positive = stock in, negative = stock out
  quantity INTEGER NOT NULL CHECK (quantity <> 0),
  unit_cost NUMERIC(12, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  reference_id UUID,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_purchase_positive
    CHECK (movement_type <> 'PURCHASE' OR quantity > 0),
  CONSTRAINT inventory_movements_sale_negative
    CHECK (movement_type <> 'SALE' OR quantity < 0)
);

CREATE INDEX inventory_movements_product_id_idx
  ON public.inventory_movements (product_id);
CREATE INDEX inventory_movements_created_at_idx
  ON public.inventory_movements (created_at DESC);
CREATE INDEX inventory_movements_type_idx
  ON public.inventory_movements (movement_type);
CREATE INDEX inventory_movements_reference_id_idx
  ON public.inventory_movements (reference_id);

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number TEXT NOT NULL UNIQUE DEFAULT public.generate_sale_number(),
  product_id UUID NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  -- Actual unit price used at time of sale (historical, immutable intent)
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  price_type public.price_type NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  created_by UUID NOT NULL REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_total_matches_line
    CHECK (total_amount = round(unit_price * quantity, 2))
);

CREATE INDEX sales_created_at_idx ON public.sales (created_at DESC);
CREATE INDEX sales_product_id_idx ON public.sales (product_id);
CREATE INDEX sales_created_by_idx ON public.sales (created_by);
CREATE INDEX sales_sale_number_idx ON public.sales (sale_number);

-- ---------------------------------------------------------------------------
-- Messages (owner ↔ salesman)
-- ---------------------------------------------------------------------------

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(trim(message)) > 0),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT messages_no_self CHECK (sender_id <> receiver_id)
);

CREATE INDEX messages_receiver_id_idx ON public.messages (receiver_id);
CREATE INDEX messages_is_read_idx ON public.messages (is_read);
CREATE INDEX messages_created_at_idx ON public.messages (created_at DESC);
CREATE INDEX messages_sender_id_idx ON public.messages (sender_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth: create profile row when a user signs up
-- Role/name should be set by an admin or seed; default SALESMAN for safety.
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
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.user_role,
      'SALESMAN'::public.user_role
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
