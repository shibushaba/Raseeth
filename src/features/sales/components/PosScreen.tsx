import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Link } from 'react-router-dom'

import { PageHero } from '@/components/layout/PageHero'
import { useAuth } from '@/features/auth/AuthProvider'

import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createSale, getProducts } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import {
  productToCartSeed,
  unitPriceForType,
  type CartItem,
} from '@/features/sales/cart'
import { CartPanel } from '@/features/sales/components/CartPanel'
import {
  PaymentPanel,
  buildPaymentsFromMode,
  paymentStatus,
  type PaymentMode,
  type SplitPaymentRow,
} from '@/features/sales/components/PaymentPanel'
import { PosProductResults } from '@/features/sales/components/PosProductResults'
import { localDayBounds } from '@/lib/datetime'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney, lineTotal, sumCartTotal, toMoneyString } from '@/lib/money'
import { printSaleReceipt } from '@/lib/print-sale-receipt'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'
import type { PaymentMethod, PriceType, Product, Sale } from '@/types/database'
import { createSaleSchema } from '@/validation/schemas'

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

export function PosScreen() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const [cart, setCart] = useState<CartItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<CompletedSale | null>(null)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH')
  const [splitRows, setSplitRows] = useState<SplitPaymentRow[]>([
    { id: '1', method: 'CASH', amount: '' },
    { id: '2', method: 'UPI', amount: '' },
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 640px)').matches) {
      searchRef.current?.focus()
    }
  }, [])

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(deferredSearch),
    queryFn: () => getProducts(deferredSearch),
    enabled: deferredSearch.length > 0,
  })

  const total = useMemo(
    () =>
      sumCartTotal(
        cart.map((item) => ({
          unit_price: unitPriceForType(item),
          quantity: item.quantity,
        })),
      ),
    [cart],
  )

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
      setPaymentMode('CASH')
      setSplitRows([
        { id: '1', method: 'CASH', amount: '' },
        { id: '2', method: 'UPI', amount: '' },
      ])
      await invalidateAfterSale(queryClient)
    },
    onError: (err) => {
      logTechnicalError('createSale', err)
      setError(
        toUserMessage(
          err,
          'Unable to complete payment. Please try again.',
        ),
      )
    },
    onSettled: () => {
      submittingRef.current = false
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

      return [
        ...prev,
        {
          ...productToCartSeed(product),
          quantity: 1,
        },
      ]
    })
  }

  function addFromSearchKeyboard() {
    const products = productsQuery.data ?? []
    if (products.length === 0 || productsQuery.isFetching) return

    const needle = deferredSearch.toLowerCase()
    const exactCode = products.find(
      (p) => p.product_code.toLowerCase() === needle,
    )
    const inStock =
      exactCode ??
      products.find((p) => p.current_quantity > 0) ??
      products[0]

    if (!inStock) return
    addProduct(inStock)
    setSearch('')
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setSearch('')
      return
    }
    if (e.key !== 'Enter') return
    e.preventDefault()
    addFromSearchKeyboard()
  }

  function completeSale() {
    if (submittingRef.current || mutation.isPending) return
    setError(null)

    for (const item of cart) {
      if (item.quantity > item.available_stock) {
        setError(
          `Not enough ${item.name} in stock. Available: ${item.available_stock}. Requested: ${item.quantity}.`,
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

    submittingRef.current = true
    mutation.mutate(parsed.data)
  }

  if (completed) {
    const paid = completed.payments.reduce((a, p) => a + p.amount, 0)
    const receipt = completed

    function handlePrint() {
      const ok = printSaleReceipt({
        sale_number: receipt.sale_number,
        created_at: receipt.created_at,
        total_amount: Number(receipt.total_amount),
        items: receipt.receiptItems,
        payments: receipt.payments,
        sold_by: receipt.sold_by_name,
      })
      if (!ok) {
        window.alert('Unable to open print window. Allow pop-ups and try again.')
      }
    }

    return (
      <Card className="mx-auto max-w-md overflow-hidden">
        <div className="hero-emerald text-center">
          <p className="text-sm font-semibold opacity-90">Sale complete</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">
            {formatMoney(completed.total_amount)}
          </p>
        </div>
        <CardBody className="space-y-5 py-6">
          <p className="text-center font-mono text-sm font-bold text-muted">
            {completed.sale_number}
          </p>

          <div className="rounded-2xl border border-border bg-accent-soft/30 p-4 dark:bg-stone-800/40">
            <p className="eyebrow">Payment</p>
            <ul className="mt-3 space-y-2 text-sm">
              {completed.payments.map((p, i) => (
                <li
                  key={`${p.method}-${i}`}
                  className="flex justify-between gap-4 font-medium"
                >
                  <span className="text-muted">
                    {PAYMENT_METHOD_LABEL[p.method]}
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(p.amount)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-4 border-t border-border pt-2 font-bold">
                <span>Paid</span>
                <span className="tabular-nums">{formatMoney(paid)}</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="accent"
              size="lg"
              className="w-full"
              onClick={handlePrint}
            >
              Print bill
            </Button>
            <Button
              type="button"
              variant="success"
              size="lg"
              className="w-full"
              onClick={() => {
                setCompleted(null)
                setError(null)
                mutation.reset()
                queueMicrotask(() => searchRef.current?.focus())
              }}
            >
              New sale
            </Button>
            <Link
              to={`/sales/${completed.id}`}
              className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-accent bg-surface px-4 text-sm font-bold text-accent hover:bg-accent-soft/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              View sale
            </Link>
          </div>
        </CardBody>
      </Card>
    )
  }

  const checkoutBlock =
    cart.length > 0 ? (
      <section className="space-y-5 border-t border-border pt-5 lg:border-t-0 lg:pt-0">
        <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border pb-3">
          <span className="section-label">Total</span>
          <span className="text-xl tabular-nums font-semibold">
            {formatMoney(total)}
          </span>
        </div>

        <PaymentPanel
          saleTotal={total}
          mode={paymentMode}
          onModeChange={setPaymentMode}
          splitRows={splitRows}
          onSplitRowsChange={setSplitRows}
          showValidation={false}
        />

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : payCheck.message && !payCheck.valid ? (
          <p className="text-sm text-danger" role="alert">
            {payCheck.message}
          </p>
        ) : cartInvalid ? (
          <p className="text-sm text-danger" role="alert">
            Fix cart quantities or custom prices before completing.
          </p>
        ) : null}

        <Button
          type="button"
          variant="accent"
          className="w-full"
          size="lg"
          disabled={!canComplete}
          onClick={completeSale}
        >
          {mutation.isPending ? '…' : 'Complete sale'}
        </Button>
      </section>
    ) : null

  return (
    <div className="space-y-6 pb-24 lg:space-y-0 lg:pb-0">
      <PageHero
        title="New sale"
        subtitle="Search products and check out"
        tone="violet"
      />

      <div className="flex justify-end">
        <Link
          to="/sales/history"
          className="text-sm font-bold text-accent underline-offset-2 hover:underline"
        >
          Sales history
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-6">
        <div className="space-y-5">
          <Input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search product or Product ID…"
            aria-label="Search products"
          />

          {error && cart.length === 0 ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <section aria-live="polite">
            <PosProductResults
              products={productsQuery.data ?? []}
              isLoading={productsQuery.isFetching}
              search={deferredSearch}
              onAdd={addProduct}
            />
            {deferredSearch &&
            !productsQuery.isFetching &&
            (productsQuery.data?.length ?? 0) > 0 ? (
              <p className="mt-2 section-hint">
                Press Enter to add the highlighted best match (exact Product ID
                first).
              </p>
            ) : null}
          </section>

          <Card>
            <CardBody className="py-4">
              <h2 className="section-label mb-3">Your sale</h2>
              <CartPanel
                items={cart}
                onQuantityChange={(productId, quantity) => {
                  setCart((prev) =>
                    prev.map((i) => {
                      if (i.product_id !== productId) return i
                      const clamped = Math.min(
                        i.available_stock,
                        Math.max(1, Math.floor(quantity)),
                      )
                      return { ...i, quantity: clamped }
                    }),
                  )
                }}
                onPriceTypeChange={(productId, priceType: PriceType) => {
                  setCart((prev) =>
                    prev.map((i) => {
                      if (i.product_id !== productId) return i
                      const next: CartItem = { ...i, price_type: priceType }
                      if (priceType === 'RETAIL') next.unit_price = i.retail_price
                      if (priceType === 'WHOLESALE')
                        next.unit_price = i.wholesale_price
                      return next
                    }),
                  )
                }}
                onCustomPriceChange={(productId, unitPrice) => {
                  setCart((prev) =>
                    prev.map((i) =>
                      i.product_id === productId
                        ? { ...i, unit_price: unitPrice, price_type: 'CUSTOM' }
                        : i,
                    ),
                  )
                }}
                onRemove={(productId) => {
                  setCart((prev) =>
                    prev.filter((i) => i.product_id !== productId),
                  )
                }}
              />
            </CardBody>
          </Card>
        </div>

        <aside className="mt-6 lg:sticky lg:top-4 lg:mt-0">
          <Card>
            <CardBody className="py-4">
              {cart.length > 0 ? (
                checkoutBlock
              ) : (
                <p className="section-hint">
                  Add products to see total and payment.
                </p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>

      {cart.length > 0 ? (
        <div
          className="fixed inset-x-0 z-20 border-t border-border bg-surface/95 p-3 backdrop-blur-sm lg:hidden"
          style={{
            bottom:
              'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Total</p>
              <p className="truncate text-lg font-semibold tabular-nums">
                {formatMoney(total)}
              </p>
            </div>
            <Button
              type="button"
              variant="accent"
              size="lg"
              className="min-h-11 shrink-0"
              disabled={!canComplete}
              onClick={completeSale}
            >
              {mutation.isPending ? '…' : 'Complete sale'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
