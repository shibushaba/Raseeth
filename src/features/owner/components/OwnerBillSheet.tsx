import { formatDateTime } from '@/lib/format'
import { formatMoney, parseMoney } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'
import type { SaleDetail } from '@/data/api'

export function OwnerBillSheet({
  sale,
  onClose,
}: {
  sale: SaleDetail
  onClose: () => void
}) {
  const totalCost = sale.items.reduce((s, item) => {
    const cost = item.unit_cost ? parseMoney(item.unit_cost) : 0
    return s + cost * item.quantity
  }, 0)
  const totalProfit = Number(sale.total_amount) - totalCost

  const payLabel =
    sale.payments.length === 1
      ? PAYMENT_METHOD_LABEL[sale.payments[0].payment_method]
      : sale.payments
          .map((p) => `${PAYMENT_METHOD_LABEL[p.payment_method]} ${formatMoney(p.amount)}`)
          .join(' · ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Transaction bill"
    >
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pb-2 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-extrabold text-gray-800">Transaction Bill</div>
              <div className="mt-0.5 text-xs text-gray-400">
                {sale.sale_number} · {formatDateTime(sale.created_at)}
                {sale.created_by_name ? ` · ${sale.created_by_name}` : ''}
              </div>
            </div>
            <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold uppercase text-indigo-700">
              {sale.payments[0]?.payment_method ?? 'SALE'}
            </span>
          </div>
          <div className="mt-1 text-xs font-medium text-gray-400">{payLabel}</div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-5">
          {sale.items.map((item) => {
            const unitCost = item.unit_cost ? parseMoney(item.unit_cost) : 0
            const cost = unitCost * item.quantity
            const finalTotal = Number(item.total_amount)
            const profit = finalTotal - cost

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
              >
                <div className="text-sm font-bold text-gray-800">
                  {item.product_name ?? 'Product'}
                </div>
                <div className="mb-2 text-xs text-gray-400">
                  Qty: {item.quantity}
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Retail Price</span>
                    <span className="font-semibold text-gray-700">
                      {formatMoney(item.unit_price)}
                    </span>
                  </div>
                  {item.unit_cost ? (
                    <div className="flex justify-between text-gray-400">
                      <span>Cost (WAC)</span>
                      <span className="font-semibold text-red-500">
                        {formatMoney(item.unit_cost)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-gray-800">
                    <span>Final Price</span>
                    <span className="text-violet-700">
                      {formatMoney(item.total_amount)}
                    </span>
                  </div>
                </div>
                {item.unit_cost ? (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-1.5">
                    <div className="text-xs text-gray-500">
                      Cost{' '}
                      <span className="font-semibold text-red-400">
                        {formatMoney(cost)}
                      </span>
                      <span className="mx-1 text-gray-300">·</span>
                      Profit
                    </div>
                    <span
                      className={`text-sm font-extrabold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
                    >
                      {profit >= 0 ? '+' : ''}
                      {formatMoney(profit)}
                    </span>
                  </div>
                ) : null}
              </div>
            )
          })}

          <div className="space-y-1.5 rounded-2xl border-2 border-indigo-100 p-4">
            <div className="mb-2 text-sm font-bold text-gray-700">Summary</div>
            <div className="flex justify-between font-extrabold text-gray-800">
              <span>Final Amount</span>
              <span className="text-violet-700">
                {formatMoney(sale.total_amount)}
              </span>
            </div>
            {totalCost > 0 ? (
              <div className="space-y-1 border-t border-gray-100 pt-1.5">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Total Cost</span>
                  <span className="font-semibold text-red-500">
                    {formatMoney(totalCost)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-extrabold">
                  <span className="text-emerald-700">Gross Profit</span>
                  <span
                    className={
                      totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }
                  >
                    {totalProfit >= 0 ? '+' : ''}
                    {formatMoney(totalProfit)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-indigo-700 py-3.5 font-extrabold text-white active:bg-indigo-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
