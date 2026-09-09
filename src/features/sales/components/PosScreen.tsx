import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ShoppingCart, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PortalHeader } from '@/components/layout/portal/PortalHeader'
import { PortalTabs } from '@/components/layout/portal/PortalTabs'
import { useAuth } from '@/features/auth/AuthProvider'
import { createSale, getProducts } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import {
  productToCartSeed,
  unitPriceForType,
  type CartItem,
} from '@/features/sales/cart'
import {
  PaymentPanel,
  buildPaymentsFromMode,
  paymentStatus,
  type PaymentMode,
  type SplitPaymentRow,
} from '@/features/sales/components/PaymentPanel'
import { PosProductGrid } from '@/features/sales/components/PosProductGrid'
import { PosRecentSales } from '@/features/sales/components/PosRecentSales'
import { localDayBounds } from '@/lib/datetime'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney, lineTotal, sumCartTotal, toMoneyString } from '@/lib/money'
import { uniqueCategories } from '@/lib/product-categories'
import { printSaleReceipt } from '@/lib/print-sale-receipt'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'
import type { PaymentMethod, Product, Sale } from '@/types/database'
import { createSaleSchema } from '@/validation/schemas'

type PosScreen = 'browse' | 'cart' | 'payment' | 'receipt'
type BrowseTab = 'products' | 'sales'

type CompletedSale = Sale & {
  payments: Array<{ method: PaymentMethod; amount: number }>
  receiptItems: Array<{
    name: string
    product_code: string
    quantity: number
    unit_price: number
    line_total: number
  }>
  sold_by_name?: string | null
}

async function invalidateAfterSale(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const { dayKey } = localDayBounds()
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sales.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryHistory.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.summary }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.sales.todaySummary(dayKey),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.business.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity.all }),
  ])
}

function cartTotal(cart: CartItem[]) {
  return sumCartTotal(
    cart.map((item) => ({
      unit_price: unitPriceForType(item),
      quantity: item.quantity,
    })),
  )
}

