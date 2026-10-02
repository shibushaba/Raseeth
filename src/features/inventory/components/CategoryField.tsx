import { useId, useMemo, useState } from 'react'

import { PortalField } from '@/components/ui/portal-field'
import { PRODUCT_CATEGORY_PRESETS } from '@/lib/product-categories'

const CUSTOM_OPTION = '__custom__'

const BASE_PRESETS = PRODUCT_CATEGORY_PRESETS.filter((c) => c !== 'Other')

function normalizeCategory(value: string): string {
  return value.trim()
}

export function CategoryField({
  defaultValue = '',
  suggestions = [],
}: {
  defaultValue?: string
  /** Categories already used in this shop (for quick pick + datalist). */
  suggestions?: string[]
}) {
  const listId = useId()
  const initial = normalizeCategory(defaultValue)

  const dropdownOptions = useMemo(() => {
    const set = new Set<string>([...BASE_PRESETS, ...suggestions.map(normalizeCategory)])
    set.delete('')
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [suggestions])

  const initialIsCustom =
    initial.length > 0 && !dropdownOptions.includes(initial)

  const [mode, setMode] = useState<'preset' | 'custom'>(() =>
    initialIsCustom ? 'custom' : 'preset',
  )
  const [preset, setPreset] = useState(() =>
    initialIsCustom ? '' : initial,
  )
  const [custom, setCustom] = useState(() =>
    initialIsCustom ? initial : '',
  )

  const categoryValue =
    mode === 'custom' ? normalizeCategory(custom) : normalizeCategory(preset)

  const selectValue =
    mode === 'custom' ? CUSTOM_OPTION : preset || ''

  return (
    <PortalField label="Category (optional)">
      <select
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value
          if (next === CUSTOM_OPTION) {
            setMode('custom')
            if (!custom && preset) setCustom(preset)
            return
          }
          setMode('preset')
          setPreset(next)
        }}
        className="w-full rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-violet-400"
      >
        <option value="">Select category…</option>
        {dropdownOptions.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
        <option value={CUSTOM_OPTION}>Custom category…</option>
      </select>

      {mode === 'custom' ? (
        <div className="mt-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            list={listId}
            placeholder="Type a new category"
            className="w-full rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-violet-400"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-muted">
            Pick from suggestions or type your own.
          </p>
        </div>
      ) : null}

      {/* Single form field — avoids duplicate/missing category on submit */}
      <input type="hidden" name="category" value={categoryValue} />

      <datalist id={listId}>
        {dropdownOptions.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </PortalField>
  )
}
