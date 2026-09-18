-- Must run in its own migration (PostgreSQL enum safety).
ALTER TYPE public.user_role ADD VALUE 'MANAGER';
