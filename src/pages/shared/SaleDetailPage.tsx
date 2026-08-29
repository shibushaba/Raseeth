import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { Card, CardBody } from '@/components/ui/card'
import { getSale } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'

export function SaleDetailPage() {
  const { saleId = '' } = useParams()
  const { permissions } = useAuth()
  const backTo = permissions.canCreateSale ? '/sales/history' : '/sales'

  const saleQuery = useQuery({
    queryKey: queryKeys.sales.detail(saleId),
    queryFn: () => getSale(saleId),
    enabled: Boolean(saleId),
  })

  if (saleQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="card h-4 w-24 animate-pulse bg-stone-50 dark:bg-stone-800/50" />
        <div className="card h-10 w-48 animate-pulse bg-stone-50 dark:bg-stone-800/50" />
        <div className="card h-24 animate-pulse bg-stone-50 dark:bg-stone-800/50" />
      </div>
    )
  }

  if (saleQuery.error || !saleQuery.data) {
    if (saleQuery.error) logTechnicalError('getSale', saleQuery.error)
    return (
      <div>
        <Link
          to={backTo}
          className="mb-6 inline-block text-sm text-muted hover:text-foreground"
        >
          ← Sales
        </Link>
        <p className="text-sm text-danger" role="alert">
          {toUserMessage(saleQuery.error, 'That sale could not be found.')}
        </p>
      </div>
    )
  }

  const sale = saleQuery.data
  const canReturn =
    permissions.canCreateReturn &&
    sale.items.some((i) => i.remaining_quantity > 0)

  return (
    <div className="mx-auto max-w-lg">
      <Link
        to={backTo}
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        ← Sales
      </Link>

      <Card>
        <CardBody className="space-y-6 py-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="eyebrow">Sale receipt</p>
              <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">
                {sale.sale_number}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {formatDateTime(sale.created_at)}
              </p>
            </div>
            {canReturn ? (
              <Link
                to={`/sales/${sale.id}/return`}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Return Items
              </Link>
            ) : null}
          </header>

          <div className="border-t border-dashed border-border pt-4">
            <p className="section-label mb-3">Items</p>
            <ul className="divide-y divide-dashed divide-border">
              {sale.items.map((item) => (
                <li key={item.id} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {item.product_name ?? 'Product'}
                      </p>
                      {item.product_code ? (
                        <p className="font-mono text-xs text-muted">
                          {item.product_code}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-muted">
                        {item.quantity} × {formatMoney(item.unit_price)}
                        <span className="ml-2 text-xs capitalize">
                          ({item.price_type.toLowerCase()})
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Sold {item.quantity}
                        <span className="mx-1.5">·</span>
                        Returned {item.returned_quantity}
                        <span className="mx-1.5">·</span>
                        Remaining {item.remaining_quantity}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums font-semibold">
                      {formatMoney(item.total_amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-border pt-4">
            <span className="section-label">Total</span>
            <span className="text-2xl tabular-nums font-semibold">
              {formatMoney(sale.total_amount)}
            </span>
          </div>

          <div className="border-t border-dashed border-border pt-4">
            <p className="section-label mb-3">Payment</p>
            {sale.payments.length === 0 ? (
              <p className="section-hint">Payment not recorded</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {sale.payments.map((pay) => (
                  <li
                    key={pay.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-muted">
                      {PAYMENT_METHOD_LABEL[pay.payment_method]}
                    </span>
                    <span className="tabular-nums font-semibold">
                      {formatMoney(pay.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {sale.returns.length > 0 ? (
            <div className="border-t border-dashed border-border pt-4">
              <p className="section-label mb-3">Returns</p>
              <ul className="divide-y divide-border">
                {sale.returns.map((ret) => (
                  <li key={ret.id}>
                    <Link
                      to={`/returns/${ret.id}`}
                      className="row-hover flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{ret.return_number}</p>
                        <p className="text-sm text-muted">
                          {formatDateTime(ret.created_at)}
                          {ret.refund
                            ? ` · ${PAYMENT_METHOD_LABEL[ret.refund.refund_method]} refund`
                            : ''}
                        </p>
                      </div>
                      <p className="tabular-nums font-semibold">
                        {formatMoney(ret.total_amount)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-baseline justify-between gap-4 border-t border-dashed border-border pt-4">
            <span className="section-label">Net</span>
            <span className="text-2xl tabular-nums font-semibold">
              {formatMoney(sale.net_amount)}
            </span>
          </div>

          <p className="border-t border-dashed border-border pt-4 text-center text-sm text-muted">
            Sold by{' '}
            <span className="font-medium text-foreground">
              {sale.created_by_name ?? '—'}
            </span>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
