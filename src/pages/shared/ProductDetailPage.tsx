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
        <h1 className="app-heading">
          {product.name}
        </h1>
        <p className="mt-2 font-mono text-sm text-neutral-600">
          {product.product_code}
        </p>
        {product.category ? (
          <p className="mt-1 text-sm text-neutral-500">{product.category}</p>
        ) : null}
        {product.description ? (
          <p className="mt-3 text-sm text-neutral-700">{product.description}</p>
        ) : null}
      </header>

      <div className="mt-8">
        <StockQuantity quantity={product.current_quantity} size="lg" />
        <p className="mt-1 text-sm text-neutral-500">units in stock</p>
      </div>

      <dl className="mt-8 grid max-w-lg grid-cols-1 gap-6 border-y border-neutral-200 py-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Latest purchase
          </dt>
          <dd className="mt-1 text-lg tabular-nums">
            {formatMoney(product.purchase_price)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Avg unit cost
          </dt>
          <dd className="mt-1 text-lg tabular-nums">
            {formatMoney(product.avg_unit_cost)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Retail
          </dt>
          <dd className="mt-1 text-lg tabular-nums">
            {formatMoney(product.retail_price)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">
            Wholesale
          </dt>
          <dd className="mt-1 text-lg tabular-nums">
            {formatMoney(product.wholesale_price)}
          </dd>
        </div>
      </dl>

      {canOperate ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {permissions.canAddInventory ? (
            <Button
              type="button"
              onClick={() => setPanel(panel === 'add' ? 'none' : 'add')}
              variant={panel === 'add' ? 'primary' : 'secondary'}
            >
              Add Stock
            </Button>
          ) : null}
          {permissions.canAdjustInventory ? (
            <Button
              type="button"
              onClick={() => setPanel(panel === 'adjust' ? 'none' : 'adjust')}
              variant={panel === 'adjust' ? 'primary' : 'secondary'}
            >
              Adjust Stock
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

      <section className={panel === 'none' ? 'mt-12' : 'mt-8'}>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Inventory history
        </h2>
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
