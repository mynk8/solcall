import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"

import { CardTitle, ChartCard, SourceTag, Stat, toCsv } from "@/components/bits"
import { EvilLineChart } from "@/components/evilcharts/charts/recharts-line-chart"
import { DiscomMiniMap } from "@/components/discom-map"
import { ScopeFilter } from "@/components/scope-filter"
import { PriceRangeChart } from "@/components/price-range-chart"
import { BarList, DotStrip, Spark, Split } from "@/components/proof"
import { DivisionBars, GenerationBars, PerKwChart, WhoPaysChart } from "@/components/reference-charts"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, type Answer } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { lakh, lakhRange, shortDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const SIZES = [1, 2, 3, 4, 5, 10]
// GOV.UK palette: orange, turquoise, purple
export const DISCOM_COLORS = {
  BRPL: { light: ["#f47738"], dark: ["#f47738"] },
  BYPL: { light: ["#28a197"], dark: ["#28a197"] },
  TPDDL: { light: ["#4c2c92"], dark: ["#4c2c92"] },
}

export function ReferencePage() {
  const { ladders, today, updates, divisions, surcharge, scope, navigate } = useApp()
  const [tab, setTab] = useState("ladder")

  const scoped = scope === "Everywhere" ? null : scope
  const discomRow = today?.applications.by_discom.find((d) => d.discom === scoped)
  const appsTotal = scoped ? discomRow?.total : today?.applications.total

  const surchargeData = (surcharge ?? []).map((r) => ({ from: r.from.slice(0, 7), pct: r.pct }))
  const asOf = ladders.get(3)?.market_median?.as_of?.split(", ").pop()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[2rem] leading-tight font-bold">Reference Price</h1>
          <p className="text-[var(--govuk-secondary-text)]">
            Delhi rooftop solar · as of {shortDate(asOf) || "…"} ·{" "}
            <button className="govuk-link" onClick={() => navigate("data")}>sources</button>
          </p>
        </div>
        <ScopeFilter />
      </div>

      {/* price table + mini map */}
      <div className="grid items-stretch gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3 rounded-[2px] border bg-white p-5">
          <CardTitle source="Market price from installer pages; you pay = typical price − central and Delhi subsidy">Price per system size</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-foreground text-left">
                <tr><th className="py-2 pr-3 font-bold">Size</th><th className="pr-3 font-bold">Market price</th><th className="pr-3 font-bold">You pay after subsidy</th><th className="pr-3 font-bold">Govt benchmark</th><th /></tr>
              </thead>
              <tbody>
                {SIZES.map((k) => {
                  const l = ladders.get(k)
                  return (
                    <tr key={k} className="border-b">
                      <td className="py-3 pr-3 font-bold whitespace-nowrap">{k} kW</td>
                      <td className="pr-3 whitespace-nowrap tabular-nums">
                        {l?.market_low ? lakhRange(l.market_low.total, l.market_high?.total) : <span className="text-muted-foreground">no prices yet</span>}
                      </td>
                      <td className="pr-3 font-bold whitespace-nowrap text-[var(--govuk-green)] tabular-nums">{l ? lakh(l.typical_you_pay) : "…"}</td>
                      <td className="pr-3 whitespace-nowrap text-[var(--govuk-secondary-text)] tabular-nums">{l ? lakh(l.benchmark?.total) : "…"}</td>
                      <td className="py-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate("deal", { size: k })} aria-label={`Check a ${k} kW quote`}>
                          Check a quote <ChevronRight />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <DiscomMiniMap />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat k={scoped ? `Applications in ${scoped}` : "Applications in Delhi"}
          v={appsTotal?.toLocaleString("en-IN") ?? "…"} tag={
            <div className="flex flex-col gap-1.5">
              <DiscomBars />
              <SourceTag tier="govt">Delhi Solar Portal · {shortDate(today?.applications.as_on)}</SourceTag>
            </div>} />
        <Stat k="Scheme loan rate" v={today?.rates ? `${today.rates.scheme_loan_pct.toFixed(2)}%` : "…"}
          tag={today?.rates && (
            <Split format={(v) => `${v.toFixed(2)}%`} className="pt-1" parts={[
              { label: "RBI repo", value: today.rates.repo_pct, color: "#505a5f" },
              { label: "spread", value: today.rates.scheme_loan_pct - today.rates.repo_pct, color: "#1d70b8" },
            ]} />)} />
        {scoped && scoped !== "BRPL" ? (
          <Stat k={`Latest surcharge (${scoped})`} v="—" tag={<SourceTag tier="govt">BRPL only for now</SourceTag>} />
        ) : (
          <Stat k="Latest surcharge (BRPL)" v={today?.surcharge_brpl ? `${today.surcharge_brpl.pct.toFixed(2)}%` : "…"}
            tag={
              <div className="flex flex-col gap-1">
                <Spark step values={(surcharge ?? []).map((r) => r.pct)} format={(v) => `${v}%`}
                  from={surcharge?.[0]?.from.slice(0, 4)} to={`${surcharge?.length ?? 0} orders · now`} />
              </div>} />
        )}
        <Stat k="Solar output" v={today?.solar_yield ? `${today.solar_yield.kwh_per_kwp.toLocaleString("en-IN")} kWh/kWp` : "…"}
          tag={today?.solar_yield && <DotStrip className="pt-1" points={today.solar_yield.points.map((p) => ({ name: p.name, value: p.kwh_per_kwp }))} />} />
      </div>

      <HomeCase />

      {/* latest changes */}
      <div className="flex flex-col gap-3 rounded-[2px] border bg-white p-5">
        <CardTitle action={<button className="govuk-link" onClick={() => navigate("changelog")}>See all changes</button>}>Latest changes</CardTitle>
        <div className="grid gap-3 md:grid-cols-3">
          {(updates ?? []).slice(0, 3).map((u) => (
            <button key={u.title} onClick={() => navigate("changelog")} className="flex flex-col gap-1 bg-[var(--govuk-light-grey)] p-4 text-left hover:bg-muted">
              <span className="text-sm text-muted-foreground">{shortDate(u.date)} · {u.category}</span>
              <b className="leading-snug">{u.title}</b>
            </button>
          ))}
          {!updates && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>

      {/* topic tabs: a grid of chart cards per topic */}
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2 border-b border-[var(--govuk-mid-grey)]">
          <TabsList className="w-auto flex-1 border-b-0">
            <TabsTrigger value="ladder">Prices</TabsTrigger>
            <TabsTrigger value="adopt">Adoption</TabsTrigger>
            <TabsTrigger value="bills">Bills &amp; rates</TabsTrigger>
          </TabsList>
          <button className="ml-auto pb-2 govuk-link" onClick={() => navigate("guide")}>How we price</button>
        </div>
        <TabsContent value="ladder" className="grid gap-3 lg:grid-cols-3">
          <ChartCard boxed title="Price by system size" source="Installer pages and govt benchmark, before subsidy"
            csv={() => toCsv(SIZES.map((k) => { const l = ladders.get(k); return { size_kw: k, market_low: l?.market_low?.total, market_median: l?.market_median?.total, market_high: l?.market_high?.total, benchmark: l?.benchmark?.total, you_pay_after_subsidy: l?.typical_you_pay, prices_seen: l?.market_median?.n ?? 0 } }))}>
            {ladders.size ? <PriceRangeChart ladders={ladders} className="aspect-auto h-64 w-full flex-none" /> : <Skeleton className="h-64" />}
          </ChartCard>
          <ChartCard boxed title="Price per kW" source="Bigger systems cost less per kW"
            csv={() => toCsv(SIZES.map((k) => { const l = ladders.get(k); return { size_kw: k, market_median_per_kw: l?.market_median?.per_kw, benchmark_per_kw: l?.benchmark?.per_kw } }))}>
            {ladders.size ? <PerKwChart ladders={ladders} /> : <Skeleton className="h-64" />}
          </ChartCard>
          <ChartCard boxed title="Who pays the price" source="Typical price split into subsidies and your share"
            csv={() => toCsv(SIZES.map((k) => { const l = ladders.get(k); return { size_kw: k, typical_price: l?.typical_price, central_subsidy: l?.central_subsidy, total_subsidy: l?.typical_subsidy, you_pay: l?.typical_you_pay } }))}>
            {ladders.size ? <WhoPaysChart ladders={ladders} /> : <Skeleton className="h-64" />}
          </ChartCard>
        </TabsContent>
        <TabsContent value="adopt" className="grid gap-3 lg:grid-cols-3">
          {(["BRPL", "BYPL", "TPDDL"] as const).filter((d) => !scoped || d === scoped).map((d) => (
            <ChartCard boxed key={d} title={`Homes applied · ${d}`} source="Top divisions, Delhi Solar Portal" className={scoped ? "lg:col-span-3" : undefined}
              csv={() => toCsv((divisions ?? []).filter((x) => x.discom === d).map((x) => ({ ...x })))}>
              {divisions ? <DivisionBars discom={d} limit={scoped ? 14 : 8} color={DISCOM_COLORS[d].light[0]} /> : <Skeleton className="h-56" />}
            </ChartCard>
          ))}
        </TabsContent>
        <TabsContent value="bills" className="grid gap-3 lg:grid-cols-3">
          <ChartCard boxed title="BRPL surcharge on your bill" source="% added to the bill · PPAC/FPPAS orders, context only" csv={() => toCsv((surcharge ?? []).map((r) => ({ ...r })))}>
            <EvilLineChart config={{ pct: { label: "Surcharge %", colors: { light: ["#1d70b8"], dark: ["#1d70b8"] } } }}
              data={surchargeData} curveType="stepAfter" className="aspect-auto h-56 w-full flex-none">
              <EvilLineChart.Grid vertical={false} />
              <EvilLineChart.XAxis dataKey="from" tickLine={false} axisLine={false} fontSize={11} />
              <EvilLineChart.YAxis width={36} tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v: number) => `${v}%`} />
              <EvilLineChart.Tooltip />
              <EvilLineChart.Line dataKey="pct" strokeWidth={2.5} />
            </EvilLineChart>
          </ChartCard>
          <ChartCard boxed title="Borrow or use savings?" source={`What the loan costs against what a deposit earns · RBI, ${shortDate(today?.rates?.as_of)}`}>
            {today?.rates ? (
              <div className="flex flex-1 flex-col justify-center gap-4">
                <BarList size="lg" labelWidth="7.5rem" max={8} rows={[
                  { label: "RBI repo", value: today.rates.repo_pct, display: `${today.rates.repo_pct.toFixed(2)}%`, color: "#b1b4b6" },
                  { label: "Solar loan costs", value: today.rates.scheme_loan_pct, display: `${today.rates.scheme_loan_pct.toFixed(2)}%`, color: "#1d70b8" },
                  { label: "Deposit earns", value: today.rates.deposit_high_pct, from: today.rates.deposit_low_pct, display: `${today.rates.deposit_low_pct.toFixed(1)}–${today.rates.deposit_high_pct.toFixed(2)}%`, color: "#00703c" },
                ]} />
                <span className={`govuk-tag self-start ${today.rates.deposit_low_pct >= today.rates.scheme_loan_pct ? "govuk-tag--green" : "govuk-tag--yellow"}`}>
                  {today.rates.deposit_low_pct >= today.rates.scheme_loan_pct ? "Loan costs no more than savings earn" : "Loan costs more than savings earn"}
                </span>
              </div>
            ) : <Skeleton className="h-40" />}
          </ChartCard>
          <ChartCard boxed title="Units a month, by system size" source={`Dashed lines: the 200 and 400 unit subsidy brackets · sun varies only ${today?.solar_yield?.spread_pct ?? "…"}% across Delhi`}>
            <GenerationBars />
          </ChartCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const CASE_SIZES = [1, 2, 3, 4, 5]

/** The way in from the market page: pick a roof size, see what it does each year, and check it against your bill. */
function HomeCase() {
  const { navigate } = useApp()
  const [size, setSize] = useState(3)
  const [envs, setEnvs] = useState<Answer["environment"][] | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all(CASE_SIZES.map((k) => api.answer({ units: 450, load: 5, size: k }))).then((rs) => alive && setEnvs(rs.map((a) => a.environment))).catch(() => {})
    return () => { alive = false }
  }, [])
  const env = envs?.[CASE_SIZES.indexOf(size)]
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[2px] border bg-white p-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">What would a roof like yours do?</h2>
        <ToggleGroup type="single" size="sm" variant="outline" value={String(size)} onValueChange={(v) => v && setSize(+v)} aria-label="Roof size">
          {CASE_SIZES.map((k) => <ToggleGroupItem key={k} value={String(k)}>{k} kW</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      {env ? (
        <div className="flex flex-1 flex-wrap gap-x-8 gap-y-2">
          {[
            { k: "Clean power a year", v: `${env.units_year.toLocaleString("en-IN")} units` },
            { k: "CO₂ avoided a year", v: `${env.co2_tonnes_year.toFixed(1)} tonnes`, good: true },
            { k: `Over ${env.life_years} years`, v: `${env.co2_tonnes_lifetime} tonnes`, good: true },
          ].map((f) => (
            <div key={f.k} className="flex flex-col">
              <span className="text-sm text-[var(--govuk-secondary-text)]">{f.k}</span>
              <b className={cn("text-xl whitespace-nowrap tabular-nums", f.good && "text-[var(--govuk-green)]")}>{f.v}</b>
            </div>
          ))}
        </div>
      ) : <Skeleton className="h-12 flex-1" />}
      <Button onClick={() => navigate("check", { size, load: Math.max(3, size) })}>Check {size} kW with my bill <ChevronRight /></Button>
    </div>
  )
}

/** Applications per DISCOM as three short bars; the selected DISCOM is highlighted. */
function DiscomBars() {
  const { today, scope } = useApp()
  const rows = today?.applications.by_discom ?? []
  const max = Math.max(1, ...rows.map((r) => r.total))
  return (
    <div className="flex flex-col gap-0.5">
      {rows.map((r) => (
        <div key={r.discom} className="grid grid-cols-[3rem_1fr] items-center gap-1.5 text-xs">
          <span className="text-[var(--govuk-secondary-text)]">{r.discom}</span>
          <div className="h-2" style={{ width: `${(r.total / max) * 100}%`, background: scope === "Everywhere" || scope === r.discom ? "#1d70b8" : "#b1b4b6" }} />
        </div>
      ))}
    </div>
  )
}
