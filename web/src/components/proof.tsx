// Small visuals that show a claim instead of stating it.
import { ReferenceLine } from "recharts"

import { EvilLineChart } from "@/components/evilcharts/charts/recharts-line-chart"
import { lakh, rupees } from "@/lib/format"
import { cn } from "@/lib/utils"

const money = (v: number) => {
  const a = Math.abs(v), sign = v < 0 ? "−" : ""
  return a >= 100_000 ? `${sign}₹${(a / 100_000).toFixed(a % 100_000 ? 1 : 0)}L` : `${sign}₹${Math.round(a / 1000)}k`
}

export type CurveSeries = { key: string; label: string; color: string; points: { year: number; value: number }[] }

/**
 * Money in hand over the system's life. Starts below zero (what you pay), climbs with each
 * year's saving; where a line crosses the break-even rule is when it has paid for itself.
 */
export function PaybackCurve({ series, years = 25, className, breakEvenYear }: {
  series: CurveSeries[]; years?: number; className?: string; breakEvenYear?: number | null
}) {
  const data = Array.from({ length: years + 1 }, (_, y) => {
    const row: Record<string, number | string> = { year: y }
    for (const s of series) {
      const p = s.points.find((q) => q.year === y)
      if (p) row[s.key] = p.value
    }
    return row
  })
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, colors: { light: [s.color], dark: [s.color] } }]))
  return (
    <EvilLineChart config={config} data={data} className={cn("aspect-auto h-48 w-full flex-none", className)} curveType="monotone">
      <EvilLineChart.Grid vertical={false} />
      <EvilLineChart.XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={12}
        ticks={years <= 10 ? Array.from({ length: years + 1 }, (_, i) => i) : [0, 5, 10, 15, 20, 25].filter((t) => t <= years)}
        tickFormatter={(y: number) => (y === 0 ? "today" : `yr ${y}`)} />
      <EvilLineChart.YAxis width={46} tickLine={false} axisLine={false} fontSize={12} tickFormatter={money} />
      <EvilLineChart.Tooltip />
      {series.length > 1 && <EvilLineChart.Legend />}
      <ReferenceLine y={0} stroke="#0b0c0c" strokeWidth={1.5}
        label={{ value: "break-even", position: "insideBottomRight", fill: "#505a5f", fontSize: 12 }} />
      {breakEvenYear != null && breakEvenYear > 0 && (
        <ReferenceLine x={Math.ceil(breakEvenYear)} stroke="#00703c" strokeDasharray="4 3"
          label={{ value: `paid back`, position: "insideTopLeft", fill: "#00703c", fontSize: 12 }} />
      )}
      {series.map((s) => <EvilLineChart.Line key={s.key} dataKey={s.key} strokeWidth={3} />)}
    </EvilLineChart>
  )
}

