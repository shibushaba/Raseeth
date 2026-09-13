import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Package, Pencil } from 'lucide-react'

import { PortalBackBar, PortalCard } from '@/components/ui/portal-field'
import { addStock, adjustStock, getInventoryHistory, getProduct } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { MovementHistory } from '@/features/inventory/components/MovementHistory'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney, parseMoney } from '@/lib/money'
import { getStockLevel } from '@/lib/stock'
import { addStockSchema, adjustStockSchema } from '@/validation/schemas'

type Screen = 'detail' | 'addStock' | 'adjustStock'

function StatusPill({ level }: { level: ReturnType<typeof getStockLevel> }) {
  if (level === 'ok') {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
        In Stock
      </span>
    )
  }
  if (level === 'low') {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
        Low Stock
      </span>
    )
  }
  return (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
      Out of Stock
    </span>
  )
}

function StockBar({ stock }: { stock: number }) {
  const max = Math.max(20, stock * 2)
  const pct = Math.min(100, (stock / max) * 100)
  const level = getStockLevel(stock)
  const color =
    level === 'out'
      ? 'bg-red-400'
      : level === 'low'
        ? 'bg-amber-400'
        : 'bg-emerald-500'
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-background">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ProductDetailPage() {
  const { productId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { permissions } = useAuth()
  const [screen, setScreen] = useState<Screen>('detail')
  const [addQty, setAddQty] = useState(0)
  const [adjustQty, setAdjustQty] = useState('')
  const [error, setError] = useState<string | null>(null)

  const productQuery = useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: () => getProduct(productId),
    enabled: Boolean(productId),
  })

  const historyQuery = useQuery({
    queryKey: queryKeys.inventoryHistory.byProduct(productId),
    queryFn: () => getInventoryHistory(productId),
    enabled: Boolean(productId),
  })

  const addMutation = useMutation({
    mutationFn: addStock,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(productId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryHistory.byProduct(productId),
        }),
      ])
      setScreen('detail')
      setAddQty(0)
      setError(null)
    },
    onError: (err) => {
      logTechnicalError('addStock', err)
      setError(toUserMessage(err, 'Unable to add stock.'))
    },
  })

  const adjustMutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(productId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryHistory.byProduct(productId),
        }),
      ])
      setScreen('detail')
      setAdjustQty('')
      setError(null)
    },
    onError: (err) => {
      logTechnicalError('adjustStock', err)
      setError(toUserMessage(err, 'Unable to adjust stock.'))
    },
  })

  if (productQuery.isLoading) {
    return (
      <div className="space-y-4 p-4" aria-busy="true">
        <div className="h-32 animate-pulse rounded-2xl bg-accent-soft" />
        <div className="h-24 animate-pulse rounded-2xl bg-accent-soft" />
      </div>
    )
  }

  if (productQuery.error || !productQuery.data) {
    return (
      <div className="p-4">
        <PortalBackBar title="Product" onBack={() => navigate('/inventory')} />
        <p className="mt-4 text-sm text-danger" role="alert">
          {toUserMessage(productQuery.error, 'That product could not be found.')}
        </p>
      </div>
    )
  }

  const product = productQuery.data
  const level = getStockLevel(product.current_quantity)
  const retail = parseMoney(product.retail_price)
  const wholesale = parseMoney(product.wholesale_price)
  const profit = retail - wholesale
  const marginPct = retail > 0 ? Math.round((profit / retail) * 100) : 0
  const canOperate =
    permissions.canAddInventory || permissions.canAdjustInventory

  if (screen === 'addStock' && permissions.canAddInventory) {
    const newStock = product.current_quantity + addQty
    return (
      <div className="flex min-h-dvh flex-col">
        <PortalBackBar title="Add Stock" onBack={() => setScreen('detail')} />
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <PortalCard>
            <div className="flex items-center gap-3 p-4">
              <Package className="h-8 w-8 text-success" aria-hidden />
              <div>
                <div className="text-sm font-extrabold text-foreground">{product.name}</div>
                <div className="text-xs text-muted">{product.product_code}</div>
              </div>
            </div>
          </PortalCard>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-muted">Current</div>
                <div className="text-3xl font-black text-foreground">
                  {product.current_quantity}
                </div>
              </div>
              <div className="text-2xl text-muted">→</div>
              <div className="text-right">
                <div className="text-xs font-semibold text-success">New</div>
                <div className="text-3xl font-black text-success">{newStock}</div>
              </div>
            </div>
          </div>

          <PortalCard title="Quantity to Add">
            <div className="flex items-center justify-between p-4">
              <button
                type="button"
                onClick={() => setAddQty((q) => Math.max(0, q - 1))}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-2xl font-extrabold text-foreground"
              >
                −
              </button>
              <div className="text-center">
                <div className="text-5xl font-black text-foreground">{addQty}</div>
                <div className="text-xs text-muted">units</div>
              </div>
              <button
                type="button"
                onClick={() => setAddQty((q) => q + 1)}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success text-2xl font-extrabold text-white"
              >
                +
              </button>
            </div>
          </PortalCard>

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>

        <div className="border-t border-border bg-surface p-4">
          <button
            type="button"
            disabled={addQty === 0 || addMutation.isPending}
            onClick={() => {
              const parsed = addStockSchema.safeParse({
                product_id: product.id,
                quantity: addQty,
                unit_cost: product.purchase_price,
              })
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? 'Invalid quantity')
                return
              }
              addMutation.mutate(parsed.data)
            }}
            className="w-full rounded-2xl bg-success py-4 font-extrabold text-white disabled:opacity-40"
          >
            {addMutation.isPending ? 'Saving…' : `Confirm — Add ${addQty} units`}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'adjustStock' && permissions.canAdjustInventory) {
    const target = adjustQty === '' ? null : Number(adjustQty)
    const delta =
      target !== null && !Number.isNaN(target)
        ? target - product.current_quantity
        : null

    return (
      <div className="flex min-h-dvh flex-col">
        <PortalBackBar title="Fix Stock" onBack={() => setScreen('detail')} />
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <PortalCard>
            <div className="p-4">
              <div className="text-sm font-extrabold text-foreground">{product.name}</div>
              <div className="mt-1 text-xs text-muted">
                Current: {product.current_quantity} units
              </div>
            </div>
          </PortalCard>
          <PortalCard title="Correct stock count">
            <div className="p-4">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="Enter correct quantity"
                className="w-full rounded-xl border border-border bg-accent-soft px-4 py-3 text-sm font-semibold outline-none focus:border-accent"
              />
              {delta !== null && delta !== 0 ? (
                <p className="mt-2 text-xs font-semibold text-muted">
                  Adjustment: {delta > 0 ? '+' : ''}
                  {delta} units
                </p>
              ) : null}
            </div>
          </PortalCard>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <div className="border-t border-border bg-surface p-4">
          <button
            type="button"
            disabled={delta === null || delta === 0 || adjustMutation.isPending}
            onClick={() => {
              const parsed = adjustStockSchema.safeParse({
                product_id: product.id,
                quantity: delta,
                reason: 'Stock count correction',
              })
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? 'Invalid quantity')
                return
              }
              adjustMutation.mutate(parsed.data)
            }}
            className="w-full rounded-2xl bg-success py-4 font-extrabold text-white disabled:opacity-40"
          >
            {adjustMutation.isPending ? 'Saving…' : 'Update Stock'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PortalBackBar
        title="Product Details"
        subtitle={product.product_code}
        onBack={() => navigate('/inventory')}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <PortalCard>
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <Package className="h-7 w-7 text-success" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              {product.category ? (
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {product.category}
                </div>
              ) : null}
              <div className="text-lg font-black text-foreground">{product.name}</div>
              <div className="mt-0.5 text-xs text-muted">{product.product_code}</div>
            </div>
            <StatusPill level={level} />
          </div>
        </PortalCard>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-muted">Current Stock</div>
              <div className="text-4xl font-black text-success">
                {product.current_quantity}
                <span className="ml-1 text-sm font-semibold text-muted">units</span>
              </div>
            </div>
          </div>
          <StockBar stock={product.current_quantity} />
        </div>

        <PortalCard title="Pricing">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="p-4">
              <div className="mb-1 text-xs font-semibold uppercase text-muted">
                Wholesale
              </div>
              <div className="text-xl font-black text-danger">
                {formatMoney(product.wholesale_price)}
              </div>
            </div>
            <div className="p-4">
              <div className="mb-1 text-xs font-semibold uppercase text-accent">
                Retail
              </div>
              <div className="text-xl font-black text-accent">
                {formatMoney(product.retail_price)}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-emerald-50 p-4">
            <div>
              <div className="text-xs font-semibold text-muted">Profit per unit</div>
              <div className="text-lg font-black text-success">
                +{formatMoney(profit)}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-100 px-3 py-1.5 text-sm font-extrabold text-success">
              {marginPct}% margin
            </div>
          </div>
        </PortalCard>

        {product.description ? (
          <PortalCard title="Description">
            <p className="p-4 text-sm text-muted">{product.description}</p>
          </PortalCard>
        ) : null}

        <PortalCard title="Stock History">
          <div className="p-4">
            <MovementHistory
              movements={historyQuery.data}
              isLoading={historyQuery.isLoading}
              errorMessage={
                historyQuery.error
                  ? toUserMessage(
                      historyQuery.error,
                      'Unable to load inventory history.',
                    )
                  : null
              }
            />
          </div>
        </PortalCard>
      </div>

      {canOperate ? (
        <div className="space-y-2 border-t border-border bg-surface p-4">
          {permissions.canAddInventory ? (
            <button
              type="button"
              onClick={() => setScreen('addStock')}
              className="w-full rounded-2xl bg-success py-3.5 font-extrabold text-white active:bg-emerald-700"
            >
              + Add Stock
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {permissions.canAdjustInventory ? (
              <button
                type="button"
                onClick={() => setScreen('adjustStock')}
                className="flex items-center justify-center gap-1 rounded-2xl border-2 border-border py-3 text-sm font-bold text-muted"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Fix Stock
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
