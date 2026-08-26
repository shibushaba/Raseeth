import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
      <div className="panel max-w-lg px-6 py-8">
        <p className="app-kicker">Product created</p>
        <p className="mt-2 text-xl font-semibold tracking-tight">
          {createdCode}
        </p>
        <p className="mt-4 text-sm text-neutral-700">
          The system assigned this permanent Product ID. It will never change.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => navigate(`/inventory/${createdId}`)}>
            View product
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setCreatedCode(null)
              setCreatedId(null)
              mutation.reset()
            }}
          >
            Add another
          </Button>
          <Link
            to="/inventory"
            className="inline-flex h-11 items-center px-4 text-sm underline"
          >
            Back to inventory
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form className="max-w-lg space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="name">Product name</Label>
        <Input id="name" name="name" required autoFocus />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category (optional)</Label>
        <Input id="category" name="category" />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="purchase_price">Purchase price</Label>
          <Input
            id="purchase_price"
            name="purchase_price"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            defaultValue={0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="retail_price">Retail price</Label>
          <Input
            id="retail_price"
            name="retail_price"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            defaultValue={0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wholesale_price">Wholesale price</Label>
          <Input
            id="wholesale_price"
            name="wholesale_price"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            defaultValue={0}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="initial_quantity">Initial quantity</Label>
        <Input
          id="initial_quantity"
          name="initial_quantity"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          defaultValue={0}
        />
        <p className="text-xs text-neutral-500">
          If greater than zero, an initial purchase movement is recorded
          automatically.
        </p>
      </div>

      <p className="text-xs text-neutral-500">
        Product ID (PRD-XXXXXX) is generated by the system.
      </p>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create product'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/inventory')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
