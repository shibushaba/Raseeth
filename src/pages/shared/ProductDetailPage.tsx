import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { getInventoryHistory, getProduct } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { AddStockForm } from '@/features/inventory/components/AddStockForm'
import { AdjustStockForm } from '@/features/inventory/components/AdjustStockForm'
import { MovementHistory } from '@/features/inventory/components/MovementHistory'
import { StockQuantity } from '@/features/inventory/components/StockQuantity'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'

type Panel = 'none' | 'add' | 'adjust'

export function ProductDetailPage() {
  const { productId = '' } = useParams()
  const { permissions } = useAuth()
  const [panel, setPanel] = useState<Panel>('none')

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

  if (productQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-4 w-24 animate-pulse bg-neutral-100" />
        <div className="h-10 w-64 animate-pulse bg-neutral-100" />
        <div className="h-8 w-32 animate-pulse bg-neutral-100" />
      </div>
    )
  }

  if (productQuery.error || !productQuery.data) {
    if (productQuery.error) {
      logTechnicalError('getProduct', productQuery.error)
    }
    return (
      <div>
        <Link
          to="/inventory"
          className="mb-6 inline-block text-sm text-neutral-600 hover:text-black"
        >
          ← Inventory
        </Link>
        <p className="text-sm text-red-700" role="alert">
          {toUserMessage(
            productQuery.error,
            'That product could not be found.',
          )}
        </p>
      </div>
    )
  }

  const product = productQuery.data
  const canOperate =
    permissions.canAddInventory || permissions.canAdjustInventory

  return (
    <div>
      <Link
        to="/inventory"
        className="mb-6 inline-block text-sm text-neutral-600 hover:text-black"
      >
        ← Inventory
      </Link>

      <header className="max-w-2xl">
        <h1 className="page-title">{product.name}</h1>
        {product.category ? (
          <p className="mt-1 text-sm text-muted">{product.category}</p>
        ) : null}
      </header>

      <div className="mt-6">
        <StockQuantity quantity={product.current_quantity} size="lg" />
        <p className="mt-1 text-sm text-muted">in stock</p>
      </div>

      {canOperate ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {permissions.canAddInventory ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() => setPanel(panel === 'add' ? 'none' : 'add')}
              variant={panel === 'add' ? 'primary' : 'secondary'}
            >
              Add stock
            </Button>
          ) : null}
          {permissions.canAdjustInventory ? (
            <Button
              type="button"
              className="min-h-11"
              onClick={() => setPanel(panel === 'adjust' ? 'none' : 'adjust')}
              variant={panel === 'adjust' ? 'primary' : 'secondary'}
            >
              Fix stock
            </Button>
          ) : null}
        </div>
      ) : null}

      {panel === 'add' && permissions.canAddInventory ? (
        <div className="mt-6 max-w-lg">
          <AddStockForm
            product={product}
            onCancel={() => setPanel('none')}
            onDone={() => {
              void productQuery.refetch()
              void historyQuery.refetch()
              setPanel('none')
            }}
          />
        </div>
      ) : null}

      {panel === 'adjust' && permissions.canAdjustInventory ? (
        <div className="mt-6 max-w-lg">
          <AdjustStockForm
            product={product}
            onCancel={() => setPanel('none')}
            onDone={() => {
              void productQuery.refetch()
              void historyQuery.refetch()
              setPanel('none')
            }}
          />
        </div>
      ) : null}

      <section className="mt-8 max-w-lg">
        <h2 className="section-label mb-3">Prices</h2>
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">Retail</dt>
            <dd className="text-lg tabular-nums font-medium">
              {formatMoney(product.retail_price)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">Wholesale</dt>
            <dd className="text-lg tabular-nums font-medium">
              {formatMoney(product.wholesale_price)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8 max-w-lg">
        <h2 className="section-label mb-3">Cost</h2>
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">Latest purchase</dt>
            <dd className="text-lg tabular-nums font-medium">
              {formatMoney(product.purchase_price)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted">Avg cost</dt>
            <dd className="text-lg tabular-nums font-medium">
              {formatMoney(product.avg_unit_cost)}
            </dd>
          </div>
        </dl>
      </section>

      {product.description ? (
        <p className="mt-6 max-w-lg text-sm text-muted">{product.description}</p>
      ) : null}

      <section className={panel === 'none' ? 'mt-12' : 'mt-8'}>
        <h2 className="section-label mb-4">Stock history</h2>
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
      </section>
    </div>
  )
}
