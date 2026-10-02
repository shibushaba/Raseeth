import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Receipt } from 'lucide-react'

import { PortalBackBar, PortalCard } from '@/components/ui/portal-field'
import { getSale } from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { screenPadAboveBottomNav } from '@/lib/layout'
import { formatMoney, parseMoney } from '@/lib/money'
import { printSaleReceipt } from '@/lib/print-sale-receipt'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'

export function SaleDetailPage() {
  const { saleId = '' } = useParams()
  const navigate = useNavigate()
  const { permissions, role } = useAuth()
  const isOwner = role === 'OWNER'
  const backTo = '/sales'

  const saleQuery = useQuery({
    queryKey: queryKeys.sales.detail(saleId),
    queryFn: () => getSale(saleId),
    enabled: Boolean(saleId),
  })

  if (saleQuery.isLoading) {
    return (
      <div className="space-y-4 p-4" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-accent-soft" />
        <div className="h-32 animate-pulse rounded-2xl bg-accent-soft" />
      </div>
    )
  }

  if (saleQuery.error || !saleQuery.data) {
    if (saleQuery.error) logTechnicalError('getSale', saleQuery.error)
    return (
      <div className="p-4">
        <PortalBackBar title="Sale" onBack={() => navigate(backTo)} />
        <p className="mt-4 text-sm text-danger" role="alert">
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
  const units = sale.items.reduce((s, i) => s + i.quantity, 0)
  const primaryPayment =
    sale.payments[0]?.payment_method != null
      ? PAYMENT_METHOD_LABEL[sale.payments[0].payment_method]
      : '—'

  async function handlePrint() {
    const ok = await printSaleReceipt({
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
      pricing:
        Number(sale.discount_amount) > 0 ||
        Number(sale.tax_amount) > 0 ||
        Number(sale.other_charges) > 0
          ? {
              subtotal: Number(sale.subtotal_amount ?? sale.total_amount),
              discount: Number(sale.discount_amount),
              tax: Number(sale.tax_amount),
              other: Number(sale.other_charges),
              note: sale.adjustment_note,
            }
          : undefined,
    })
    if (!ok) {
      window.alert('Unable to download receipt PDF. Please try again.')
    }
  }

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-lg flex-col"
      style={screenPadAboveBottomNav}
    >
      <PortalBackBar
        title={isOwner ? 'Transaction Bill' : 'Sale Receipt'}
        subtitle={sale.sale_number}
        onBack={() => navigate(backTo)}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-violet-700 p-5 text-white shadow-md">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Receipt className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                Amount collected
              </p>
              <p className="text-3xl font-black tabular-nums">
                {formatMoney(sale.total_amount)}
              </p>
              <p className="mt-1 text-xs opacity-80">
                {formatDateTime(sale.created_at)}
                {sale.created_by_name ? ` · ${sale.created_by_name}` : ''}
              </p>
            </div>
          </div>

          {Number(sale.discount_amount) > 0 ||
          Number(sale.tax_amount) > 0 ||
          Number(sale.other_charges) > 0 ? (
            <div className="mt-4 space-y-1 rounded-xl bg-white/10 px-3 py-2 text-sm">
              <div className="flex justify-between opacity-90">
                <span>Subtotal</span>
                <span>
                  {formatMoney(sale.subtotal_amount ?? sale.total_amount)}
                </span>
              </div>
              {Number(sale.discount_amount) > 0 ? (
                <div className="flex justify-between text-emerald-100">
                  <span>Discount</span>
                  <span>−{formatMoney(sale.discount_amount)}</span>
                </div>
              ) : null}
              {Number(sale.tax_amount) > 0 ? (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>+{formatMoney(sale.tax_amount)}</span>
                </div>
              ) : null}
              {Number(sale.other_charges) > 0 ? (
                <div className="flex justify-between">
                  <span>Other</span>
                  <span>+{formatMoney(sale.other_charges)}</span>
                </div>
              ) : null}
            </div>
          ) : null}
          {sale.adjustment_note ? (
            <p className="mt-2 text-xs opacity-80">{sale.adjustment_note}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-muted">Items</p>
            <p className="mt-1 text-lg font-black text-foreground">{units}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase text-muted">Payment</p>
            <p className="mt-1 text-sm font-extrabold text-foreground">
              {primaryPayment}
            </p>
          </div>
        </div>

        {canReturn ? (
          <Link
            to={`/sales/${sale.id}/return`}
            className="flex items-center justify-between rounded-2xl border-2 border-accent bg-accent-soft/30 px-4 py-3.5 text-sm font-extrabold text-accent"
          >
            Return items
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}

        <PortalCard title="Items">
          <ul className="divide-y divide-border">
            {sale.items.map((item) => {
              const unitCost = item.unit_cost ? parseMoney(item.unit_cost) : 0
              const cost = unitCost * item.quantity
              const profit = Number(item.total_amount) - cost

              return (
                <li key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground">
                        {item.product_name ?? 'Product'}
                      </div>
                      {item.product_code ? (
                        <div className="text-xs text-muted">{item.product_code}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-muted">
                        {item.quantity} × {formatMoney(item.unit_price)}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-black text-accent">
                      {formatMoney(item.total_amount)}
                    </span>
                  </div>
                  {isOwner && item.unit_cost ? (
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-1.5 text-xs">
                      <span className="text-muted">
                        Cost {formatMoney(cost)} · Profit
                      </span>
                      <span className="font-extrabold text-success">
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
          <ul className="grid grid-cols-2 gap-2 p-4">
            {sale.payments.length === 0 ? (
              <li className="col-span-2 text-sm text-muted">
                Payment not recorded
              </li>
            ) : (
              sale.payments.map((pay) => (
                <li
                  key={pay.id}
                  className="rounded-xl border border-border bg-accent-soft/30 p-3"
                >
                  <p className="text-[10px] font-bold uppercase text-muted">
                    {PAYMENT_METHOD_LABEL[pay.payment_method]}
                  </p>
                  <p className="mt-1 text-sm font-black text-foreground">
                    {formatMoney(pay.amount)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </PortalCard>

        {isOwner && totalCost > 0 ? (
          <div className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-border p-4">
            <div>
              <p className="text-xs font-bold text-muted">Total cost</p>
              <p className="text-sm font-black text-danger">
                {formatMoney(totalCost)}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted">Gross profit</p>
              <p className="text-sm font-black text-success">
                +{formatMoney(totalProfit)}
              </p>
            </div>
          </div>
        ) : null}

        {sale.returns.length > 0 ? (
          <PortalCard title="Returns">
            <ul className="divide-y divide-border">
              {sale.returns.map((ret) => (
                <li key={ret.id}>
                  <Link
                    to={`/returns/${ret.id}`}
                    className="flex items-center justify-between p-4"
                  >
                    <div>
                      <p className="text-sm font-bold">{ret.return_number}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(ret.created_at)}
                      </p>
                    </div>
                    <span className="font-bold text-danger">
                      {formatMoney(ret.total_amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </PortalCard>
        ) : null}
      </div>

      <div className="border-t border-border bg-surface/95 p-4 backdrop-blur">
        <button
          type="button"
          onClick={() => void handlePrint()}
          className="w-full rounded-2xl bg-accent py-3.5 text-sm font-extrabold text-white shadow-md active:bg-violet-700"
        >
          Print receipt
        </button>
      </div>
    </div>
  )
}
