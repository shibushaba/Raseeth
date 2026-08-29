import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createReturn, getSale } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { localDayBounds } from '@/lib/datetime'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney, lineTotal, toCents } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'
import type { PaymentMethod, SaleReturn } from '@/types/database'
import { createReturnSchema } from '@/validation/schemas'
import { cn } from '@/lib/utils'

async function invalidateAfterReturn(
  queryClient: ReturnType<typeof useQueryClient>,
  saleId: string,
) {
  const { dayKey } = localDayBounds()
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventoryHistory.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.summary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sales.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sales.detail(saleId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.returns.all }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.sales.todaySummary(dayKey),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.business.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity.all }),
  ])
}

export function ReturnItemsPage() {
  const { saleId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const methodGroupId = useId()

  const saleQuery = useQuery({
    queryKey: queryKeys.sales.detail(saleId),
    queryFn: () => getSale(saleId),
    enabled: Boolean(saleId),
  })

  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [refundMethod, setRefundMethod] = useState<PaymentMethod | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<SaleReturn | null>(null)
  const submittingRef = useRef(false)

  const sale = saleQuery.data

  const defaultMethod = useMemo((): PaymentMethod => {
    if (!sale?.payments.length) return 'CASH'
    if (sale.payments.length === 1) return sale.payments[0].payment_method
    return 'CASH'
  }, [sale])

  const activeMethod = refundMethod ?? defaultMethod

  const lines = useMemo(() => {
    if (!sale) return []
    return sale.items.map((item) => {
      const raw = qtys[item.id] ?? ''
      const qty = Math.max(0, Math.floor(Number(raw) || 0))
      const clamped = Math.min(qty, item.remaining_quantity)
      return {
        item,
        quantity: clamped,
        lineTotal: lineTotal(item.unit_price, clamped),
      }
    })
  }, [sale, qtys])

  const returnTotalCents = lines.reduce(
    (acc, line) => acc + toCents(line.lineTotal),
    0,
  )
  const returnTotal = returnTotalCents / 100
  const hasReturnQty = lines.some((l) => l.quantity > 0)

  const mutation = useMutation({
    mutationFn: createReturn,
    onSuccess: async (ret) => {
      setCompleted(ret)
      setError(null)
      await invalidateAfterReturn(queryClient, saleId)
    },
    onError: (err) => {
      logTechnicalError('createReturn', err)
      setError(
        toUserMessage(err, 'Unable to complete the return. Please try again.'),
      )
    },
    onSettled: () => {
      submittingRef.current = false
    },
  })

  function completeReturn() {
    if (submittingRef.current || mutation.isPending) return
    setError(null)
    if (!sale) return

    for (const line of lines) {
      const raw = Number(qtys[line.item.id] || 0)
      if (raw > line.item.remaining_quantity) {
        setError(
          `Only ${line.item.remaining_quantity} units remain available for return.`,
        )
        return
      }
    }

    const payload = {
      items: lines
        .filter((l) => l.quantity > 0)
        .map((l) => ({
          sale_item_id: l.item.id,
          quantity: l.quantity,
        })),
      refund_method: activeMethod,
    }

    const parsed = createReturnSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Return is invalid.')
      return
    }

    submittingRef.current = true
    mutation.mutate(parsed.data)
  }

  if (saleQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="card h-4 w-24 animate-pulse bg-stone-50 dark:bg-stone-800/50" />
        <div className="card h-10 w-48 animate-pulse bg-stone-50 dark:bg-stone-800/50" />
      </div>
    )
  }

  if (saleQuery.error || !sale) {
    if (saleQuery.error) logTechnicalError('getSale', saleQuery.error)
    return (
      <div>
        <Link
          to={`/sales/${saleId}`}
          className="mb-6 inline-block text-sm text-muted hover:text-foreground"
        >
          ← Sale
        </Link>
        <p className="text-sm text-danger" role="alert">
          {toUserMessage(saleQuery.error, 'That sale could not be found.')}
        </p>
      </div>
    )
  }

  if (completed) {
    return (
      <Card className="mx-auto max-w-md">
        <CardBody className="space-y-5 py-6">
          <div className="text-center">
            <p className="eyebrow">Return complete</p>
            <p className="mt-2 font-mono text-xl font-semibold tracking-tight">
              {completed.return_number}
            </p>
          </div>
          <div className="border-t border-dashed border-border pt-4 text-center">
            <p className="section-label">Refund</p>
            <p className="mt-1 text-2xl tabular-nums font-semibold">
              {formatMoney(completed.total_amount)}
            </p>
            <p className="mt-2 text-sm text-muted">
              {PAYMENT_METHOD_LABEL[activeMethod]}
            </p>
          </div>
          <p className="text-center section-hint">Inventory restored.</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="accent"
              onClick={() => navigate(`/sales/${saleId}`)}
            >
              Back to Sale
            </Button>
            <Link
              to={`/returns/${completed.id}`}
              className="inline-flex h-11 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-stone-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              View return
            </Link>
          </div>
        </CardBody>
      </Card>
    )
  }

  const anyReturnable = sale.items.some((i) => i.remaining_quantity > 0)

  return (
    <div className="mx-auto max-w-lg">
      <Link
        to={`/sales/${saleId}`}
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        ← {sale.sale_number}
      </Link>

      <header className="mb-6">
        <h1 className="page-title">Return Items</h1>
        <p className="page-subtitle">{sale.sale_number}</p>
      </header>

      {!anyReturnable ? (
        <p className="section-hint">
          All items from this sale have already been returned.
        </p>
      ) : (
        <>
          <Card>
            <CardBody className="py-4">
              <ul className="divide-y divide-dashed divide-border">
                {sale.items
                  .filter((item) => item.remaining_quantity > 0)
                  .map((item) => {
                    const raw = qtys[item.id] ?? ''
                    const qty = Math.min(
                      Math.max(0, Math.floor(Number(raw || 0) || 0)),
                      item.remaining_quantity,
                    )
                    return (
                      <li key={item.id} className="py-4 first:pt-0">
                        <p className="font-medium">
                          {item.product_name ?? 'Product'}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          Sold {item.quantity}
                          <span className="mx-2">·</span>
                          Returned {item.returned_quantity}
                          <span className="mx-2">·</span>
                          Remaining {item.remaining_quantity}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {formatMoney(item.unit_price)} each
                        </p>
                        <label
                          className="mt-3 block eyebrow"
                          htmlFor={`ret-qty-${item.id}`}
                        >
                          Return quantity
                        </label>
                        <Input
                          id={`ret-qty-${item.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={item.remaining_quantity}
                          step={1}
                          className="mt-1 max-w-[8rem]"
                          placeholder="0"
                          value={raw}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            if (e.target.value === '') {
                              setQtys((prev) => ({ ...prev, [item.id]: '' }))
                              return
                            }
                            if (!Number.isFinite(n)) return
                            const clamped = Math.min(
                              item.remaining_quantity,
                              Math.max(0, Math.floor(n)),
                            )
                            setQtys((prev) => ({
                              ...prev,
                              [item.id]: String(clamped),
                            }))
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault()
                          }}
                        />
                        {qty > 0 ? (
                          <p className="mt-2 text-sm tabular-nums text-muted">
                            Line: {formatMoney(lineTotal(item.unit_price, qty))}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
              </ul>
            </CardBody>
          </Card>

          <Card className="mt-6">
            <CardBody className="space-y-5 py-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="section-label">Refund</span>
                <span className="text-2xl tabular-nums font-semibold">
                  {formatMoney(returnTotal)}
                </span>
              </div>

              <fieldset>
                <legend className="section-label">Refund method</legend>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(['CASH', 'UPI', 'CARD'] as const).map((method) => (
                    <label
                      key={method}
                      className={cn(
                        'flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors',
                        activeMethod === method
                          ? 'border-accent bg-accent-soft text-accent dark:bg-teal-950/60 dark:text-teal-300'
                          : 'border-border bg-surface hover:bg-stone-50 dark:hover:bg-stone-800/60',
                      )}
                    >
                      <input
                        type="radio"
                        name={methodGroupId}
                        value={method}
                        checked={activeMethod === method}
                        onChange={() => setRefundMethod(method)}
                        className="sr-only"
                      />
                      {PAYMENT_METHOD_LABEL[method]}
                    </label>
                  ))}
                </div>
              </fieldset>

              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}

              <Button
                type="button"
                variant="accent"
                className="w-full sm:w-auto"
                size="lg"
                disabled={
                  mutation.isPending || !hasReturnQty || returnTotalCents <= 0
                }
                onClick={completeReturn}
              >
                {mutation.isPending ? 'Completing return…' : 'Complete Return'}
              </Button>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
