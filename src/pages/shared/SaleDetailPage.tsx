import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PortalBackBar, PortalCard } from '@/components/ui/portal-field'
import { getSale } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { formatMoney, parseMoney } from '@/lib/money'
import { printSaleReceipt } from '@/lib/print-sale-receipt'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'

export function SaleDetailPage() {
  const { saleId = '' } = useParams()
  const navigate = useNavigate()
  const { permissions, role } = useAuth()
  const isOwner = role === 'OWNER'
  const backTo = permissions.canCreateSale ? '/sales' : '/sales'

  const saleQuery = useQuery({
    queryKey: queryKeys.sales.detail(saleId),
    queryFn: () => getSale(saleId),
    enabled: Boolean(saleId),
  })

  if (saleQuery.isLoading) {
    return (
      <div className="space-y-4 p-4" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-violet-50" />
        <div className="h-32 animate-pulse rounded-2xl bg-violet-50" />
      </div>
    )
  }

  if (saleQuery.error || !saleQuery.data) {
    if (saleQuery.error) logTechnicalError('getSale', saleQuery.error)
    return (
      <div className="p-4">
        <PortalBackBar title="Sale" onBack={() => navigate(backTo)} />
        <p className="mt-4 text-sm text-red-600" role="alert">
          {toUserMessage(saleQuery.error, 'That sale could not be found.')}
        </p>
      </div>
    )
  }

  const sale = saleQuery.data
  const canReturn =
    permissions.canCreateReturn &&
    sale.items.some((i) => i.remaining_quantity > 0)

  const totalCost = sale.items.reduce((s, item) => {
    const cost = item.unit_cost ? parseMoney(item.unit_cost) : 0
    return s + cost * item.quantity
  }, 0)
  const totalProfit = Number(sale.total_amount) - totalCost

  function handlePrint() {
    printSaleReceipt({
      sale_number: sale.sale_number,
      created_at: sale.created_at,
      total_amount: Number(sale.total_amount),
      items: sale.items.map((item) => ({
        name: item.product_name ?? 'Product',
        product_code: item.product_code,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        line_total: Number(item.total_amount),
      })),
      payments: sale.payments.map((p) => ({
        method: p.payment_method,
        amount: Number(p.amount),
      })),
      sold_by: sale.created_by_name,
    })
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-lg flex-col">
      <PortalBackBar
        title={isOwner ? 'Transaction Bill' : 'Sale Receipt'}
        subtitle={sale.sale_number}
        onBack={() => navigate(backTo)}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl bg-violet-600 p-4 text-white">
          <div className="text-xs font-semibold opacity-70">Total</div>
          <div className="text-3xl font-black">{formatMoney(sale.total_amount)}</div>
          <div className="mt-1 text-xs opacity-70">
            {formatDateTime(sale.created_at)}
            {sale.created_by_name ? ` · ${sale.created_by_name}` : ''}
          </div>
        </div>

        {canReturn ? (
          <Link
            to={`/sales/${sale.id}/return`}
            className="block rounded-2xl border-2 border-violet-600 py-3 text-center text-sm font-extrabold text-violet-600"
          >
            Return Items
          </Link>
        ) : null}

        <PortalCard title="Items">
          <ul className="divide-y divide-violet-50">
            {sale.items.map((item) => {
              const unitCost = item.unit_cost ? parseMoney(item.unit_cost) : 0
              const cost = unitCost * item.quantity
              const profit = Number(item.total_amount) - cost

              return (
                <li key={item.id} className="p-4">
                  <div className="text-sm font-bold text-gray-800">
                    {item.product_name ?? 'Product'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.quantity} × {formatMoney(item.unit_price)}
                  </div>
                  <div className="mt-2 flex justify-between text-sm font-extrabold">
                    <span className="text-gray-600">Line total</span>
                    <span className="text-violet-700">
                      {formatMoney(item.total_amount)}
                    </span>
                  </div>
                  {isOwner && item.unit_cost ? (
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-1.5 text-xs">
                      <span className="text-gray-500">
                        Cost {formatMoney(cost)} · Profit
                      </span>
                      <span className="font-extrabold text-emerald-700">
                        +{formatMoney(profit)}
                      </span>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </PortalCard>

        <PortalCard title="Payment">
          <ul className="space-y-2 p-4">
            {sale.payments.length === 0 ? (
              <li className="text-sm text-gray-400">Payment not recorded</li>
            ) : (
              sale.payments.map((pay) => (
                <li
                  key={pay.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-500">
                    {PAYMENT_METHOD_LABEL[pay.payment_method]}
                  </span>
                  <span className="font-bold">{formatMoney(pay.amount)}</span>
                </li>
              ))
            )}
          </ul>
        </PortalCard>

        {isOwner && totalCost > 0 ? (
          <div className="rounded-2xl border-2 border-indigo-100 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Cost</span>
              <span className="font-bold text-red-500">{formatMoney(totalCost)}</span>
            </div>
            <div className="mt-2 flex justify-between font-extrabold">
              <span className="text-emerald-700">Gross Profit</span>
              <span className="text-emerald-700">
                +{formatMoney(totalProfit)}
              </span>
            </div>
          </div>
        ) : null}

        {sale.returns.length > 0 ? (
          <PortalCard title="Returns">
            <ul className="divide-y divide-violet-50">
              {sale.returns.map((ret) => (
                <li key={ret.id}>
                  <Link
                    to={`/returns/${ret.id}`}
                    className="flex items-center justify-between p-4"
                  >
                    <div>
                      <p className="text-sm font-bold">{ret.return_number}</p>
                      <p className="text-xs text-gray-400">
                        {formatDateTime(ret.created_at)}
                      </p>
                    </div>
                    <span className="font-bold text-red-500">
                      {formatMoney(ret.total_amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </PortalCard>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-violet-100 bg-white p-4">
        <button
          type="button"
          onClick={handlePrint}
          className="w-full rounded-2xl border-2 border-violet-600 py-3.5 text-sm font-extrabold text-violet-600"
        >
          Print Receipt
        </button>
      </div>
    </div>
  )
}
