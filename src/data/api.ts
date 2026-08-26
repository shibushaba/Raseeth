import { formatMoney } from '@/lib/money'
import type { BusinessPulse, BusinessSignal } from '@/lib/business-pulse'
import {
  GLOBAL_SEARCH_LIMITS,
  sanitizeSearchTerm,
  searchWhenLabel,
  sortSearchResults,
  type SearchResult,
} from '@/lib/global-search'
import { supabase } from '@/lib/supabase'
import type { ActivityItem } from '@/types/activity'
import type {
  AddStockInput,
  AdjustStockInput,
  CreateProductInput,
  CreateReturnInput,
  CreateSaleInput,
} from '@/validation/schemas'
import type {
  InventoryMovement,
  Message,
  Payment,
  Product,
  Profile,
  Refund,
  ReturnItem,
  Sale,
  SaleItem,
  SaleReturn,
  UserRole,
} from '@/types/database'

export type InventoryMovementWithActor = InventoryMovement & {
  created_by_name: string | null
}

export type SaleWithSeller = Sale & {
  created_by_name: string | null
}

export type SaleItemWithProduct = SaleItem & {
  product_name: string | null
  product_code: string | null
  returned_quantity: number
  remaining_quantity: number
}

export type SaleReturnSummary = SaleReturn & {
  created_by_name: string | null
  refund: Refund | null
}

export type SaleDetail = SaleWithSeller & {
  items: SaleItemWithProduct[]
  payments: Payment[]
  returns: SaleReturnSummary[]
  returned_total: number
  net_amount: number
}

export type ReturnItemWithProduct = ReturnItem & {
  product_name: string | null
  product_code: string | null
}

export type ReturnDetail = SaleReturn & {
  created_by_name: string | null
  sale_number: string | null
  items: ReturnItemWithProduct[]
  refund: Refund | null
}

function assertData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error('No data returned')
  return data
}

function mapCreatorName(
  creator: { full_name: string } | { full_name: string }[] | null | undefined,
): string | null {
  if (!creator) return null
  if (Array.isArray(creator)) return creator[0]?.full_name ?? null
  return creator.full_name ?? null
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return assertData(data, error)
}

