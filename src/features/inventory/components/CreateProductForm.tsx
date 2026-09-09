import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'

import {
  PortalCard,
  PortalField,
  PortalPriceInput,
  PortalTextInput,
} from '@/components/ui/portal-field'
import { CategoryField } from '@/features/inventory/components/CategoryField'
import { createProduct } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { createProductSchema } from '@/validation/schemas'

export function CreateProductForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async (product) => {
      setCreatedCode(product.product_code)
      setCreatedId(product.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.summary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.business.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity.all }),
      ])
    },
    onError: (err) => {
      logTechnicalError('createProduct', err)
      setError(toUserMessage(err, 'Unable to create product. Please try again.'))
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const parsed = createProductSchema.safeParse({
      name: fd.get('name'),
      description: String(fd.get('description') ?? '') || undefined,
      category: String(fd.get('category') ?? '') || undefined,
      purchase_price: fd.get('purchase_price'),
      retail_price: fd.get('retail_price'),
      wholesale_price: fd.get('wholesale_price'),
      initial_quantity: fd.get('initial_quantity') || 0,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.')
      return
    }

    mutation.mutate(parsed.data)
  }

  if (createdCode && createdId) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
          <Check className="h-8 w-8 text-white" aria-hidden />
        </div>
        <div>
          <p className="text-lg font-extrabold text-emerald-700">Product Created!</p>
          <p className="mt-1 font-mono text-sm font-bold text-gray-600">
            {createdCode}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate(`/inventory/${createdId}`)}
            className="w-full rounded-2xl bg-emerald-600 py-3.5 font-extrabold text-white"
          >
            View Product
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatedCode(null)
              setCreatedId(null)
              mutation.reset()
            }}
            className="w-full rounded-2xl border-2 border-violet-600 py-3.5 font-extrabold text-violet-600"
          >
            Add Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="space-y-4 p-4 pb-24" onSubmit={onSubmit}>
      <PortalCard title="Basic Info">
        <div className="space-y-3 p-4">
          <PortalField label="Product Name">
            <PortalTextInput id="name" name="name" placeholder="e.g. Basmati Rice 1kg" required />
          </PortalField>
          <PortalField label="Description (optional)">
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Short description"
              className="w-full rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-gray-800 placeholder-gray-400 outline-none focus:border-violet-400"
            />
          </PortalField>
          <CategoryField />
        </div>
      </PortalCard>

      <PortalCard title="Pricing">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <PortalField label="Purchase Price">
            <PortalPriceInput id="purchase_price" name="purchase_price" required />
          </PortalField>
          <PortalField label="Retail Price">
            <PortalPriceInput id="retail_price" name="retail_price" required />
          </PortalField>
          <PortalField label="Wholesale Price">
            <PortalPriceInput id="wholesale_price" name="wholesale_price" required />
          </PortalField>
        </div>
      </PortalCard>

      <PortalCard title="Initial Stock">
        <div className="p-4">
          <PortalField label="Quantity">
            <PortalTextInput
              id="initial_quantity"
              name="initial_quantity"
              type="number"
              inputMode="numeric"
              placeholder="0"
            />
          </PortalField>
          <p className="mt-2 text-xs text-gray-400">
            Product ID is assigned automatically. Initial stock is recorded as a
            purchase.
          </p>
        </div>
      </PortalCard>

      {error ? (
        <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-violet-100 bg-white p-4">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-2xl bg-emerald-600 py-4 font-extrabold text-white shadow-lg active:bg-emerald-700 disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save Product'}
        </button>
      </div>
    </form>
  )
}
