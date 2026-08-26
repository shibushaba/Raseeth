import { LOW_STOCK_THRESHOLD } from '@/lib/stock'

/**
 * Central thresholds for Business Pulse (mirrored in
 * get_business_pulse SQL — keep in sync).
 *
 * Adjustment threshold: ≥3 ADJUSTMENT movements in the selected
 * range. Simple and defensible for a small shop; avoids noise from
 * a single correction while still surfacing bursts of inventory edits.
 */
export const BUSINESS_PULSE_THRESHOLDS = {
  LOW_STOCK_MAX: LOW_STOCK_THRESHOLD,
  RETURN_SPIKE_RATIO: 1.5,
  /** Minimum current-period return value (₹) before a spike can fire. */
  RETURN_SPIKE_MIN_CURRENT: 500,
  /** Minimum previous-period return value (₹) as a stable baseline. */
  RETURN_SPIKE_MIN_PREVIOUS: 200,
  /** Margin must fall by more than this many percentage points. */
  MARGIN_DROP_POINTS: 5,
  /** Both periods need at least this cost coverage (0–1). */
  MARGIN_MIN_COST_COVERAGE: 0.5,
  /** Minimum known-cost net sales (₹) per period for margin compare. */
  MARGIN_MIN_KNOWN_NET: 500,
  /** Minimum ADJUSTMENT movements in range. */
  ADJUSTMENT_MIN_COUNT: 3,
  MAX_VISIBLE_SIGNALS: 3,
} as const

export type BusinessSignalType =
  | 'OUT_OF_STOCK'
  | 'LOW_STOCK'
  | 'RETURN_SPIKE'
  | 'MARGIN_DROP'
  | 'TOP_PRODUCT'
  | 'INVENTORY_ACTIVITY'

export type BusinessSignal = {
  id: string
  type: BusinessSignalType
  priority: number
  title: string
  description: string
  href?: string
  createdAt?: string
}

export type BusinessPulse = {
  signals: BusinessSignal[]
  allGood: boolean
}