export function PosScreen() {
  const queryClient = useQueryClient()
  const { profile, signOut } = useAuth()
  const [screen, setScreen] = useState<PosScreen>('browse')
  const [browseTab, setBrowseTab] = useState<BrowseTab>('products')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search.trim())
  const [cart, setCart] = useState<CartItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<CompletedSale | null>(null)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI')
  const [splitRows, setSplitRows] = useState<SplitPaymentRow[]>([
    { id: '1', method: 'CASH', amount: '' },
    { id: '2', method: 'UPI', amount: '' },
  ])

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(deferredSearch),
    queryFn: () => getProducts(deferredSearch),
  })

  const allProducts = productsQuery.data ?? []
  const categories = useMemo(
    () => ['All', ...uniqueCategories(allProducts)],
    [allProducts],
  )

  const filteredProducts = useMemo(() => {
    let list = allProducts
    if (category && category !== 'All') {
      list = list.filter(
        (p) => p.category?.toLowerCase() === category.toLowerCase(),
      )
    }
    return list
  }, [allProducts, category])

  const total = useMemo(() => cartTotal(cart), [cart])
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const cartInvalid = cart.some(
    (item) =>
      item.quantity < 1 ||
      item.quantity > item.available_stock ||
      (item.price_type === 'CUSTOM' && unitPriceForType(item) <= 0),
  )

  const payCheck = paymentStatus(paymentMode, total, splitRows)

  const mutation = useMutation({
    mutationFn: createSale,
    onSuccess: async (sale, variables) => {
      const receiptItems = cart.map((item) => {
        const unitPrice = unitPriceForType(item)
        return {
          name: item.name,
          product_code: item.product_code,
          quantity: item.quantity,
          unit_price: unitPrice,
          line_total: lineTotal(unitPrice, item.quantity),
        }
      })
      setCompleted({
        ...sale,
        payments: variables.payments.map((p) => ({
          method: p.method,
          amount: p.amount,
        })),
        receiptItems,
        sold_by_name: profile?.full_name ?? null,
      })
      setCart([])
      setSearch('')
      setError(null)
      setPaymentMode('UPI')
      setSplitRows([
        { id: '1', method: 'CASH', amount: '' },
        { id: '2', method: 'UPI', amount: '' },
      ])
      setScreen('receipt')
      await invalidateAfterSale(queryClient)
    },
    onError: (err) => {
      logTechnicalError('createSale', err)
      setError(
        toUserMessage(err, 'Unable to complete payment. Please try again.'),
      )
    },
  })

  const canComplete =
    cart.length > 0 && !cartInvalid && payCheck.valid && !mutation.isPending

  function addProduct(product: Product) {
    setError(null)
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id)
      if (existing) {
        const nextQty = existing.quantity + 1
        if (nextQty > product.current_quantity) {
          setError(
            `Not enough ${product.name} in stock. Available: ${product.current_quantity}.`,
          )
          return prev
        }
        return prev.map((i) =>
          i.product_id === product.id
            ? {
                ...i,
                quantity: nextQty,
                available_stock: product.current_quantity,
                retail_price: productToCartSeed(product).retail_price,
                wholesale_price: productToCartSeed(product).wholesale_price,
              }
            : i,
        )
      }
      if (product.current_quantity <= 0) {
        setError(`${product.name} is out of stock.`)
        return prev
      }
      return [...prev, { ...productToCartSeed(product), quantity: 1 }]
    })
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product_id !== productId))
      return
    }
    setCart((prev) =>
      prev.map((i) => {
        if (i.product_id !== productId) return i
        const clamped = Math.min(i.available_stock, Math.max(1, qty))
        return { ...i, quantity: clamped }
      }),
    )
  }

  function completeSale() {
    setError(null)
    for (const item of cart) {
      if (item.quantity > item.available_stock) {
        setError(
          `Not enough ${item.name} in stock. Available: ${item.available_stock}.`,
        )
        return
      }
    }
    const status = paymentStatus(paymentMode, total, splitRows)
    if (!status.valid) {
      setError(status.message)
      return
    }
    const payload = {
      items: cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(toMoneyString(unitPriceForType(item))),
        price_type: item.price_type,
      })),
      payments: buildPaymentsFromMode(paymentMode, total, splitRows).map(
        (p) => ({
          method: p.method,
          amount: Number(toMoneyString(p.amount)),
        }),
      ),
    }
    const parsed = createSaleSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Payment is invalid.')
      return
    }
    mutation.mutate(parsed.data)
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Cashier'

  if (screen === 'receipt' && completed) {
    const paid = completed.payments.reduce((a, p) => a + p.amount, 0)

    function handlePrint() {
      const ok = printSaleReceipt({
        sale_number: completed!.sale_number,
        created_at: completed!.created_at,
        total_amount: Number(completed!.total_amount),
        items: completed!.receiptItems,
        payments: completed!.payments,
        sold_by: completed!.sold_by_name,
      })
      if (!ok) {
        window.alert('Unable to open print window. Allow pop-ups and try again.')
      }
    }

    return (
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col bg-emerald-50">
        <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-6">
          <div className="mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-10 w-10 text-white" aria-hidden />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-emerald-700">
              Payment Successful!
            </h2>
            <p className="mt-1 text-sm font-medium text-gray-500">
              {completed.sale_number}
            </p>
          </div>

          <div className="w-full overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
            <div className="bg-violet-600 px-5 py-4 text-white">
              <div className="text-xs font-semibold opacity-70">Receipt</div>
              <div className="mt-0.5 text-xs opacity-60">
                {new Date(completed.created_at).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="space-y-4 p-4">
              {completed.receiptItems.map((item) => (
                <div
                  key={item.product_code}
                  className="border-b border-dashed border-gray-100 pb-3 last:border-0 last:pb-0"
                >
                  <div className="text-sm font-bold text-gray-800">
                    {item.name}
                  </div>
                  <div className="mb-1 text-xs text-gray-400">
                    Qty: {item.quantity} × {formatMoney(item.unit_price)}
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-gray-800">
                    <span>Final</span>
                    <span className="text-violet-700">
                      {formatMoney(item.line_total)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="space-y-1 border-t-2 border-dashed border-gray-200 pt-3">
                <div className="flex justify-between">
                  <span className="font-extrabold text-gray-800">Total</span>
                  <span className="text-lg font-black text-violet-700">
                    {formatMoney(completed.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Payment</span>
                  <span className="text-xs font-bold">
                    {completed.payments
                      .map((p) => PAYMENT_METHOD_LABEL[p.method])
                      .join(', ')}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Paid</span>
                  <span className="font-bold">{formatMoney(paid)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-emerald-100 bg-white p-4">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full rounded-2xl border-2 border-violet-600 py-3.5 text-sm font-extrabold text-violet-600"
          >
            Print Receipt
          </button>
          <button
            type="button"
            onClick={() => {
              setCompleted(null)
              setScreen('browse')
              mutation.reset()
            }}
            className="w-full rounded-2xl bg-violet-600 py-3.5 text-sm font-extrabold text-white active:bg-violet-700"
          >
            New Sale
          </button>
          <Link
            to={`/sales/${completed.id}`}
            className="block w-full rounded-2xl py-3 text-center text-sm font-bold text-violet-600"
          >
            View sale details
          </Link>
        </div>
      </div>
    )
  }

  if (screen === 'payment') {
    return (
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
        <div className="flex items-center gap-3 border-b border-violet-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setScreen('cart')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-700"
            aria-label="Back to cart"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="font-extrabold text-gray-800">Payment</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <PaymentPanel
            saleTotal={total}
            mode={paymentMode}
            onModeChange={setPaymentMode}
            splitRows={splitRows}
            onSplitRowsChange={setSplitRows}
          />
          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>
          ) : null}
        </div>

        <div className="border-t border-violet-100 bg-white p-4">
          <button
            type="button"
            disabled={!canComplete}
            onClick={completeSale}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-extrabold text-white shadow-md active:bg-emerald-600 disabled:opacity-40"
          >
            {mutation.isPending
              ? 'Processing…'
              : `Confirm Payment · ${formatMoney(total)}`}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'cart') {
    return (
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
        <div className="flex items-center gap-3 border-b border-violet-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setScreen('browse')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-700"
            aria-label="Back to products"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="font-extrabold text-gray-800">Cart</h2>
            <p className="text-xs text-gray-400">
              {cart.length} item{cart.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
            <ShoppingCart className="h-12 w-12" aria-hidden />
            <p className="font-semibold">Cart is empty</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {cart.map((item) => {
                const unit = unitPriceForType(item)
                const line = lineTotal(unit, item.quantity)
                return (
                  <div
                    key={item.product_id}
                    className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-gray-800">
                          {item.name}
                        </div>
                        <div className="mt-0.5 text-sm font-extrabold text-violet-600">
                          {formatMoney(unit)} / unit
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-red-400">
                          {formatMoney(item.wholesale_price)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCart((prev) =>
                            prev.filter((i) => i.product_id !== item.product_id),
                          )
                        }
                        className="text-red-400"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center">
                      <div className="flex items-center rounded-xl bg-violet-50">
                        <button
                          type="button"
                          onClick={() =>
                            updateQty(item.product_id, item.quantity - 1)
                          }
                          className="flex h-9 w-9 items-center justify-center text-lg font-extrabold text-violet-700"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-extrabold text-gray-800">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQty(item.product_id, item.quantity + 1)
                          }
                          className="flex h-9 w-9 items-center justify-center text-lg font-extrabold text-violet-700"
                        >
                          +
                        </button>
                      </div>
                      <div className="ml-auto text-sm font-extrabold text-violet-700">
                        {formatMoney(line)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="space-y-2 border-t border-violet-100 bg-white p-4">
              <div className="flex justify-between border-t border-violet-50 pt-2">
                <span className="font-extrabold text-gray-800">Total</span>
                <span className="text-lg font-black text-violet-700">
                  {formatMoney(total)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setScreen('payment')}
                className="w-full rounded-2xl bg-violet-600 py-4 text-base font-extrabold text-white shadow-md active:bg-violet-700"
              >
                Proceed to Payment · {formatMoney(total)}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <PortalHeader
        tone="violet"
        subtitle="Cashier"
        title={`Hi, ${firstName}`}
        onLogout={() => void signOut()}
        search={search}
        onSearchChange={setSearch}
      />

      <PortalTabs
        tone="violet"
        size="md"
        tabs={[
          { id: 'products', label: 'Products' },
          { id: 'sales', label: 'Recent Sales' },
        ]}
        activeId={browseTab}
        onChange={(id) => setBrowseTab(id as BrowseTab)}
      />

      {browseTab === 'products' ? (
        <>
          {categories.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto border-b border-violet-50 bg-white px-4 py-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    setCategory(cat === 'All' ? null : cat)
                  }
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    (cat === 'All' && !category) || category === cat
                      ? 'bg-violet-600 text-white'
                      : 'bg-violet-50 text-violet-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="px-4 pt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex-1 overflow-y-auto">
            <PosProductGrid
              products={filteredProducts}
              isLoading={productsQuery.isLoading}
              onAdd={addProduct}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <PosRecentSales />
        </div>
      )}

      {cartCount > 0 ? (
        <div className="border-t border-violet-100 bg-white p-3">
          <button
            type="button"
            onClick={() => setScreen('cart')}
            className="flex w-full items-center justify-between rounded-2xl bg-violet-600 px-5 py-3.5 font-extrabold text-white active:bg-violet-700"
          >
            <span className="rounded-lg bg-white/20 px-2 py-0.5 text-sm">
              {cartCount}
            </span>
            <span>View Cart</span>
            <span className="font-black">{formatMoney(total)}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
