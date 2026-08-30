import { useId, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PRODUCT_CATEGORY_PRESETS } from '@/lib/product-categories'

export function CategoryField({
  defaultValue = '',
}: {
  defaultValue?: string
}) {
  const listId = useId()
  const presetValues = PRODUCT_CATEGORY_PRESETS as readonly string[]
  const initialPreset = presetValues.includes(defaultValue) ? defaultValue : ''
  const initialCustom =
    defaultValue && !presetValues.includes(defaultValue) ? defaultValue : ''

  const [preset, setPreset] = useState(initialPreset)
  const [custom, setCustom] = useState(initialCustom)

  const showCustom = preset === 'Other' || Boolean(initialCustom)

  return (
    <div className="space-y-2">
      <Label htmlFor="category-preset">Category</Label>
      <select
        id="category-preset"
        value={preset || (initialCustom ? 'Other' : '')}
        onChange={(e) => {
          const next = e.target.value
          setPreset(next)
          if (next !== 'Other') setCustom('')
        }}
        className="flex h-12 w-full rounded-xl border border-border bg-accent-soft/40 px-4 text-base font-semibold text-foreground focus-visible:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:bg-stone-800/50"
      >
        <option value="">Select category…</option>
        {PRODUCT_CATEGORY_PRESETS.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {showCustom ? (
        <div className="space-y-2">
          <Label htmlFor="category-custom">Custom category</Label>
          <Input
            id="category-custom"
            name="category"
            list={listId}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. Baby Care"
            required={preset === 'Other'}
          />
        </div>
      ) : (
        <input type="hidden" name="category" value={preset} />
      )}

      <datalist id={listId}>
        {PRODUCT_CATEGORY_PRESETS.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
      <p className="text-xs font-medium text-muted">
        Choose a category to filter products later.
      </p>
    </div>
  )
}
