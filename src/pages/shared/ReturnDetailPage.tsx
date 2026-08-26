import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { getReturn } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { formatDateTime } from '@/lib/format'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'

export function ReturnDetailPage() {
  const { returnId = '' } = useParams()

  const returnQuery = useQuery({
    queryKey: queryKeys.returns.detail(returnId),
    queryFn: () => getReturn(returnId),
    enabled: Boolean(returnId),
  })

  if (returnQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-4 w-24 animate-pulse bg-neutral-100" />
        <div className="h-10 w-48 animate-pulse bg-neutral-100" />
      </div>
    )
  }

  if (returnQuery.error || !returnQuery.data) {
    if (returnQuery.error) logTechnicalError('getReturn', returnQuery.error)
    return (
      <div>
        <p className="text-sm text-red-700" role="alert">
          {toUserMessage(returnQuery.error, 'That return could not be found.')}
        </p>
      </div>
    )
  }

  const ret = returnQuery.data

  return (
    <div>
      {ret.sale_id ? (
        <Link
          to={`/sales/${ret.sale_id}`}
          className="mb-6 inline-block text-sm text-neutral-600 hover:text-black"
        >
          ← {ret.sale_number ?? 'Sale'}
        </Link>
      ) : null}

      <header>
        <h1 className="app-heading">
          {ret.return_number}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {formatDateTime(ret.created_at)}
        </p>
      </header>

      {ret.sale_number ? (
        <p className="mt-6 text-sm text-neutral-600">
          Original sale{' '}
          <Link
            to={`/sales/${ret.sale_id}`}
            className="font-medium text-black underline"
          >
            {ret.sale_number}
          </Link>
        </p>
      ) : null}

      <ul className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
        {ret.items.map((item) => (
          <li key={item.id} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{item.product_name ?? 'Product'}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {item.quantity} × {formatMoney(item.unit_price)}
                </p>
              </div>
              <p className="tabular-nums font-medium">
                {formatMoney(item.total_amount)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide">Refund</h2>
        {ret.refund ? (
          <div className="mt-3 flex items-center justify-between gap-4 border-y border-neutral-200 py-3">
            <span>{PAYMENT_METHOD_LABEL[ret.refund.refund_method]}</span>
            <span className="tabular-nums font-medium">
              {formatMoney(ret.refund.amount)}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-600">Refund not recorded</p>
        )}
      </section>

      <p className="mt-6 text-sm text-neutral-600">
        Created by{' '}
        <span className="font-medium text-black">
          {ret.created_by_name ?? '—'}
        </span>
      </p>
    </div>
  )
}
