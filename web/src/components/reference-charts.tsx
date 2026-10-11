// Home-page chart cards: each one answers a question a household has before buying.
import { useEffect, useState } from "react"
import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts"

import { ChartContainer } from "@/components/evilcharts/ui/recharts-chart"
import { BarList, ChartKey } from "@/components/proof"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type PriceLadder } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { lakh, rupees } from "@/lib/format"
import { divisionName } from "@/lib/roofs"

const SIZES = [1, 2, 3, 4, 5, 10]
const H = "aspect-auto h-64 w-full flex-none"
const short = (v: number) => (v >= 100_000 ? `₹${(v / 100_000).toFixed(v % 100_000 ? 1 : 0)}L` : v === 0 ? "₹0" : `₹${Math.round(v / 1000)}k`)

function Tip({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="flex min-w-44 flex-col gap-1 rounded-md border bg-white p-2.5 text-sm shadow-lg">
      <b>{title}</b>
      {rows.map((r) => (
        <span key={r.label} className="flex items-center gap-1.5">
          {r.color && <i className="size-2.5" style={{ background: r.color }} />}
          <span className="text-[var(--govuk-secondary-text)]">{r.label}</span><b className="ml-auto tabular-nums">{r.value}</b>
        </span>
      ))}
    </div>
  )
}

/** Is a bigger system better value? Price per kW at each size, market against the govt benchmark. */
export function PerKwChart({ ladders }: { ladders: Map<number, PriceLadder> }) {
  const data = SIZES.map((k) => {
    const l = ladders.get(k)
    return { size: `${k} kW`, market: l?.market_median?.per_kw ?? null, benchmark: l?.benchmark?.per_kw ?? null }
  })
  return (
    <ChartContainer config={{}} className={H} footer={<ChartKey items={[{ label: "Market", color: "#1d70b8" }, { label: "Govt benchmark", color: "#0b0c0c", kind: "dash" }]} />}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="size" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis width={44} tickLine={false} axisLine={false} fontSize={12} tickFormatter={short} />
        <Tooltip cursor={{ fill: "#f3f2f1" }} content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null
          const r = payload[0].payload as (typeof data)[number]
          return <Tip title={String(label)} rows={[
            { label: "Market", value: r.market != null ? `${rupees(r.market)}/kW` : "no prices yet", color: "#1d70b8" },
            { label: "Govt benchmark", value: r.benchmark != null ? `${rupees(r.benchmark)}/kW` : "—", color: "#0b0c0c" },
          ]} />
        }} />
        <Bar dataKey="market" fill="#1d70b8" radius={[4, 4, 0, 0]} barSize={26} isAnimationActive={false} />
        <Line dataKey="benchmark" stroke="#0b0c0c" strokeDasharray="5 4" strokeWidth={2} dot={{ r: 3, fill: "#0b0c0c" }} isAnimationActive={false} connectNulls />
      </ComposedChart>
    </ChartContainer>
  )
}

const PAYERS = [
  { key: "you", label: "You pay", color: "#00703c" },
  { key: "delhi", label: "Delhi subsidy", color: "#28a197" },
  { key: "central", label: "Central subsidy", color: "#1d70b8" },
] as const

/** How much of the price the subsidies carry at each size. */
export function WhoPaysChart({ ladders }: { ladders: Map<number, PriceLadder> }) {
  const data = SIZES.map((k) => {
    const l = ladders.get(k)
    const central = l?.central_subsidy ?? 0
    return { size: `${k} kW`, you: l?.typical_you_pay ?? 0, central, delhi: Math.max(0, (l?.typical_subsidy ?? 0) - central), price: l?.typical_price ?? 0 }
  })
  return (
    <ChartContainer config={{}} className={H} footer={<ChartKey items={PAYERS.map((p) => ({ label: p.label, color: p.color }))} />}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="size" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis width={44} tickLine={false} axisLine={false} fontSize={12} tickFormatter={short} />
        <Tooltip cursor={{ fill: "#f3f2f1" }} content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null
          const r = payload[0].payload as (typeof data)[number]
          return <Tip title={`${label} · ${lakh(r.price)}`} rows={[...PAYERS].reverse().map((p) => ({ label: p.label, value: rupees(r[p.key]), color: p.color }))} />
        }} />
        {PAYERS.map((p, i) => (
          <Bar key={p.key} dataKey={p.key} stackId="a" fill={p.color} stroke="#fff" strokeWidth={1} barSize={30} isAnimationActive={false}
            radius={i === PAYERS.length - 1 ? [4, 4, 0, 0] : 0} />
        ))}
      </ComposedChart>
    </ChartContainer>
  )
}

/** Divisions with the most applications in one DISCOM. */
export function DivisionBars({ discom, limit = 7, color }: { discom: string; limit?: number; color: string }) {
  const { divisions } = useApp()
  const rows = (divisions ?? []).filter((d) => d.discom === discom).sort((a, b) => a.rank - b.rank).slice(0, limit)
  return <BarList labelWidth="7.5rem" rows={rows.map((d) => ({ label: divisionName(d.division), value: d.applications, color, note: `${(d.share * 100).toFixed(1)}% of ${discom}` }))} />
}

/** What each system size generates in a month, against the 200 and 400 unit subsidy brackets. */
export function GenerationBars() {
  const sizes = [1, 2, 3, 4, 5]
  const [units, setUnits] = useState<number[] | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all(sizes.map((k) => api.answer({ units: 450, load: 5, size: k }))).then((rs) => alive && setUnits(rs.map((a) => a.solar_units_month))).catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!units) return <Skeleton className="h-48" />
  return (
    <div className="flex flex-1 flex-col justify-center">
      <BarList size="lg" labelWidth="3rem" marks={[{ at: 200, label: "200" }, { at: 400, label: "400" }]}
        rows={sizes.map((k, i) => ({ label: `${k} kW`, value: units[i], display: `${Math.round(units[i])} units`, color: "#f47738" }))} />
    </div>
  )
}
