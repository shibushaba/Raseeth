import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function PortalField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

export function PortalTextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  id,
  name,
  inputMode,
  min,
  step,
}: {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  id?: string
  name?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel'
  min?: number
  step?: string | number
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      inputMode={inputMode}
      min={min}
      step={step}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-xl border border-border bg-accent-soft/50 px-4 py-3 text-sm font-semibold text-foreground placeholder-muted outline-none transition-colors focus:border-accent"
    />
  )
}

export function PortalPriceInput({
  value,
  onChange,
  placeholder,
  id,
  name,
  required,
}: {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  id?: string
  name?: string
  required?: boolean
}) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
        ₹
      </span>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-border bg-accent-soft/50 py-3 pl-8 pr-4 text-sm font-semibold text-foreground placeholder-muted outline-none transition-colors focus:border-accent"
      />
    </div>
  )
}

export function PortalCard({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-surface shadow-sm',
        className,
      )}
    >
      {title ? (
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
        </div>
      ) : null}
      {children}
    </div>
  )
}

export function PortalBackBar({
  title,
  subtitle,
  onBack,
}: {
  title: string
  subtitle?: string
  onBack: () => void
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent"
        aria-label="Go back"
      >
        ←
      </button>
      <div>
        <h2 className="font-extrabold text-foreground">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-muted">{subtitle}</p>
        ) : null}
      </div>
    </div>
  )
}
