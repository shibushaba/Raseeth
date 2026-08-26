import { useEffect, useId, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatMoney, fromCents, parseMoney, toCents } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'
import type { PaymentMethod } from '@/types/database'

export type PaymentMode = PaymentMethod | 'SPLIT'

export type SplitPaymentRow = {
  id: string
  method: PaymentMethod
  amount: string
}

export function PaymentPanel({
  saleTotal,
  mode,
  onModeChange,
  splitRows,
  onSplitRowsChange,
  showValidation = true,
}: {
  saleTotal: number
  mode: PaymentMode
  onModeChange: (mode: PaymentMode) => void
  splitRows: SplitPaymentRow[]
  onSplitRowsChange: (rows: SplitPaymentRow[]) => void
  showValidation?: boolean
}) {
  const groupId = useId()
  const firstSplitRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode === 'SPLIT') {
      firstSplitRef.current?.focus()
    }
  }, [mode])

  const paidCents = splitRows.reduce(
    (acc, row) => acc + toCents(row.amount || 0),
    0,
  )
  const totalCents = toCents(saleTotal)
  const remainingCents = totalCents - paidCents
  const remaining = fromCents(remainingCents)
  const excess = fromCents(Math.max(0, -remainingCents))

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="app-kicker">Payment</legend>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {(
            [
              ['CASH', 'Cash'],
              ['UPI', 'UPI'],
              ['CARD', 'Card'],
              ['SPLIT', 'Split'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 py-2.5 text-sm ${
                mode === value
                  ? 'border-border-strong bg-neutral-50'
                  : 'border-border'
              }`}
            >
              <input
                type="radio"
                name={groupId}
                value={value}
                checked={mode === value}
                onChange={() => onModeChange(value)}
                className="accent-black"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {mode !== 'SPLIT' ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Pay with {PAYMENT_METHOD_LABEL[mode]}
          </p>
          <p className="mt-1 text-xl tabular-nums font-medium">
            {formatMoney(saleTotal)}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {splitRows.map((row, index) => (
              <li
                key={row.id}
                className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
              >
                <div>
                  <label
                    className="mb-1 block text-xs uppercase tracking-wide text-neutral-500"
                    htmlFor={`pay-method-${row.id}`}
                  >
                    Method
                  </label>
                  <Select
                    id={`pay-method-${row.id}`}
                    value={row.method}
                    onChange={(e) => {
                      const method = e.target.value as PaymentMethod
                      onSplitRowsChange(
                        splitRows.map((r) =>
                          r.id === row.id ? { ...r, method } : r,
                        ),
                      )
                    }}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                  </Select>
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs uppercase tracking-wide text-neutral-500"
                    htmlFor={`pay-amount-${row.id}`}
                  >
                    Amount
                  </label>
                  <Input
                    ref={index === 0 ? firstSplitRef : undefined}
                    id={`pay-amount-${row.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => {
                      onSplitRowsChange(
                        splitRows.map((r) =>
                          r.id === row.id
                            ? { ...r, amount: e.target.value }
                            : r,
                        ),
                      )
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
                    aria-label={`${PAYMENT_METHOD_LABEL[row.method]} amount`}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  className="mb-0.5"
                  disabled={splitRows.length <= 1}
                  aria-label={`Remove ${PAYMENT_METHOD_LABEL[row.method]} payment`}
                  onClick={() =>
                    onSplitRowsChange(splitRows.filter((r) => r.id !== row.id))
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() =>
              onSplitRowsChange([
                ...splitRows,
                {
                  id: crypto.randomUUID(),
                  method: 'UPI',
                  amount: '',
                },
              ])
            }
          >
            Add payment
          </Button>

          <div className="border-t border-neutral-200 pt-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-neutral-600">Paid</span>
              <span className="tabular-nums font-medium">
                {formatMoney(fromCents(paidCents))}
              </span>
            </div>
            <div className="mt-1 flex justify-between gap-4">
              <span className="text-neutral-600">Remaining</span>
              <span className="tabular-nums font-medium">
                {formatMoney(fromCents(Math.max(0, remainingCents)))}
              </span>
            </div>
            {showValidation && excess > 0 ? (
              <p className="mt-2 text-sm text-red-700" role="alert">
                Payment exceeds sale total by {formatMoney(excess)}.
              </p>
            ) : null}
            {showValidation && remainingCents > 0 ? (
              <p className="mt-2 text-sm text-neutral-700" role="status">
                {formatMoney(remaining)} remaining
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export function buildPaymentsFromMode(
  mode: PaymentMode,
  saleTotal: number,
  splitRows: SplitPaymentRow[],
): Array<{ method: PaymentMethod; amount: number }> {
  if (mode !== 'SPLIT') {
    return [{ method: mode, amount: parseMoney(saleTotal) }]
  }
  return splitRows
    .map((row) => ({
      method: row.method,
      amount: parseMoney(row.amount),
    }))
    .filter((row) => row.amount > 0)
}

export function paymentStatus(
  mode: PaymentMode,
  saleTotal: number,
  splitRows: SplitPaymentRow[],
): { valid: boolean; message: string | null } {
  const payments = buildPaymentsFromMode(mode, saleTotal, splitRows)
  if (payments.length === 0) {
    return { valid: false, message: 'At least one payment is required' }
  }
  if (payments.some((p) => !(p.amount > 0))) {
    return {
      valid: false,
      message: 'Payment amount must be greater than zero.',
    }
  }
  const paidCents = payments.reduce((acc, p) => acc + toCents(p.amount), 0)
  const totalCents = toCents(saleTotal)
  if (paidCents < totalCents) {
    return {
      valid: false,
      message: `${formatMoney(fromCents(totalCents - paidCents))} remaining`,
    }
  }
  if (paidCents > totalCents) {
    return {
      valid: false,
      message: `Payment exceeds sale total by ${formatMoney(fromCents(paidCents - totalCents))}.`,
    }
  }
  return { valid: true, message: null }
}
