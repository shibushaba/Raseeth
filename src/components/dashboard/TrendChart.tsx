import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/lib/money'

export type TrendPoint = {
  label: string
  sales: number
  profit: number | null
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const sales = payload.find((p) => p.dataKey === 'sales')?.value ?? 0
  const profit = payload.find((p) => p.dataKey === 'profit')?.value
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-muted">
        Sales: <span className="text-foreground">{formatMoney(sales)}</span>
      </p>
      {profit != null ? (
        <p className="text-muted">
          Profit: <span className="text-foreground">{formatMoney(profit)}</span>
        </p>
      ) : null}
    </div>
  )
}

export function TrendChart({
  title,
  subtitle,
  data,
  loading,
  showProfit = false,
}: {
  title: string
  subtitle?: string
  data: TrendPoint[]
  loading?: boolean
  showProfit?: boolean
}) {
  const hasData = data.some((d) => d.sales > 0 || (d.profit ?? 0) > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="section-label">{title}</h2>
        {subtitle ? (
          <p className="section-hint mt-0.5 hidden sm:block">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardBody className="pt-0">
        {loading ? (
          <Skeleton className="h-[180px] w-full sm:h-[220px]" />
        ) : !hasData ? (
          <p className="flex h-[180px] items-center justify-center text-sm text-muted sm:h-[220px]">
            No sales in this period yet.
          </p>
        ) : (
          <div
            className="h-[180px] w-full sm:h-[220px]"
            role="img"
            aria-label={`${title} trend chart`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v) =>
                    v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`
                  }
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="Sales"
                  stroke="var(--color-accent)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                {showProfit ? (
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="var(--color-foreground)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls={false}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
