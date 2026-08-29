import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/layout/EmptyState'
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
      <header className="mb-6">
        <h1 className="page-title">Inventory</h1>
        {!productsQuery.isLoading && !errorMessage && products.length > 0 ? (
          <p className="mt-2 text-sm font-medium text-muted">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </p>
        ) : null}
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="min-h-11 sm:max-w-md"
          aria-label="Search products"
        />
        {permissions.canCreateProduct ? (
          <Link
            to="/inventory/new"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:ml-auto"
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
            <div key={i} className="card h-14 animate-pulse bg-stone-50 dark:bg-stone-800/50" />
          ))}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-danger" role="alert">
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
                className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