/** All products, optionally filtered by name or product_code. */
export async function getProducts(search?: string): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })
    .limit(100)

  const term = search?.trim()
  if (term) {
    const safe = term.replace(/[%_,]/g, '')
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,product_code.ilike.%${safe}%`)
    }
  }

  const { data, error } = await query
  const products = assertData(data, error)
  if (!term) return products

  const needle = term.toLowerCase()
  return [...products].sort((a, b) => {
    const aExact = a.product_code.toLowerCase() === needle ? 0 : 1
    const bExact = b.product_code.toLowerCase() === needle ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    return a.name.localeCompare(b.name)
  })
}

export async function searchProducts(query: string): Promise<Product[]> {
  return getProducts(query)
}

/**
 * Universal business search — products, sales, returns.
 * Uses authenticated client queries (RLS). No profitability fields.
 */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const safe = sanitizeSearchTerm(query)
  if (!safe) return []

  const pattern = `%${safe}%`
  const fetchLimit = GLOBAL_SEARCH_LIMITS.fetch

  const [productsRes, salesRes, returnsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, product_code, current_quantity')
      .or(`name.ilike.${pattern},product_code.ilike.${pattern}`)
      .order('name', { ascending: true })
      .limit(fetchLimit),
    supabase
      .from('sales')
      .select('id, sale_number, total_amount, created_at')
      .ilike('sale_number', pattern)
      .order('created_at', { ascending: false })
      .limit(fetchLimit),
    supabase
      .from('returns')
      .select('id, return_number, total_amount, created_at')
      .ilike('return_number', pattern)
      .order('created_at', { ascending: false })
      .limit(fetchLimit),
  ])

  if (productsRes.error) throw new Error(productsRes.error.message)
  if (salesRes.error) throw new Error(salesRes.error.message)
  if (returnsRes.error) throw new Error(returnsRes.error.message)

  const products: SearchResult[] = (productsRes.data ?? []).map((p) => ({
    type: 'PRODUCT' as const,
    id: p.id,
    title: p.name,
    subtitle: p.product_code,
    meta: `${p.current_quantity} in stock`,
    href: `/inventory/${p.id}`,
  }))

  const sales: SearchResult[] = (salesRes.data ?? []).map((s) => ({
    type: 'SALE' as const,
    id: s.id,
    title: s.sale_number,
    subtitle: formatMoney(s.total_amount),
    meta: searchWhenLabel(s.created_at),
    href: `/sales/${s.id}`,
  }))

  const returns: SearchResult[] = (returnsRes.data ?? []).map((r) => ({
    type: 'RETURN' as const,
    id: r.id,
    title: r.return_number,
    subtitle: formatMoney(r.total_amount),
    meta: searchWhenLabel(r.created_at),
    href: `/returns/${r.id}`,
  }))

  const ranked = sortSearchResults([...products, ...sales, ...returns], safe)

  const limited: SearchResult[] = []
  let productCount = 0
  let saleCount = 0
  let returnCount = 0
  for (const item of ranked) {
    if (item.type === 'PRODUCT') {
      if (productCount >= GLOBAL_SEARCH_LIMITS.products) continue
      productCount += 1
    } else if (item.type === 'SALE') {
      if (saleCount >= GLOBAL_SEARCH_LIMITS.sales) continue
      saleCount += 1
    } else {
      if (returnCount >= GLOBAL_SEARCH_LIMITS.returns) continue
      returnCount += 1
    }
    limited.push(item)
  }

  return limited
}

export async function getProduct(id: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()
  return assertData(data, error)
}

export async function getInventoryHistory(
  productId: string,
): Promise<InventoryMovementWithActor[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*, creator:profiles!inventory_movements_created_by_fkey(full_name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const { creator, ...movement } = row as InventoryMovement & {
      creator: { full_name: string } | { full_name: string }[] | null
    }
    return {
      ...(movement as InventoryMovement),
      created_by_name: mapCreatorName(creator),
    }
  })
}

export async function getSales(): Promise<SaleWithSeller[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, seller:profiles!sales_created_by_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const { seller, ...sale } = row as Sale & {
      seller: { full_name: string } | { full_name: string }[] | null
    }
    return {
      ...(sale as Sale),
      created_by_name: mapCreatorName(seller),
    }
  })
}

export async function getSale(id: string): Promise<SaleDetail> {
  const { data: saleRow, error: saleError } = await supabase
    .from('sales')
    .select('*, seller:profiles!sales_created_by_fkey(full_name)')
    .eq('id', id)
    .single()

  if (saleError) throw new Error(saleError.message)
  if (!saleRow) throw new Error('Sale not found')

  const { seller, ...sale } = saleRow as Sale & {
    seller: { full_name: string } | { full_name: string }[] | null
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('sale_items')
    .select(
      '*, product:products!sale_items_product_id_fkey(name, product_code)',
    )
    .eq('sale_id', id)
    .order('created_at', { ascending: true })

  if (itemsError) throw new Error(itemsError.message)

  const payments = await getSalePayments(id)
  const returns = await getSaleReturns(id)

  const returnedBySaleItem = new Map<string, number>()
  if (returns.length > 0) {
    const { data: rItems, error: rErr } = await supabase
      .from('return_items')
      .select('sale_item_id, quantity')
      .in(
        'return_id',
        returns.map((r) => r.id),
      )
    if (rErr) throw new Error(rErr.message)
    for (const ri of rItems ?? []) {
      returnedBySaleItem.set(
        ri.sale_item_id,
        (returnedBySaleItem.get(ri.sale_item_id) ?? 0) + ri.quantity,
      )
    }
  }

  const items: SaleItemWithProduct[] = (itemRows ?? []).map((row) => {
    const { product, ...item } = row as SaleItem & {
      product:
        | { name: string; product_code: string }
        | { name: string; product_code: string }[]
        | null
    }
    const p = Array.isArray(product) ? product[0] : product
    const returned = returnedBySaleItem.get(item.id) ?? 0
    return {
      ...(item as SaleItem),
      product_name: p?.name ?? null,
      product_code: p?.product_code ?? null,
      returned_quantity: returned,
      remaining_quantity: Math.max(0, item.quantity - returned),
    }
  })

  const returnedTotal = returns.reduce((a, r) => a + Number(r.total_amount), 0)
  const netAmount =
    Math.round((Number(sale.total_amount) - returnedTotal) * 100) / 100

  return {
    ...(sale as Sale),
    created_by_name: mapCreatorName(seller),
    items,
    payments,
    returns,
    returned_total: returnedTotal,
    net_amount: netAmount,
  }
}

export async function getSalePayments(saleId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getSaleReturns(
  saleId: string,
): Promise<SaleReturnSummary[]> {
  const { data, error } = await supabase
    .from('returns')
    .select(
      '*, creator:profiles!returns_created_by_fkey(full_name), refund:refunds(*)',
    )
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const raw = row as SaleReturn & {
      creator: { full_name: string } | { full_name: string }[] | null
      refund: Refund | Refund[] | null
    }
    const { creator, refund, ...ret } = raw
    const refundRow = Array.isArray(refund) ? (refund[0] ?? null) : refund
    return {
      ...(ret as SaleReturn),
      created_by_name: mapCreatorName(creator),
      refund: refundRow,
    }
  })
}

export async function getReturn(returnId: string): Promise<ReturnDetail> {
  const { data: retRow, error: retError } = await supabase
    .from('returns')
    .select(
      '*, creator:profiles!returns_created_by_fkey(full_name), sale:sales!returns_sale_id_fkey(sale_number), refund:refunds(*)',
    )
    .eq('id', returnId)
    .single()

  if (retError) throw new Error(retError.message)
  if (!retRow) throw new Error('Return not found')

  const raw = retRow as SaleReturn & {
    creator: { full_name: string } | { full_name: string }[] | null
    sale: { sale_number: string } | { sale_number: string }[] | null
    refund: Refund | Refund[] | null
  }
  const { creator, sale, refund, ...ret } = raw
  const saleObj = Array.isArray(sale) ? sale[0] : sale
  const refundRow = Array.isArray(refund) ? (refund[0] ?? null) : refund

  const { data: itemRows, error: itemsError } = await supabase
    .from('return_items')
    .select(
      '*, product:products!return_items_product_id_fkey(name, product_code)',
    )
    .eq('return_id', returnId)
    .order('created_at', { ascending: true })

  if (itemsError) throw new Error(itemsError.message)

  const items: ReturnItemWithProduct[] = (itemRows ?? []).map((row) => {
    const { product, ...item } = row as ReturnItem & {
      product:
        | { name: string; product_code: string }
        | { name: string; product_code: string }[]
        | null
    }
    const p = Array.isArray(product) ? product[0] : product
    return {
      ...(item as ReturnItem),
      product_name: p?.name ?? null,
      product_code: p?.product_code ?? null,
    }
  })

  return {
    ...(ret as SaleReturn),
    created_by_name: mapCreatorName(creator),
    sale_number: saleObj?.sale_number ?? null,
    items,
    refund: refundRow,
  }
}

/** Atomic return + inventory restore + refund via RPC. */
export async function createReturn(
  input: CreateReturnInput,
): Promise<SaleReturn> {
  const { data, error } = await supabase.rpc('create_return', {
    p_items: input.items.map((item) => ({
      sale_item_id: item.sale_item_id,
      quantity: item.quantity,
    })),
    p_refund_method: input.refund_method,
  })
  return assertData(data, error)
}

export type MessageWithSender = Message & {
  sender_name: string | null
  sender_role: 'OWNER' | 'SALESMAN' | null
}

export async function getMessages(): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:profiles!messages_sender_id_fkey(full_name, role)')
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const { sender, ...message } = row as Message & {
      sender:
        | { full_name: string; role: 'OWNER' | 'SALESMAN' }
        | { full_name: string; role: 'OWNER' | 'SALESMAN' }[]
        | null
    }
    const s = Array.isArray(sender) ? sender[0] : sender
    return {
      ...(message as Message),
      sender_name: s?.full_name ?? null,
      sender_role: s?.role ?? null,
    }
  })
}

export async function sendMessage(input: {
  message: string
}): Promise<Message> {
  const { data, error } = await supabase.rpc('send_business_message', {
    p_message: input.message.trim(),
  })
  return assertData(data, error)
}

export async function markMessagesRead(): Promise<number> {
  const { data, error } = await supabase.rpc('mark_messages_read')
  if (error) throw new Error(error.message)
  return data ?? 0
}

export async function getUnreadMessageCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_message_count')
  if (error) throw new Error(error.message)
  return data ?? 0
}

export type TodaySalesSummary = {
  total_amount: string | number
  sale_count: number
  units_sold: number
}

export async function getTodaySalesSummary(
  dayStart: Date,
  dayEnd: Date,
): Promise<TodaySalesSummary> {
  const { data, error } = await supabase.rpc('get_today_sales_summary', {
    p_day_start: dayStart.toISOString(),
    p_day_end: dayEnd.toISOString(),
  })
  if (error) throw new Error(error.message)
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    total_amount: (raw.total_amount as string | number) ?? 0,
    sale_count: Number(raw.sale_count ?? 0),
    units_sold: Number(raw.units_sold ?? 0),
  }
}

export type InventorySummary = {
  total_products: number
  out_of_stock: number
  low_stock: number
  needs_attention: number
  recent_adjustments: number
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const { data, error } = await supabase.rpc('get_inventory_summary')
  if (error) throw new Error(error.message)
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    total_products: Number(raw.total_products ?? 0),
    out_of_stock: Number(raw.out_of_stock ?? 0),
    low_stock: Number(raw.low_stock ?? 0),
    needs_attention: Number(raw.needs_attention ?? 0),
    recent_adjustments: Number(raw.recent_adjustments ?? 0),
  }
}

export type BusinessSummary = {
  grossSales: number
  returns: number
  netSales: number
  cogs: number | null
  grossProfit: number | null
  grossMargin: number | null
  unitsSold: number
  costCoverage: number
  hasSales: boolean
}

export type ProductProfitability = {
  productId: string
  productName: string
  revenue: number
  cogs: number
  grossProfit: number
  margin: number | null
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function getBusinessSummary(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusinessSummary> {
  const { data, error } = await supabase.rpc('get_business_summary', {
    p_range_start: rangeStart.toISOString(),
    p_range_end: rangeEnd.toISOString(),
  })
  if (error) throw new Error(error.message)
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    grossSales: Number(raw.gross_sales ?? 0),
    returns: Number(raw.returns ?? 0),
    netSales: Number(raw.net_sales ?? 0),
    cogs: numOrNull(raw.cogs),
    grossProfit: numOrNull(raw.gross_profit),
    grossMargin: numOrNull(raw.gross_margin),
    unitsSold: Number(raw.units_sold ?? 0),
    costCoverage: Number(raw.cost_coverage ?? 0),
    hasSales: Boolean(raw.has_sales),
  }
}

export async function getTopProducts(
  rangeStart: Date,
  rangeEnd: Date,
  limit = 5,
): Promise<ProductProfitability[]> {
  const { data, error } = await supabase.rpc('get_top_products', {
    p_range_start: rangeStart.toISOString(),
    p_range_end: rangeEnd.toISOString(),
    p_limit: limit,
  })
  if (error) throw new Error(error.message)
  const rows = Array.isArray(data) ? data : []
  return rows.map((row) => {
    const r = row as Record<string, unknown>
    return {
      productId: String(r.product_id),
      productName: String(r.product_name ?? 'Product'),
      revenue: Number(r.revenue ?? 0),
      cogs: Number(r.cogs ?? 0),
      grossProfit: Number(r.gross_profit ?? 0),
      margin: numOrNull(r.margin),
    }
  })
}

export async function getBusinessPulse(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusinessPulse> {
  const { data, error } = await supabase.rpc('get_business_pulse', {
    p_range_start: rangeStart.toISOString(),
    p_range_end: rangeEnd.toISOString(),
  })
  if (error) throw new Error(error.message)
  const raw = (data ?? {}) as Record<string, unknown>
  const rows = Array.isArray(raw.signals) ? raw.signals : []
  const signals: BusinessSignal[] = rows.map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id ?? r.type ?? ''),
      type: r.type as BusinessSignal['type'],
      priority: Number(r.priority ?? 99),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      href: r.href ? String(r.href) : undefined,
      createdAt: r.created_at ? String(r.created_at) : undefined,
    }
  })
  return {
    signals,
    allGood: Boolean(raw.all_good) || signals.length === 0,
  }
}

export async function getRecentSales(limit = 5): Promise<SaleWithSeller[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, seller:profiles!sales_created_by_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const { seller, ...sale } = row as Sale & {
      seller: { full_name: string } | { full_name: string }[] | null
    }
    return {
      ...(sale as Sale),
      created_by_name: mapCreatorName(seller),
    }
  })
}

/** Atomic product create via RPC (optional initial PURCHASE movement). */
export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  const { data, error } = await supabase.rpc('create_product', {
    p_name: input.name,
    p_description: input.description ?? null,
    p_category: input.category ?? null,
    p_purchase_price: input.purchase_price,
    p_retail_price: input.retail_price,
    p_wholesale_price: input.wholesale_price,
    p_initial_quantity: input.initial_quantity,
  })
  return assertData(data, error)
}

/**
 * Atomic multi-item sale + payments via RPC.
 * Server validates stock, prices, payment methods/amounts, and exact payment total.
 */
export async function createSale(input: CreateSaleInput): Promise<Sale> {
  const { data, error } = await supabase.rpc('create_sale', {
    p_items: input.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      price_type: item.price_type,
    })),
    p_payments: input.payments.map((pay) => ({
      method: pay.method,
      amount: pay.amount,
    })),
  })
  return assertData(data, error)
}

/** Atomic stock in: PURCHASE movement + qty + latest purchase_price. */
export async function addStock(
  input: AddStockInput,
): Promise<InventoryMovement> {
  const { data, error } = await supabase.rpc('add_stock', {
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_unit_cost: input.unit_cost,
    p_notes: input.notes ?? null,
  })
  return assertData(data, error)
}

/** Atomic adjustment: signed qty change + required reason in movement notes. */
export async function adjustStock(
  input: AdjustStockInput,
): Promise<InventoryMovement> {
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_reason: input.reason,
  })
  return assertData(data, error)
}

function previewText(text: string, max = 80): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

/**
 * Derives a chronological activity feed from existing domain tables.
 * Respects RLS. Salesman scope filters operational rows to their own created_by.
 * SALE movements are omitted (covered by SALE events).
 */
export async function getRecentActivity(options: {
  userId: string
  role: UserRole
  limit?: number
}): Promise<ActivityItem[]> {
  const limit = options.limit ?? 50
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceIso = since.toISOString()
  const mine = options.role === 'SALESMAN'

  let salesQuery = supabase
    .from('sales')
    .select('id, sale_number, total_amount, created_at, created_by, seller:profiles!sales_created_by_fkey(full_name)')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit)

  let returnsQuery = supabase
    .from('returns')
    .select(
      'id, return_number, total_amount, created_at, created_by, creator:profiles!returns_created_by_fkey(full_name)',
    )
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit)

  let movementsQuery = supabase
    .from('inventory_movements')
    .select(
      'id, product_id, movement_type, quantity, unit_cost, notes, created_at, created_by, product:products!inventory_movements_product_id_fkey(name, product_code), creator:profiles!inventory_movements_created_by_fkey(full_name)',
    )
    .in('movement_type', ['PURCHASE', 'ADJUSTMENT'])
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit)

  let productsQuery = supabase
    .from('products')
    .select(
      'id, name, product_code, created_at, created_by, creator:profiles!products_created_by_fkey(full_name)',
    )
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (mine) {
    salesQuery = salesQuery.eq('created_by', options.userId)
    returnsQuery = returnsQuery.eq('created_by', options.userId)
    movementsQuery = movementsQuery.eq('created_by', options.userId)
    productsQuery = productsQuery.eq('created_by', options.userId)
  }

  // Messages: RLS already limits to participant rows
  const messagesQuery = supabase
    .from('messages')
    .select(
      'id, message, created_at, sender_id, receiver_id, sender:profiles!messages_sender_id_fkey(full_name, role)',
    )
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit)

  const [salesRes, returnsRes, movementsRes, productsRes, messagesRes] =
    await Promise.all([
      salesQuery,
      returnsQuery,
      movementsQuery,
      productsQuery,
      messagesQuery,
    ])

  if (salesRes.error) throw new Error(salesRes.error.message)
  if (returnsRes.error) throw new Error(returnsRes.error.message)
  if (movementsRes.error) throw new Error(movementsRes.error.message)
  if (productsRes.error) throw new Error(productsRes.error.message)
  if (messagesRes.error) throw new Error(messagesRes.error.message)

  const items: ActivityItem[] = []

  for (const row of salesRes.data ?? []) {
    const seller = mapCreatorName(
      (row as { seller?: { full_name: string } | { full_name: string }[] | null })
        .seller,
    )
    items.push({
      id: `sale:${row.id}`,
      type: 'SALE',
      createdAt: row.created_at,
      title: 'Sale',
      description: `${row.sale_number} · ${formatMoney(row.total_amount)}`,
      href: `/sales/${row.id}`,
      actor: seller
        ? { id: row.created_by, name: seller }
        : { id: row.created_by, name: '—' },
    })
  }

  for (const row of returnsRes.data ?? []) {
    const actorName = mapCreatorName(
      (row as { creator?: { full_name: string } | { full_name: string }[] | null })
        .creator,
    )
    items.push({
      id: `return:${row.id}`,
      type: 'RETURN',
      createdAt: row.created_at,
      title: 'Return',
      description: `${row.return_number} · ${formatMoney(row.total_amount)}`,
      href: `/returns/${row.id}`,
      actor: actorName
        ? { id: row.created_by, name: actorName }
        : { id: row.created_by, name: '—' },
    })
  }

  for (const row of movementsRes.data ?? []) {
    const raw = row as InventoryMovement & {
      product:
        | { name: string; product_code: string }
        | { name: string; product_code: string }[]
        | null
      creator: { full_name: string } | { full_name: string }[] | null
    }
    const product = Array.isArray(raw.product) ? raw.product[0] : raw.product
    const actorName = mapCreatorName(raw.creator)
    const qtyLabel =
      raw.quantity > 0 ? `+${raw.quantity} units` : `${raw.quantity} units`
    const productLabel = product?.name ?? 'Product'

    if (raw.movement_type === 'PURCHASE') {
      const cost =
        raw.unit_cost != null ? ` · ${formatMoney(raw.unit_cost)} each` : ''
      items.push({
        id: `movement:${raw.id}`,
        type: 'STOCK_ADDED',
        createdAt: raw.created_at,
        title: 'Stock added',
        description: `${productLabel} · ${qtyLabel}${cost}`,
        href: `/inventory/${raw.product_id}`,
        actor: actorName
          ? { id: raw.created_by, name: actorName }
          : undefined,
      })
    } else if (raw.movement_type === 'ADJUSTMENT') {
      const reason = raw.notes ? ` · ${raw.notes}` : ''
      items.push({
        id: `movement:${raw.id}`,
        type: 'STOCK_ADJUSTED',
        createdAt: raw.created_at,
        title: 'Stock adjusted',
        description: `${productLabel} · ${qtyLabel}${reason}`,
        href: `/inventory/${raw.product_id}`,
        actor: actorName
          ? { id: raw.created_by, name: actorName }
          : undefined,
      })
    }
  }

  for (const row of productsRes.data ?? []) {
    const raw = row as Product & {
      creator: { full_name: string } | { full_name: string }[] | null
    }
    const actorName = mapCreatorName(raw.creator)
    items.push({
      id: `product:${raw.id}`,
      type: 'PRODUCT_CREATED',
      createdAt: raw.created_at,
      title: 'Product created',
      description: `${raw.name} · ${raw.product_code}`,
      href: `/inventory/${raw.id}`,
      actor: actorName
        ? { id: raw.created_by, name: actorName }
        : undefined,
    })
  }

  for (const row of messagesRes.data ?? []) {
    const raw = row as Message & {
      sender:
        | { full_name: string; role: UserRole }
        | { full_name: string; role: UserRole }[]
        | null
    }
    const sender = Array.isArray(raw.sender) ? raw.sender[0] : raw.sender
    const roleLabel =
      sender?.role === 'OWNER'
        ? 'Owner'
        : sender?.role === 'SALESMAN'
          ? 'Salesman'
          : 'User'
    items.push({
      id: `message:${raw.id}`,
      type: 'MESSAGE',
      createdAt: raw.created_at,
      title: 'Message',
      description: `${roleLabel}: ${previewText(raw.message)}`,
      href: '/messages',
      actor: sender
        ? { id: raw.sender_id, name: sender.full_name }
        : undefined,
    })
  }

  items.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return items.slice(0, limit)
}
