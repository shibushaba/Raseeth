# Raseeth

Minimal enterprise POS and inventory for a single shop: **simple on the surface, structured underneath.**

Pilot-ready single-shop MVP: POS, inventory, payments, returns, WAC costing, owner overview, Business Pulse, universal search, activity, and messaging — with RLS + atomic RPCs.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 (black/white utility look) |
| Routing | React Router |
| Server state | TanStack Query |
| Validation | Zod |
| Backend | Supabase (Auth, Postgres, RLS, RPC) |

## Product roles

| Role | Can do | Cannot do |
| --- | --- | --- |
| **OWNER** | Read products, sales, inventory history; send/read messages | Create/edit products, change stock, record sales, change prices |
| **SALESMAN** | Create products, add stock, record sales, set prices, messages | (MVP: no deletes) |

Authorization is enforced in **Postgres RLS + SECURITY DEFINER RPCs**. The React `permissions` map is for UI only.

## Architecture

```text
src/
  components/     UI primitives + layout shell
  data/           Supabase data-access helpers (api.ts)
  features/auth/  Session + profile provider
  lib/            supabase client, roles, money helpers
  pages/          Route-level screens (stubs for Sales/Inventory/Messages)
  routes/         Router + auth/role guards
  types/          Generated-style Database types
  validation/     Zod schemas
supabase/
  migrations/     Schema, RLS, RPCs, seed helper
```

### Money & inventory rules

- Monetary columns are `NUMERIC(12,2)`. Never float.
- Historical sale `unit_price` and movement `unit_cost` are immutable snapshots.
- `inventory_movements` is the ledger; `products.current_quantity` is a synchronized cache.
- Stock never changes without a movement row.
- Sales and stock-in go through atomic RPCs (`create_sale`, `add_stock`, `create_product`).

## Database

### Tables

- `profiles` — `id` ↔ `auth.users`, `role` ∈ `OWNER` \| `SALESMAN`
- `products` — UUID `id`, human `product_code` (`PRD-000001`), prices, `current_quantity`
- `inventory_movements` — `PURCHASE` \| `SALE` \| `ADJUSTMENT`, signed `quantity`
- `sales` — `sale_number` (`SALE-000001`), `price_type`, snapshot `unit_price` / `total_amount`
- `messages` — simple owner ↔ salesman notes with `is_read`

### RLS (summary)

| Table | OWNER | SALESMAN |
| --- | --- | --- |
| profiles | SELECT staff; UPDATE own name | same |
| products | SELECT | SELECT, INSERT, UPDATE |
| sales | SELECT | SELECT (INSERT via RPC only) |
| inventory_movements | SELECT | SELECT (INSERT via RPC only) |
| messages | SELECT/INSERT own; UPDATE read as receiver | same |

Role changes on `profiles` are blocked by trigger.

### RPCs

| Function | Purpose |
| --- | --- |
| `create_product(...)` | Insert product; optional initial `PURCHASE` movement |
| `create_sale(...)` | Lock product → validate qty → sale + `SALE` movement + decrement |
| `add_stock(...)` | `PURCHASE` movement + increment + update latest `purchase_price` |
| `adjust_stock(...)` | Signed `ADJUSTMENT` with required reason |
| `seed_demo_catalog()` | Idempotent demo products/sales/messages after profiles exist |

## Authentication

1. Email/password via Supabase Auth.
2. Trigger `handle_new_user` inserts `profiles` (default role `SALESMAN` unless `raw_user_meta_data.role` is set).
3. App loads `profiles` after session; routes by role:
   - Owner → `/overview`, `/sales`, `/inventory`, `/messages`
   - Salesman → `/home`, `/sales`, `/inventory`, `/messages`

Set demo roles in SQL after creating Auth users (see below).

## Environment

Copy `.env.example` → `.env.local`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Optional (scripts only, never in Vite / never commit):

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never put the service role key in the frontend.

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Apply **all** migrations in order (`20260326000001` → `20260326000013`), via SQL Editor or:

   ```bash
   npx supabase link --project-ref YOUR_REF
   npx supabase db push
   ```

   Migrations are self-contained. They do **not** require demo/seed data.

3. Create Auth users (Dashboard → Authentication → Users) for the shop staff, e.g.:

   - Owner email / strong password
   - Salesman email / strong password

4. Assign roles (SQL editor / privileged session):

   ```sql
   UPDATE public.profiles
   SET role = 'OWNER', full_name = 'Shop Owner'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'owner@example.com');

   UPDATE public.profiles
   SET role = 'SALESMAN', full_name = 'Shop Salesman'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'salesman@example.com');
   ```

   Role updates from the client are blocked.

### Production / pilot (clean shop)

Production and pilot shops must start **empty**:

- Do **not** call `seed_demo_catalog()`
- Do **not** import E2E / SIM products
- Staff create the first product in the app

