import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PortalBackBar, PortalCard } from '@/components/ui/portal-field'
import { getReturn } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { formatDateTime } from '@/lib/format'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'

export function ReturnDetailPage() {
  const { returnId = '' } = useParams()
  const navigate = useNavigate()

  const returnQuery = useQuery({
    queryKey: queryKeys.returns.detail(returnId),
    queryFn: () => getReturn(returnId),
    enabled: Boolean(returnId),
  })

  if (returnQuery.isLoading) {
    return (
      <div className="space-y-4 p-4" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-accent-soft" />
        <div className="h-32 animate-pulse rounded-2xl bg-accent-soft" />
      </div>
    )
  }

  if (returnQuery.error || !returnQuery.data) {
    if (returnQuery.error) logTechnicalError('getReturn', returnQuery.error)
    return (
      <div className="p-4">
        <PortalBackBar title="Return" onBack={() => navigate('/sales')} />
        <p className="mt-4 text-sm text-danger" role="alert">
          {toUserMessage(returnQuery.error, 'That return could not be found.')}
        </p>
      </div>
    )
  }

  const ret = returnQuery.data

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <PortalBackBar
        title={ret.return_number}
        subtitle={ret.sale_number ? `Sale ${ret.sale_number}` : undefined}
        onBack={() =>
          navigate(ret.sale_id ? `/sales/${ret.sale_id}` : '/sales')
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl bg-danger p-4 text-white shadow-md">
          <div className="text-xs font-semibold opacity-70">Return Total</div>
          <div className="text-3xl font-black">{formatMoney(ret.total_amount)}</div>
          <div className="mt-1 text-xs opacity-70">
            {formatDateTime(ret.created_at)}
            {ret.created_by_name ? ` · ${ret.created_by_name}` : ''}
          </div>
        </div>

        {ret.sale_number ? (
          <Link
            to={`/sales/${ret.sale_id}`}
            className="block rounded-2xl border-2 border-accent py-3 text-center text-sm font-extrabold text-accent transition-colors hover:bg-accent-soft/30"
          >
            View Original Sale
          </Link>
        ) : null}

        <PortalCard title="Returned Items">
          <ul className="divide-y divide-border">
            {ret.items.map((item) => (
              <li key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {item.product_name ?? 'Product'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {item.quantity} × {formatMoney(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-bold tabular-nums text-foreground">
                    {formatMoney(item.total_amount)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </PortalCard>

        <PortalCard title="Refund">
          {ret.refund ? (
            <div className="flex items-center justify-between p-4">
              <span className="text-sm text-muted">
                {PAYMENT_METHOD_LABEL[ret.refund.refund_method]}
              </span>
              <span className="font-bold tabular-nums">
                {formatMoney(ret.refund.amount)}
              </span>
            </div>
          ) : (
            <p className="p-4 text-sm text-muted">Refund not recorded</p>
          )}
        </PortalCard>
      </div>
    </div>
  )
}
