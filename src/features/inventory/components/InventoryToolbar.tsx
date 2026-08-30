import { uniqueCategories } from '@/lib/product-categories'
import {
  SORT_LABELS,
  STOCK_FILTER_LABELS,
  type ProductSortKey,
  type StockFilter,
} from '@/lib/product-filters'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/database'

export function InventoryToolbar({
  products,
  category,
  onCategoryChange,
  stockFilter,
  onStockFilterChange,
  sortKey,
  onSortChange,
}: {
  products: Product[]
  category: string | null
  onCategoryChange: (category: string | null) => void
  stockFilter: StockFilter
  onStockFilterChange: (filter: StockFilter) => void
  sortKey: ProductSortKey
  onSortChange: (sort: ProductSortKey) => void
}) {
  const categories = uniqueCategories(products)

  return (
    <div className="space-y-3">
      <div>
        <p className="eyebrow mb-2 px-1">Category</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <CategoryPill
            label="All"
            active={!category}
            onClick={() => onCategoryChange(null)}
          />
          {categories.map((cat) => (
            <CategoryPill
              key={cat}
              label={cat}
              active={category === cat}
              onClick={() => onCategoryChange(cat)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="stock-filter" className="eyebrow mb-1 block px-1">
            Filter
          </label>
          <select
            id="stock-filter"
            value={stockFilter}
            onChange={(e) =>
              onStockFilterChange(e.target.value as StockFilter)
            }
            className="flex h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground focus-visible:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {(Object.keys(STOCK_FILTER_LABELS) as StockFilter[]).map(
              (key) => (
                <option key={key} value={key}>
                  {STOCK_FILTER_LABELS[key]}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label htmlFor="sort-products" className="eyebrow mb-1 block px-1">
            Sort
          </label>
          <select
            id="sort-products"
            value={sortKey}
            onChange={(e) => onSortChange(e.target.value as ProductSortKey)}
            className="flex h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground focus-visible:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {(Object.keys(SORT_LABELS) as ProductSortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors',
        active
          ? 'bg-inventory text-white shadow-sm'
          : 'border border-border bg-surface text-muted hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
