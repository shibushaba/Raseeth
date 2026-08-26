import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { addStock } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { parseMoney } from '@/lib/money'
import type { Product } from '@/types/database'
import { addStockSchema } from '@/validation/schemas'

export function AddStockForm({
  product,
  onDone,
  onCancel,
}: {
  product: Product
  onDone: (nextQty: number) => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: addStock,
    onSuccess: async (_movement, variables) => {
      const nextQty = product.current_quantity + variables.quantity
      setSuccess(`Stock updated: ${product.current_quantity} → ${nextQty}`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.products.detail(product.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.inventoryHistory.byProduct(product.id),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.summary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.business.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity.all }),
      ])
      onDone(nextQty)
    },
    onError: (err) => {
      logTechnicalError('addStock', err)
      setError(
        toUserMessage(
          err,
          'Unable to add stock. Please check the quantity and try again.',
        ),
      )
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const fd = new FormData(e.currentTarget)
    const parsed = addStockSchema.safeParse({
      product_id: product.id,
      quantity: fd.get('quantity'),
      unit_cost: fd.get('unit_cost'),
      notes: String(fd.get('notes') ?? '') || undefined,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.')
      return
    }

    mutation.mutate(parsed.data)
  }

  return (
    <form className="space-y-5 border border-border p-5" onSubmit={onSubmit}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Add stock</h2>
        <p className="mt-1 text-sm text-muted">
          {product.name} · {product.product_code}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          For supplier deliveries. Creates a purchase movement — not an
          adjustment.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity</Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unit_cost">Purchase price</Label>
        <Input
          id="unit_cost"
          name="unit_cost"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          required
          defaultValue={parseMoney(product.purchase_price)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Note (optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="e.g. New supplier delivery"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-800" role="status">
          {success}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="md" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Add stock'}
        </Button>
        <Button type="button" size="md" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
