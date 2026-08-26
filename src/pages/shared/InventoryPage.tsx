import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { getProducts } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { InventoryProductList } from '@/features/inventory/components/InventoryProductList'
import { logTechnicalError, toUserMessage } from '@/lib/errors'

export function InventoryPage() {
  const { permissions } = useAuth()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(deferredSearch),
    queryFn: () => getProducts(deferredSearch),
  })

  const errorMessage = useMemo(() => {
    if (!productsQuery.error) return null
    logTechnicalError('getProducts', productsQuery.error)
    return toUserMessage(
      productsQuery.error,
      'Unable to load inventory. Please try again.',
    )
  }, [productsQuery.error])

  const products = productsQuery.data ?? []
  const hasSearch = deferredSearch.length > 0

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={
          permissions.canCreateProduct
            ? 'Find products, check stock, and keep the ledger accurate.'
            : 'Read-only view of products, stock, and movement history.'
        }
      />

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products or Product ID…"
          className="sm:max-w-md"
          aria-label="Search products"
        />
        {permissions.canCreateProduct ? (
          <Link
            to="/inventory/new"
            className="inline-flex h-11 items-center justify-center rounded-sm border border-primary bg-primary px-4 text-sm font-medium text-white hover:bg-neutral-800 sm:ml-auto"
          >
            + Add Product
          </Link>
        ) : null}
      </div>

      {productsQuery.isLoading ? (
        <div
          className="space-y-3"
          aria-busy="true"
          aria-label="Loading products"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!productsQuery.isLoading && !errorMessage && products.length === 0 ? (
        hasSearch ? (
          <EmptyState
            title="No products found."
            description="Try another product name or Product ID."
          />
        ) : (
          <div className="space-y-4">
            <EmptyState
              title="No products yet."
              description="Add your first product to start tracking inventory."
            />
            {permissions.canCreateProduct ? (
              <Link
                to="/inventory/new"
                className="inline-flex h-11 items-center justify-center rounded-sm border border-primary bg-primary px-4 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Add Product
              </Link>
            ) : null}
          </div>
        )
      ) : null}

      {!productsQuery.isLoading && !errorMessage && products.length > 0 ? (
        <InventoryProductList products={products} />
      ) : null}
    </div>
  )
}
