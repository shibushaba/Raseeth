import type { IconSvgElement } from '@hugeicons/react'
import { useEffect, useId, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { AppIcon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  BanknoteIcon,
  CreditCardIcon,
  Money03Icon,
  SmartPhone01Icon,
} from '@/lib/icons'
import { formatMoney, fromCents, parseMoney, toCents } from '@/lib/money'
import { PAYMENT_METHOD_LABEL } from '@/lib/payment-labels'
import type { PaymentMethod } from '@/types/database'
import { cn } from '@/lib/utils'

export type PaymentMode = PaymentMethod | 'SPLIT'

export type SplitPaymentRow = {
  id: string
  method: PaymentMethod
  amount: string
}

const METHOD_META: Record<
  PaymentMethod | 'SPLIT',
  { label: string; icon: IconSvgElement }
> = {
  CASH: { label: 'Cash', icon: BanknoteIcon },
  UPI: { label: 'UPI', icon: SmartPhone01Icon },
  CARD: { label: 'Card', icon: CreditCardIcon },
  SPLIT: { label: 'Split', icon: Money03Icon },
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
    <div className="space-y-4">
      <div className="hero-violet">
        <p className="text-sm font-semibold opacity-80">Amount to collect</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums">
          {formatMoney(saleTotal)}
        </p>
      </div>

      <fieldset>
        <legend className="eyebrow px-1">Payment</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(['CASH', 'UPI', 'CARD', 'SPLIT'] as const).map((value) => {
            const meta = METHOD_META[value]
            const selected = mode === value
            return (
              <label
                key={value}
                className={cn(
                  'flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center transition-all',
                  selected
                    ? 'border-accent bg-accent-soft/60 dark:bg-violet-950/40'
                    : 'border-border bg-surface hover:bg-accent-soft/30',
                )}
              >
                <input
                  type="radio"
                  name={groupId}
                  value={value}
                  checked={selected}
                  onChange={() => onModeChange(value)}
                  className="sr-only"
                />
                <AppIcon
                  icon={meta.icon}
                  size="lg"
                  className={selected ? 'text-accent' : 'text-muted'}
                />
                <span className="text-sm font-bold text-foreground">
                  {meta.label}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {mode !== 'SPLIT' ? (
        <div className="muted-panel rounded-2xl px-4 py-3 text-center">
          <p className="text-2xl font-extrabold tabular-nums">
            {formatMoney(saleTotal)}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {PAYMENT_METHOD_LABEL[mode]}
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
                    className="mb-1 block eyebrow"
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
                    className="mb-1 block eyebrow"
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
                  className="mb-0.5 text-muted"
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

          <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="font-medium text-muted">Total</span>
              <span className="font-bold tabular-nums">
                {formatMoney(saleTotal)}
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="font-medium text-muted">Paid</span>
              <span className="font-bold tabular-nums">
                {formatMoney(fromCents(paidCents))}
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="font-medium text-muted">Remaining</span>
              <span
                className={cn(
                  'font-bold tabular-nums',
                  remainingCents === 0
                    ? 'text-success'
                    : remainingCents > 0
                      ? 'text-danger'
                      : 'text-warning',
                )}
              >
                {formatMoney(fromCents(Math.max(0, remainingCents)))}
              </span>
            </div>
            {showValidation && excess > 0 ? (
              <p className="mt-2 text-sm font-medium text-danger" role="alert">
                Over by {formatMoney(excess)}
              </p>
            ) : null}
            {showValidation && remainingCents > 0 ? (
              <p className="mt-2 text-sm text-muted" role="status">
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
