import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

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
        <div className="h-4 w-24 animate-pulse bg-neutral-100" />
        <div className="h-10 w-48 animate-pulse bg-neutral-100" />
        <div className="h-24 animate-pulse bg-neutral-100" />
      </div>
    )
  }

  if (saleQuery.error || !saleQuery.data) {
    if (saleQuery.error) logTechnicalError('getSale', saleQuery.error)
    return (
      <div>
        <Link
          to={backTo}
          className="mb-6 inline-block text-sm text-neutral-600 hover:text-black"
        >
          ← Sales
        </Link>
        <p className="text-sm text-red-700" role="alert">
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
    <div>
      <Link
        to={backTo}
        className="mb-6 inline-block text-sm text-neutral-600 hover:text-black"
      >
        ← Sales
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="app-heading">
            {sale.sale_number}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            {formatDateTime(sale.created_at)}
          </p>
        </div>
        {canReturn ? (
          <Link
            to={`/sales/${sale.id}/return`}
            className="inline-flex h-11 items-center justify-center rounded-sm border border-primary bg-primary px-4 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Return Items
          </Link>
        ) : null}
      </header>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide">
        Items
      </h2>
      <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
        {sale.items.map((item) => (
          <li key={item.id} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {item.product_name ?? 'Product'}
                </p>
                {item.product_code ? (
                  <p className="font-mono text-xs text-neutral-500">
                    {item.product_code}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-neutral-500">
                  Sold {item.quantity}
                  <span className="mx-1.5 text-neutral-300">·</span>
                  Returned {item.returned_quantity}
                  <span className="mx-1.5 text-neutral-300">·</span>
                  Remaining {item.remaining_quantity}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {item.quantity} × {formatMoney(item.unit_price)}
                  <span className="ml-2 text-xs uppercase tracking-wide text-neutral-400">
                    {item.price_type.toLowerCase()}
                  </span>
                </p>
              </div>
              <p className="tabular-nums font-medium">
                {formatMoney(item.total_amount)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium uppercase tracking-wide">Total</p>
        <p className="text-2xl tabular-nums font-medium">
          {formatMoney(sale.total_amount)}
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide">
          Payment
        </h2>
        {sale.payments.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            Payment not recorded
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
            {sale.payments.map((pay) => (
              <li
                key={pay.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span>{PAYMENT_METHOD_LABEL[pay.payment_method]}</span>
                <span className="tabular-nums font-medium">
                  {formatMoney(pay.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide">
          Returns
        </h2>
        {sale.returns.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">No returns</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
            {sale.returns.map((ret) => (
              <li key={ret.id} className="py-3">
                <Link
                  to={`/returns/${ret.id}`}
                  className="flex flex-col gap-1 hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{ret.return_number}</p>
                    <p className="text-sm text-neutral-600">
                      {formatDateTime(ret.created_at)}
                      {ret.refund
                        ? ` · ${PAYMENT_METHOD_LABEL[ret.refund.refund_method]} refund`
                        : ''}
                    </p>
                  </div>
                  <p className="tabular-nums font-medium">
                    {formatMoney(ret.total_amount)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex items-baseline justify-between gap-4 border-t border-border pt-6">
        <p className="text-sm font-medium uppercase tracking-wide">Net</p>
        <p className="text-2xl tabular-nums font-medium">
          {formatMoney(sale.net_amount)}
        </p>
      </div>

      <p className="mt-6 text-sm text-neutral-600">
        Sold by{' '}
        <span className="font-medium text-black">
          {sale.created_by_name ?? '—'}
        </span>
      </p>
    </div>
  )
}