Empty UI expectations:

- Owner Overview: **No sales yet.** / **No products yet.**
- Salesman Home: **Ready to make your first sale.**
- Business Pulse on a quiet range: **All good**

### Demo / development only

Local demo credentials used by validation scripts:

| Email | Role | Password |
| --- | --- | --- |
| `owner@raseeth.demo` | OWNER | `DemoOwner123!` |
| `salesman@raseeth.demo` | SALESMAN | `DemoSalesman123!` |

Optional demo catalog (development only):

```sql
SELECT public.seed_demo_catalog();
```

Scripts (development):

```bash
node --env-file=.env.local scripts/e2e-mvp-validation.mjs
node --env-file=.env.local scripts/sim-seven-day.mjs
node --env-file=.env.local scripts/pilot-readiness.mjs
```

E2E / SIM / pilot scripts create tagged products on the shared project. They do **not** wipe existing data.

### 3. Run the app

```bash
npm run dev
```

Open the printed local URL and sign in.

### Build

```bash
npm run build
npm run preview
```

## Backup (operations)

Use Supabase project backups (Pro: daily; free tier: manual `pg_dump` / dashboard backup). Before a pilot go-live, take a fresh backup after migrations. Restore via Supabase dashboard or restore to a new project and re-point `VITE_SUPABASE_*`. No custom in-app backup in MVP.

## Design system

- Black / white / neutral only
- IBM Plex Serif for brand/display, IBM Plex Sans for UI
- Borders and typography over cards and gradients
- Color reserved for meaning (e.g. red for errors / out of stock)

## Inventory module (Phase 2)

Routes:

- `/inventory` — searchable list (owner read-only; salesman can add products)
- `/inventory/new` — create product (salesman only)
- `/inventory/:productId` — detail, prices, history; Add Stock / Adjust Stock for salesman

All quantity changes go through existing RPCs (`create_product`, `add_stock`, `adjust_stock`). The UI never writes `current_quantity` or inserts movements directly.

## Sales / POS module (Phase 3A)

Schema:

- `sales` — header (`sale_number`, `total_amount`, `created_by`, `created_at`)
- `sale_items` — lines (`product_id`, `quantity`, `unit_price` snapshot, `price_type`, `total_amount`)

Atomic RPC: `create_sale(p_items jsonb)` validates stock, applies authoritative RETAIL/WHOLESALE prices (CUSTOM uses provided price), writes sale + items + SALE movements, decrements stock — or rolls back entirely.

Routes:

- `/sales` — POS (salesman) / history (owner)
- `/sales/history` — salesman history list
- `/sales/:saleId` — read-only sale detail

Navigation: salesman **Sell**; owner **Sales** (observation only).

## Owner overview + messaging (Phase 4)

- `/overview` — today sales (amount, transactions, units), inventory attention, recent sales, unread messages
- `/messages` — single OWNER ↔ SALESMAN thread; send via `send_business_message`; open marks received messages read via `mark_messages_read`
- Nav and home show a small unread dot / count
- Dashboard RPCs: `get_today_sales_summary`, `get_inventory_summary`, `get_unread_message_count`

## Activity timeline (Phase 6)

- `/activity` — chronological feed derived from sales, purchases, adjustments, products, messages (no events table)
- Owner sees business activity; salesman sees own operational rows + allowed messages
- Limited to last 7 days / 50 items; day-grouped (Today / Yesterday / date)
- Small previews on Overview and Home

## What is intentionally not built yet

- Customers, loyalty, credit sales
- Discounts, taxes, expenses, payroll
- Quantity units of measure (kg / ltr / box / dozen)
- Push / email / WhatsApp notifications
- AI, suppliers, purchase orders, full accounting, multi-location / multi-tenant

## Assumptions

1. Single-shop MVP; no multi-tenant org table yet.
2. Demo Auth users are created manually; SQL seed only fills catalog once profiles exist.
3. Product delete is out of MVP (RESTRICT FKs keep history intact).
4. Owner profile updates of `full_name` are allowed; `role` is immutable from the client.
5. Low stock threshold is **20** units (subtle indicator); 0 is out of stock.
6. Adjust-stock optional notes are appended into the RPC `p_reason` string (no schema change).
7. Legacy single-product `sales` rows are migrated into `sale_items` by migration `20260326000005_multi_item_sales.sql`.
8. Cart money math uses integer paise on the client; server recalculates and stores authoritative totals.
9. Messaging resolves the earliest opposite-role profile (one owner ↔ one primary salesman for MVP).
10. “Today” uses the browser’s local calendar day bounds passed into `get_today_sales_summary`.
11. Phase 5 audit: product creates are RPC-only; signup role is always SALESMAN; message UPDATE limited to `is_read`; CUSTOM sale price must be &gt; 0; `seed_demo_catalog` is not callable by authenticated clients.
