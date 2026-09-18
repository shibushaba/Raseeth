import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/money'
import {
  type ResolvedSaleAdjustments,
  type SaleAdjustmentInput,
} from '@/lib/sale-adjustments'
import { cn } from '@/lib/utils'

function ModeToggle({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: 'amount' | 'percent') => void
  options: { id: 'amount' | 'percent'; label: string }[]
}) {
  return (
    <div className="flex rounded-lg bg-accent-soft/60 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'flex-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide',
            value === opt.id
              ? 'bg-surface text-accent shadow-sm'
              : 'text-muted',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SaleAdjustmentsPanel({
  input,
  onChange,
  resolved,
}: {
  input: SaleAdjustmentInput
  onChange: (next: SaleAdjustmentInput) => void
  resolved: ResolvedSaleAdjustments
}) {
  function patch(partial: Partial<SaleAdjustmentInput>) {
    onChange({ ...input, ...partial })
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="eyebrow">Discount &amp; tax</div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted">Discount</span>
          <ModeToggle
            value={input.discountMode}
            onChange={(m) => patch({ discountMode: m })}
            options={[
              { id: 'amount', label: '₹' },
              { id: 'percent', label: '%' },
            ]}
          />
        </div>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder={input.discountMode === 'percent' ? 'e.g. 10' : '0.00'}
          value={
            input.discountMode === 'percent'
              ? input.discountPercent
              : input.discountAmount
          }
          onChange={(e) =>
            patch(
              input.discountMode === 'percent'
                ? { discountPercent: e.target.value }
                : { discountAmount: e.target.value },
            )
          }
          aria-label="Discount"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted">GST / tax</span>
          <ModeToggle
            value={input.taxMode}
            onChange={(m) => patch({ taxMode: m })}
            options={[
              { id: 'percent', label: '%' },
              { id: 'amount', label: '₹' },
            ]}
          />
        </div>
        <div className="flex gap-2">
          {input.taxMode === 'percent' ? (
            <>
              {['5', '12', '18', '28'].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => patch({ taxPercent: pct })}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-bold',
                    input.taxPercent === pct
                      ? 'bg-accent text-white'
                      : 'bg-accent-soft text-accent',
                  )}
                >
                  {pct}%
                </button>
              ))}
              <Input
                className="min-w-0 flex-1"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="%"
                value={input.taxPercent}
                onChange={(e) => patch({ taxPercent: e.target.value })}
                aria-label="GST percent"
              />
            </>
          ) : (
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="Tax amount"
              value={input.taxAmount}
              onChange={(e) => patch({ taxAmount: e.target.value })}
              aria-label="Tax amount"
            />
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-muted" htmlFor="sale-other-charges">
          Other charges
        </label>
        <Input
          id="sale-other-charges"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={input.otherCharges}
          onChange={(e) => patch({ otherCharges: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-muted" htmlFor="sale-adj-note">
          Note (optional)
        </label>
        <Input
          id="sale-adj-note"
          type="text"
          placeholder="e.g. Festival offer"
          value={input.note}
          onChange={(e) => patch({ note: e.target.value })}
        />
      </div>

      <div className="space-y-1 border-t border-dashed border-border pt-3 text-sm">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span>
          <span className="font-semibold tabular-nums">
            {formatMoney(resolved.subtotal)}
          </span>
        </div>
        {resolved.discount > 0 ? (
          <div className="flex justify-between text-emerald-600">
            <span>Discount</span>
            <span className="font-semibold tabular-nums">
              −{formatMoney(resolved.discount)}
            </span>
          </div>
        ) : null}
        {resolved.tax > 0 ? (
          <div className="flex justify-between text-muted">
            <span>GST / tax</span>
            <span className="font-semibold tabular-nums">
              +{formatMoney(resolved.tax)}
            </span>
          </div>
        ) : null}
        {resolved.other > 0 ? (
          <div className="flex justify-between text-muted">
            <span>Other</span>
            <span className="font-semibold tabular-nums">
              +{formatMoney(resolved.other)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between pt-1 text-base font-extrabold text-foreground">
          <span>Total</span>
          <span className="tabular-nums text-accent">
            {formatMoney(resolved.grandTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
