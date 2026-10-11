import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts"

import { ChartContainer } from "@/components/evilcharts/ui/recharts-chart"
import type { PriceLadder } from "@/lib/api"
import { lakh } from "@/lib/format"

const SIZES = [1, 2, 3, 4, 5, 10]

const config = {
  range: { label: "Market range", colors: { light: ["#bbd4ea"] } },
  median: { label: "Market median", colors: { light: ["#003078"] } },
  benchmark: { label: "Govt benchmark", colors: { light: ["#0b0c0c"] } },
  you_pay: { label: "You pay after subsidy", colors: { light: ["#00703c"] } },
}

const axis = (v: number) => (v >= 100_000 ? `₹${(v / 100_000).toFixed(v % 100_000 ? 1 : 0)}L` : v === 0 ? "₹0" : `₹${Math.round(v / 1000)}k`)

/**
 * All sizes on one rupee axis, so they can be compared: the market range as a floating bar with
 * its median, the government benchmark, and what a household pays after subsidy.
 */
export function PriceRangeChart({ ladders, className }: { ladders: Map<number, PriceLadder>; className?: string }) {
  const data = SIZES.map((k) => {
    const l = ladders.get(k)
    return {
      size: `${k} kW`,
      range: l?.market_low && l.market_high ? [l.market_low.total, l.market_high.total] : null,
      median: l?.market_median?.total ?? null,
      benchmark: l?.benchmark?.total ?? null,
      you_pay: l?.typical_you_pay ?? null,
      n: l?.market_median?.n ?? 0,
    }
  })
  return (
    <ChartContainer config={config} className={className ?? "aspect-auto h-80 w-full flex-none"} footer={<ChartKey />}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="size" tickLine={false} axisLine={false} fontSize={13} />
        <YAxis width={48} tickLine={false} axisLine={false} fontSize={12} tickFormatter={axis} />
        <Tooltip cursor={{ fill: "#f3f2f1" }} content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null
          const row = payload[0].payload as (typeof data)[number]
          return (
            <div className="flex min-w-48 flex-col gap-1 border bg-white p-3 text-sm shadow-lg">
              <b>{label}</b>
              {row.range ? <span>Market {lakh(row.range[0])}–{lakh(row.range[1]).replace("₹", "")} <span className="text-[var(--govuk-secondary-text)]">({row.n} prices)</span></span>
                : <span className="text-[var(--govuk-secondary-text)]">No market prices yet</span>}
              {row.median != null && <span>Median {lakh(row.median)}</span>}
              <span>Govt benchmark {lakh(row.benchmark)}</span>
              <span className="font-bold text-[var(--govuk-green)]">You pay {lakh(row.you_pay)}</span>
            </div>
          )
        }} />
        <Bar dataKey="range" name="Market range" fill="#bbd4ea" stroke="#1d70b8" barSize={34} isAnimationActive={false} />
        <Line dataKey="median" name="Market median" stroke="none" isAnimationActive={false} legendType="rect" activeDot={false}
          dot={(d: { cx?: number; cy?: number; index?: number; value?: unknown }) =>
            d.value == null || d.cx == null || d.cy == null
              ? <g key={d.index} />
              : <rect key={d.index} x={d.cx - 17} y={d.cy - 2} width={34} height={4} fill="#003078" />} />
        <Line dataKey="benchmark" name="Govt benchmark" stroke="#0b0c0c" strokeDasharray="5 4" strokeWidth={2}
          dot={{ r: 4, fill: "#0b0c0c" }} isAnimationActive={false} connectNulls />
        <Line dataKey="you_pay" name="You pay after subsidy" stroke="#00703c" strokeWidth={3}
          dot={{ r: 5, fill: "#00703c" }} isAnimationActive={false} connectNulls />
      </ComposedChart>
    </ChartContainer>
  )
}

function ChartKey() {
  const items = [
    { label: "Market range", swatch: <span className="inline-block h-3 w-4 border border-[#1d70b8] bg-[#bbd4ea]" /> },
    { label: "Market median", swatch: <span className="inline-block h-1 w-4 bg-[#003078]" /> },
    { label: "Govt benchmark", swatch: <span className="inline-block w-4 border-t-2 border-dashed border-[#0b0c0c]" /> },
    { label: "You pay after subsidy", swatch: <span className="inline-block h-1 w-4 bg-[#00703c]" /> },
  ]
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-2 text-[13px] text-foreground">
      {items.map((i) => <span key={i.label} className="flex items-center gap-1.5">{i.swatch}{i.label}</span>)}
    </div>
  )
}
