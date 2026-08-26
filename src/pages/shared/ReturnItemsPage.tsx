import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createReturn, getSale } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { localDayBounds } from '@/lib/datetime'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney, lineTotal, toCents } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'
import type { PaymentMethod, SaleReturn } from '@/types/database'
import { createReturnSchema } from '@/validation/schemas'

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
        <div className="h-4 w-24 animate-pulse bg-neutral-100" />
        <div className="h-10 w-48 animate-pulse bg-neutral-100" />
      </div>
    )
  }

  if (saleQuery.error || !sale) {
    if (saleQuery.error) logTechnicalError('getSale', saleQuery.error)
    return (
      <div>
        <Link
          to={`/sales/${saleId}`}
          className="mb-6 inline-block text-sm text-neutral-600 hover:text-black"
        >
          ← Sale
        </Link>
        <p className="text-sm text-red-700" role="alert">
          {toUserMessage(saleQuery.error, 'That sale could not be found.')}
        </p>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="panel max-w-md px-6 py-8">
        <p className="app-kicker">Return complete</p>
        <p className="mt-2 text-xl font-semibold tracking-tight">
          {completed.return_number}
        </p>
        <p className="mt-6 app-kicker">Refund</p>
        <p className="mt-1 text-2xl tabular-nums font-medium">
          {formatMoney(completed.total_amount)}
        </p>
        <p className="mt-2 text-sm text-muted">
          {PAYMENT_METHOD_LABEL[activeMethod]}
        </p>
        <p className="mt-4 text-sm text-muted">Inventory restored.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" onClick={() => navigate(`/sales/${saleId}`)}>
            Back to Sale
          </Button>
          <Link
            to={`/returns/${completed.id}`}
            className="inline-flex h-11 items-center rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-neutral-100"
          >
            View return
          </Link>
        </div>
      </div>
    )
  }

  const anyReturnable = sale.items.some((i) => i.remaining_quantity > 0)

  return (
    <div>
      <Link
        to={`/sales/${saleId}`}
        className="mb-6 inline-block text-sm text-neutral-600 hover:text-black"
      >
        ← {sale.sale_number}
      </Link>

      <header>
        <h1 className="app-heading">Return Items</h1>
        <p className="mt-2 text-sm text-neutral-600">{sale.sale_number}</p>
      </header>

      {!anyReturnable ? (
        <p className="mt-8 text-sm text-neutral-600">
          All items from this sale have already been returned.
        </p>
      ) : (
        <>
          <ul className="mt-8 space-y-6">
            {sale.items
              .filter((item) => item.remaining_quantity > 0)
              .map((item) => {
              const raw = qtys[item.id] ?? ''
              const qty = Math.min(
                Math.max(0, Math.floor(Number(raw || 0) || 0)),
                item.remaining_quantity,
              )
              return (
                <li
                  key={item.id}
                  className="border-b border-neutral-200 pb-5 last:border-0"
                >
                  <p className="font-medium">{item.product_name ?? 'Product'}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    Sold {item.quantity}
                    <span className="mx-2 text-neutral-300">·</span>
                    Returned {item.returned_quantity}
                    <span className="mx-2 text-neutral-300">·</span>
                    Remaining {item.remaining_quantity}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {formatMoney(item.unit_price)} each
                  </p>
                  <label
                    className="mt-3 block text-xs uppercase tracking-wide text-neutral-500"
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
                    <p className="mt-2 text-sm tabular-nums text-neutral-700">
                      Line: {formatMoney(lineTotal(item.unit_price, qty))}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>

          <section className="mt-8 space-y-5 border-t border-border pt-6">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium uppercase tracking-wide">
                Refund
              </p>
              <p className="text-2xl tabular-nums font-medium">
                {formatMoney(returnTotal)}
              </p>
            </div>

            <fieldset>
              <legend className="text-sm font-medium uppercase tracking-wide">
                Refund method
              </legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(['CASH', 'UPI', 'CARD'] as const).map((method) => (
                  <label
                    key={method}
                    className={`flex cursor-pointer items-center gap-2 border px-3 py-3 text-sm ${
                      activeMethod === method
                        ? 'border-border-strong bg-neutral-50'
                        : 'border-neutral-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={methodGroupId}
                      value={method}
                      checked={activeMethod === method}
                      onChange={() => setRefundMethod(method)}
                      className="accent-black"
                    />
                    {PAYMENT_METHOD_LABEL[method]}
                  </label>
                ))}
              </div>
            </fieldset>

            {error ? (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="button"
              className="w-full sm:w-auto"
              size="lg"
              disabled={
                mutation.isPending || !hasReturnQty || returnTotalCents <= 0
              }
              onClick={completeReturn}
            >
              {mutation.isPending ? 'Completing return…' : 'Complete Return'}
            </Button>
          </section>
        </>
      )}
    </div>
  )
}