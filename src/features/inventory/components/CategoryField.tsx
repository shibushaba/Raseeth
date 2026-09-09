import { useId, useState } from 'react'

import { PortalField } from '@/components/ui/portal-field'
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
    <PortalField label="Category">
      <select
        value={preset || (initialCustom ? 'Other' : '')}
        onChange={(e) => {
          const next = e.target.value
          setPreset(next)
          if (next !== 'Other') setCustom('')
        }}
        className="w-full rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-violet-400"
      >
        <option value="">Select category…</option>
        {PRODUCT_CATEGORY_PRESETS.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {showCustom ? (
        <div className="mt-2">
          <input
            name="category"
            list={listId}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. Baby Care"
            required={preset === 'Other'}
            className="w-full rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-violet-400"
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
    </PortalField>
  )
}
