import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'

import {
  PortalCard,
  PortalField,
  PortalPriceInput,
  PortalTextInput,
} from '@/components/ui/portal-field'
import { CategoryField } from '@/features/inventory/components/CategoryField'
import { updateProduct } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { parseMoney } from '@/lib/money'
import type { Product } from '@/types/database'
import { updateProductSchema } from '@/validation/schemas'

export function EditProductForm({
  product,
  onDone,
}: {
  product: Product
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateProduct>[1]) =>
      updateProduct(product.id, input),
    onSuccess: async () => {
      setSaved(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(product.id),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.summary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.business.all }),
      ])
    },
    onError: (err) => {
      logTechnicalError('updateProduct', err)
      setError(toUserMessage(err, 'Unable to update product. Please try again.'))
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const parsed = updateProductSchema.safeParse({
      name: fd.get('name'),
      description: String(fd.get('description') ?? '') || undefined,
      category: String(fd.get('category') ?? '') || undefined,
      purchase_price: fd.get('purchase_price'),
      retail_price: fd.get('retail_price'),
      wholesale_price: fd.get('wholesale_price'),
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.')
      return
    }

    mutation.mutate(parsed.data)
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
          <Check className="h-8 w-8 text-white" aria-hidden />
        </div>
        <p className="text-lg font-extrabold text-emerald-700">Product updated</p>
        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-2xl bg-emerald-600 py-3.5 font-extrabold text-white"
        >
          Back to product
        </button>
      </div>
    )
  }

  return (
    <form className="space-y-4 p-4 pb-28" onSubmit={onSubmit}>
      <PortalCard title="Basic Info">
        <div className="space-y-3 p-4">
          <PortalField label="Product Name">
            <PortalTextInput
              id="name"
              name="name"
              defaultValue={product.name}
              required
            />
          </PortalField>
          <PortalField label="Description (optional)">
            <textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={product.description ?? ''}
              className="w-full rounded-xl border border-border bg-accent-soft/50 px-4 py-3 text-sm font-semibold text-foreground placeholder-muted outline-none focus:border-accent"
            />
          </PortalField>
          <CategoryField defaultValue={product.category ?? ''} />
        </div>
      </PortalCard>

      <PortalCard title="Pricing">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <PortalField label="Purchase Price">
            <PortalPriceInput
              id="purchase_price"
              name="purchase_price"
              defaultValue={String(parseMoney(product.purchase_price))}
              required
            />
          </PortalField>
          <PortalField label="Retail Price">
            <PortalPriceInput
              id="retail_price"
              name="retail_price"
              defaultValue={String(parseMoney(product.retail_price))}
              required
            />
          </PortalField>
          <PortalField label="Wholesale Price">
            <PortalPriceInput
              id="wholesale_price"
              name="wholesale_price"
              defaultValue={String(parseMoney(product.wholesale_price))}
              required
            />
          </PortalField>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-muted">
          Stock quantity is changed with Add Stock or Fix Stock on the product
          page.
        </p>
      </PortalCard>

      {error ? (
        <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="mx-auto w-full max-w-lg rounded-2xl bg-emerald-600 py-4 font-extrabold text-white shadow-lg active:bg-emerald-700 disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
