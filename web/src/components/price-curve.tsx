import { ReferenceLine } from "recharts"

import { EvilLineChart } from "@/components/evilcharts/charts/recharts-line-chart"
import type { PriceLadder } from "@/lib/api"

const SIZES = [1, 2, 3, 4, 5, 10]

const config = {
  market: { label: "Market price", colors: { light: ["#b1b4b6"], dark: ["#b1b4b6"] } },
  benchmark: { label: "Govt benchmark", colors: { light: ["#0b0c0c"], dark: ["#0b0c0c"] } },
  you_pay: { label: "You pay after subsidy", colors: { light: ["#00703c"], dark: ["#00703c"] } },
}

/**
 * Price by system size: what the market charges, the government benchmark, and what a household
 * actually pays after central + Delhi subsidy. The gap between the top and bottom lines is the
 * case for going solar; the dashed line marks the size this roof fits.
 */
export function PriceCurve({ ladders, size }: { ladders: Map<number, PriceLadder>; size: number }) {
  const data = SIZES.map((k) => {
    const l = ladders.get(k)
    return {
      size: `${k} kW`,
      market: l?.market_median?.total ?? null,
      benchmark: l?.benchmark?.total ?? null,
      you_pay: l?.typical_you_pay ?? null,
    }
  })
  return (
    <EvilLineChart config={config} data={data} className="aspect-auto h-48 w-full flex-none" curveType="monotone">
      <EvilLineChart.Grid vertical={false} />
      <EvilLineChart.XAxis dataKey="size" tickLine={false} axisLine={false} fontSize={12} />
      <EvilLineChart.YAxis width={40} tickLine={false} axisLine={false} fontSize={12}
        tickFormatter={(v: number) => (v >= 100_000 ? `₹${(v / 100_000).toFixed(v % 100_000 ? 1 : 0)}L` : `₹${Math.round(v / 1000)}k`)} />
      <EvilLineChart.Tooltip />
      <EvilLineChart.Legend />
      <ReferenceLine x={`${size} kW`} stroke="#1d70b8" strokeDasharray="4 3" strokeWidth={2}
        label={{ value: "your roof", position: "insideTopRight", fill: "#1d70b8", fontSize: 12 }} />
      <EvilLineChart.Line dataKey="market" connectNulls strokeWidth={2} />
      <EvilLineChart.Line dataKey="benchmark" connectNulls strokeVariant="dashed" strokeWidth={2} />
      <EvilLineChart.Line dataKey="you_pay" connectNulls strokeWidth={3} />
    </EvilLineChart>
  )
}