/** Price split into who pays it: central subsidy, Delhi subsidy, and you. */
export function CostSplit({ price, central, delhi, youPay, className }: {
  price: number; central: number; delhi: number; youPay: number; className?: string
}) {
  const parts = [
    { label: "Central subsidy", value: central, color: "#1d70b8", text: "text-white" },
    { label: "Delhi subsidy", value: delhi, color: "#28a197", text: "text-white" },
    { label: "You pay", value: youPay, color: "#00703c", text: "text-white" },
  ].filter((p) => p.value > 0)
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex h-8 w-full overflow-hidden" role="img"
        aria-label={`${lakh(price)} price: ${parts.map((p) => `${p.label} ${rupees(p.value)}`).join(", ")}`}>
        {parts.map((p) => (
          <div key={p.label} className={cn("flex items-center justify-center overflow-hidden px-1 text-xs font-bold whitespace-nowrap", p.text)}
            style={{ width: `${(p.value / price) * 100}%`, background: p.color }}>
            {p.value / price > 0.18 ? money(p.value) : ""}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <i className="inline-block size-3" style={{ background: p.color }} />{p.label} <b className="tabular-nums">{rupees(p.value)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Monthly saving next to the loan EMI: the gap is how comfortably the saving pays the loan. */
export function CoverBars({ saving, emi, className }: { saving: number; emi: number; className?: string }) {
  const max = Math.max(saving, emi)
  const rows = [
    { label: "Saving", value: saving, color: "#00703c" },
    { label: "EMI", value: emi, color: "#b1b4b6" },
  ]
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm">
          <span className="text-[var(--govuk-secondary-text)]">{r.label}</span>
          <div className="flex items-center gap-2">
            <div className="h-4" style={{ width: `${(r.value / max) * 100}%`, background: r.color, minWidth: 4 }} />
            <b className="tabular-nums">{rupees(r.value)}</b>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Small filled trend line. With `format`, the peak and the latest value are labelled; `from`/`to` label the ends. */
export function Spark({ values, className, step, format, from, to }: {
  values: number[]; className?: string; step?: boolean; format?: (v: number) => string; from?: string; to?: string
}) {
  if (values.length < 2) return null
  const w = 240, h = 44, max = Math.max(...values)
  const x = (i: number) => (i / (values.length - 1)) * w
  const y = (v: number) => h - 1 - (v / Math.max(1e-9, max)) * (h - 4) // zero-based so the height means something
  const d = values.map((v, i) => (i === 0 ? `M${x(i)},${y(v)}` : step ? `H${x(i)}V${y(v)}` : `L${x(i)},${y(v)}`)).join("")
  const peak = values.indexOf(max), last = values.length - 1
  return (
    <div className={cn("flex w-full flex-col gap-0.5", className)}>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-11 w-full" aria-hidden>
          <path d={`${d}V${h}H0Z`} fill="#1d70b8" opacity={0.15} />
          <path d={d} fill="none" stroke="#1d70b8" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {format && peak !== last && (
          <span className={cn("absolute top-0 text-xs text-[var(--govuk-secondary-text)] tabular-nums", peak < last / 2 ? "right-0" : "left-0")}>peak {format(max)}</span>
        )}
      </div>
      {(from || to) && <div className="flex justify-between text-xs text-[var(--govuk-secondary-text)]"><span>{from}</span><span>{to}</span></div>}
    </div>
  )
}

export type BarRow = { label: string; value: number; display?: string; color?: string; from?: number; note?: string }

/**
 * Labelled horizontal bars on one shared scale, always starting at zero. `from` marks a range:
 * solid up to `from`, lighter from there to `value`. `marks` draws reference lines across every
 * row; `onPick` makes rows clickable.
 */
export function BarList({ rows, max, labelWidth = "5.5rem", className, onPick, active, size = "sm", marks }: {
  rows: BarRow[]; max?: number; labelWidth?: string; className?: string; onPick?: (label: string) => void; active?: string
  size?: "sm" | "lg"; marks?: { at: number; label: string }[]
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value), ...(marks ?? []).map((m) => m.at)) * (marks ? 1.08 : 1)
  const pct = (v: number) => `${(v / top) * 100}%`
  const cols = { gridTemplateColumns: `${labelWidth} 1fr ${size === "lg" ? "6rem" : "5rem"}` }
  return (
    <div className={cn("flex flex-col", size === "lg" ? "gap-3" : "gap-1.5", className)}>
      {marks && (
        <div className="grid gap-2 text-xs text-[var(--govuk-secondary-text)]" style={cols}>
          <span />
          <div className="relative h-4">
            {marks.map((m) => <span key={m.label} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(m.at) }}>{m.label}</span>)}
          </div>
        </div>
      )}
      {rows.map((r) => {
        const Row = onPick ? "button" : "div"
        const color = r.color ?? "#1d70b8"
        return (
          <Row key={r.label} onClick={onPick ? () => onPick(r.label) : undefined} title={r.note}
            className={cn("grid items-center gap-2 text-left", size === "lg" ? "text-base" : "text-sm",
              onPick && "hover:bg-[var(--govuk-light-grey)]", active === r.label && "bg-[var(--govuk-light-grey)] font-semibold")}
            style={cols}>
            <span className="truncate text-[var(--govuk-secondary-text)]">{r.label}</span>
            <div className={cn("relative flex min-w-0 bg-[var(--govuk-light-grey)]/70", size === "lg" ? "h-7" : "h-4")}>
              {r.from != null ? (
                <>
                  <div style={{ width: pct(r.from), background: color }} />
                  <div className="rounded-r-[3px]" style={{ width: pct(r.value - r.from), minWidth: 3, background: color, opacity: 0.45 }} />
                </>
              ) : <div className="rounded-r-[3px]" style={{ width: pct(r.value), minWidth: 3, background: color }} />}
              {marks?.map((m) => <i key={m.label} className="absolute inset-y-[-3px] w-px border-l border-dashed border-[#0b0c0c]" style={{ left: pct(m.at) }} />)}
            </div>
            <b className="text-right whitespace-nowrap tabular-nums">{r.display ?? r.value.toLocaleString("en-IN")}</b>
          </Row>
        )
      })}
    </div>
  )
}

/** One bar cut into labelled parts that add up to a total, e.g. repo rate + spread = loan rate. */
export function Split({ parts, format = rupees, className, tall }: {
  parts: { label: string; value: number; color: string }[]; format?: (v: number) => string; className?: string; tall?: boolean
}) {
  const shown = parts.filter((p) => p.value > 0)
  const total = shown.reduce((t, p) => t + p.value, 0) || 1
  return (
    <div className={cn("flex flex-col gap-1.5", className)} role="img" aria-label={shown.map((p) => `${p.label} ${format(p.value)}`).join(" plus ")}>
      <div className={cn("flex w-full gap-0.5", tall ? "h-9" : "h-5")}>
        {shown.map((p) => (
          <div key={p.label} className="flex min-w-1 items-center justify-center overflow-hidden text-xs font-bold whitespace-nowrap text-white"
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }}>
            {tall && p.value / total > 0.16 ? format(p.value) : ""}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
        {shown.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <i className="inline-block size-2.5" style={{ background: p.color }} />{p.label} <b className="tabular-nums">{format(p.value)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Values as dots on one short axis: shows how tightly a handful of readings cluster. */
export function DotStrip({ points, format = (v) => String(Math.round(v)), className }: {
  points: { name: string; value: number }[]; format?: (v: number) => string; className?: string
}) {
  if (!points.length) return null
  const lo = Math.min(...points.map((p) => p.value)), hi = Math.max(...points.map((p) => p.value))
  const pad = Math.max(1e-9, hi - lo) * 0.15
  const at = (v: number) => `${((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100}%`
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative h-4">
        <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--govuk-mid-grey)]" />
        {points.map((p) => (
          <i key={p.name} title={`${p.name}: ${format(p.value)}`} className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#f47738]" style={{ left: at(p.value) }} />
        ))}
      </div>
      <div className="flex justify-between text-xs text-[var(--govuk-secondary-text)] tabular-nums">
        <span>{format(lo)} {points.find((p) => p.value === lo)?.name}</span><span>{points.find((p) => p.value === hi)?.name} {format(hi)}</span>
      </div>
    </div>
  )
}

/** Legend row under a chart: a swatch per series. */
export function ChartKey({ items }: { items: { label: string; color: string; kind?: "box" | "line" | "dash" }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-[13px] text-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.kind === "dash" ? <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
            : i.kind === "line" ? <span className="inline-block h-1 w-4" style={{ background: i.color }} />
            : <span className="inline-block size-3" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** A short chain of figures read left to right, e.g. pay today → paid back → after 25 years. */
export function Milestones({ steps, className }: { steps: { label: string; value: string; tone?: "good" | "bad" }[]; className?: string }) {
  return (
    <div className={cn("flex items-stretch gap-1", className)}>
      {steps.map((s, i) => (
        <div key={s.label} className="flex min-w-0 flex-1 items-center gap-1">
          {i > 0 && <span aria-hidden className="text-[var(--govuk-secondary-text)]">→</span>}
          <div className="flex min-w-0 flex-1 flex-col bg-[var(--govuk-light-grey)] px-2.5 py-1.5">
            <span className="text-xs text-[var(--govuk-secondary-text)]">{s.label}</span>
            <b className={cn("text-[15px] leading-tight whitespace-nowrap tabular-nums", s.tone === "good" && "text-[var(--govuk-green)]", s.tone === "bad" && "text-[var(--govuk-red)]")}>{s.value.replace(" lakh", "L")}</b>
          </div>
        </div>
      ))}
    </div>
  )
}
