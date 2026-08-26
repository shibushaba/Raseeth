import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { adjustStock } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import type { Product } from '@/types/database'
import { adjustStockSchema } from '@/validation/schemas'

export function AdjustStockForm({
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
  const [direction, setDirection] = useState<'in' | 'out'>('out')

  const mutation = useMutation({
    mutationFn: adjustStock,
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
      logTechnicalError('adjustStock', err)
      setError(
        toUserMessage(
          err,
          'Unable to adjust stock. Please check the values and try again.',
        ),
      )
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const fd = new FormData(e.currentTarget)
    const abs = Number(fd.get('quantity'))
    const signed = direction === 'out' ? -Math.abs(abs) : Math.abs(abs)

    const parsed = adjustStockSchema.safeParse({
      product_id: product.id,
      quantity: signed,
      reason: fd.get('reason'),
      note: String(fd.get('note') ?? '') || undefined,
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
        <h2 className="text-lg font-semibold tracking-tight">Adjust stock</h2>
        <p className="mt-1 text-sm text-muted">
          For damage, missing items, or count corrections — not supplier
          deliveries.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Direction</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="md"
            variant={direction === 'out' ? 'primary' : 'secondary'}
            aria-pressed={direction === 'out'}
            onClick={() => setDirection('out')}
          >
            Decrease (write-off)
          </Button>
          <Button
            type="button"
            size="md"
            variant={direction === 'in' ? 'primary' : 'secondary'}
            aria-pressed={direction === 'in'}
            onClick={() => setDirection('in')}
          >
            Increase (correction)
          </Button>
        </div>
        <p className="text-xs text-neutral-500">
          Use Add Stock for supplier deliveries. Adjust is only for corrections.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="adj-quantity">Quantity</Label>
        <Input
          id="adj-quantity"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          autoFocus
        />
        <p className="text-xs text-neutral-500">
          Current stock: {product.current_quantity}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Select id="reason" name="reason" required defaultValue="Damaged">
          <option value="Damaged">Damaged</option>
          <option value="Missing">Missing</option>
          <option value="Stock count correction">Stock count correction</option>
          <option value="Other">Other</option>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea id="note" name="note" rows={2} />
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
          {mutation.isPending ? 'Saving…' : 'Adjust stock'}
        </Button>
        <Button type="button" size="md" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
