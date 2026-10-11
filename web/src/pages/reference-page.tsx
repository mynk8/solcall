import { useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { CardTitle, ChartCard, Missing, SourceTag, Stat, toCsv } from "@/components/bits"
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart"
import { EvilLineChart } from "@/components/evilcharts/charts/recharts-line-chart"
import { DiscomMiniMap } from "@/components/discom-map"
import { ScopeFilter } from "@/components/scope-filter"
import { PriceLadder } from "@/components/price-ladder"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApp } from "@/lib/app-context"
import { lakh, lakhRange, shortDate } from "@/lib/format"

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

  const topDivisions = useMemo(() => (divisions ?? [])
    .filter((d) => !scoped || d.discom === scoped)
    .sort((a, b) => b.applications - a.applications)
    .slice(0, 10)
    .map((d) => ({ division: d.division, BRPL: d.discom === "BRPL" ? d.applications : 0, BYPL: d.discom === "BYPL" ? d.applications : 0, TPDDL: d.discom === "TPDDL" ? d.applications : 0 })),
  [divisions, scoped])

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

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat k={scoped ? `Applications in ${scoped}` : "Applications in Delhi"}
          v={appsTotal?.toLocaleString("en-IN") ?? "…"} tag={<SourceTag tier="govt">Delhi Solar Portal · {shortDate(today?.applications.as_on)}</SourceTag>} />
        <Stat k="Scheme loan rate" v={today?.rates ? `${today.rates.scheme_loan_pct.toFixed(2)}%` : "…"}
          tag={<SourceTag tier="govt">RBI repo {today?.rates?.repo_pct.toFixed(2)}% + 0.50</SourceTag>} />
        {scoped && scoped !== "BRPL" ? (
          <Missing what={`${scoped} surcharge`} className="min-h-24">Only BRPL's surcharge page is scraped so far.</Missing>
        ) : (
          <Stat k="Latest surcharge (BRPL)" v={today?.surcharge_brpl ? `${today.surcharge_brpl.pct.toFixed(2)}%` : "…"}
            tag={<SourceTag tier="govt">from {shortDate(today?.surcharge_brpl?.from)}</SourceTag>} />
        )}
        <Stat k="Solar output" v={today?.solar_yield ? `${today.solar_yield.kwh_per_kwp.toLocaleString("en-IN")} kWh/kWp` : "…"}
          tag={<SourceTag tier="data">Global Solar Atlas · lowest of 5 points</SourceTag>} />
      </div>

      {/* price table + mini map */}
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3 rounded-[2px] border bg-white p-5">
          <CardTitle source="Before subsidy · govt benchmark and installer pages">Price per system size</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-foreground text-left">
                <tr><th className="py-2 pr-3 font-bold">Size</th><th className="pr-3 font-bold">Govt benchmark</th><th className="pr-3 font-bold">Market price</th><th className="pr-3 font-bold" title="Number of installer prices">Prices seen</th><th /></tr>
              </thead>
              <tbody>
                {SIZES.map((k) => {
                  const l = ladders.get(k)
                  return (
                    <tr key={k} className="border-b">
                      <td className="py-3 pr-3 font-bold whitespace-nowrap">{k} kW</td>
                      <td className="pr-3 whitespace-nowrap tabular-nums">{l ? lakh(l.benchmark?.total) : "…"}</td>
                      <td className="pr-3 whitespace-nowrap tabular-nums">
                        {l?.market_low ? lakhRange(l.market_low.total, l.market_high?.total) : <span className="text-muted-foreground">no prices yet</span>}
                      </td>
                      <td className="pr-3 tabular-nums">{l?.market_median?.n ?? 0}</td>
                      <td className="py-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate("deal", { quoteSize: k, dealTab: "paid" })} aria-label={`Check a ${k} kW quote`}>
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
        <div className="flex min-w-0 flex-col gap-3 rounded-[2px] border bg-white p-5">
          <CardTitle source={<>Source: Delhi Solar Portal</>}>Applications by DISCOM</CardTitle>
          <DiscomMiniMap className="h-48" />
          <Button className="self-start" onClick={() => navigate("map")}>Find my roof</Button>
        </div>
      </div>

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

      {/* topic tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-3 rounded-[2px] border bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="ladder">Price ladder</TabsTrigger>
            <TabsTrigger value="adopt">Adoption</TabsTrigger>
            <TabsTrigger value="surch">Surcharge</TabsTrigger>
            <TabsTrigger value="rates">Loan rates</TabsTrigger>
          </TabsList>
          <button className="ml-auto govuk-link" onClick={() => navigate("guide")}>How we price</button>
        </div>
        <TabsContent value="ladder">
          <ChartCard title="Price ladder: one strip per size" source="reference_price.json"
            csv={() => toCsv(SIZES.map((k) => { const l = ladders.get(k); return { size_kw: k, benchmark: l?.benchmark?.total, market_low: l?.market_low?.total, market_median: l?.market_median?.total, market_high: l?.market_high?.total, history: l?.history?.total, n: l?.market_median?.n ?? 0 } }))}>
            <div className="flex flex-col gap-1">
              {SIZES.map((k) => {
                const l = ladders.get(k)
                return (
                  <div key={k} className="grid grid-cols-[3.5rem_1fr] items-start gap-3">
                    <span className="pt-1.5 text-sm font-semibold">{k} kW</span>
                    {l ? <PriceLadder ladder={l} /> : <Skeleton className="h-10" />}
                  </div>
                )
              })}
              <p className="text-sm text-muted-foreground">Black line: government benchmark. Blue band: lowest to highest market price, with the median in dark blue. Sizes are never pooled.</p>
            </div>
          </ChartCard>
        </TabsContent>
        <TabsContent value="adopt">
          <ChartCard title={`Applications by division${scoped ? ` · ${scoped}` : ""} (top 10)`} source="Delhi Solar Portal"
            csv={() => toCsv((divisions ?? []).map((d) => ({ ...d })))}>
            {topDivisions.length ? (
              <EvilBarChart config={{ BRPL: { label: "BRPL", colors: DISCOM_COLORS.BRPL }, BYPL: { label: "BYPL", colors: DISCOM_COLORS.BYPL }, TPDDL: { label: "TPDDL", colors: DISCOM_COLORS.TPDDL } }}
                data={topDivisions} stackType="stacked" className="aspect-auto h-72 w-full flex-none" barRadius={3}>
                <EvilBarChart.Grid vertical={false} />
                <EvilBarChart.XAxis dataKey="division" tickLine={false} axisLine={false} fontSize={10} interval={0} angle={-30} textAnchor="end" height={50} />
                <EvilBarChart.YAxis width={44} tickLine={false} axisLine={false} fontSize={11} />
                <EvilBarChart.Tooltip />
                <EvilBarChart.Legend />
                <EvilBarChart.Bar dataKey="BRPL" />
                <EvilBarChart.Bar dataKey="BYPL" />
                <EvilBarChart.Bar dataKey="TPDDL" />
              </EvilBarChart>
            ) : <Skeleton className="h-72" />}
          </ChartCard>
        </TabsContent>
        <TabsContent value="surch">
          {scoped && scoped !== "BRPL" ? (
            <Missing what={`${scoped} surcharge history`} className="min-h-40">Only BRPL's PPAC/FPPAS page is scraped so far.</Missing>
          ) : (
            <ChartCard title="BRPL surcharge % over time" source="BRPL PPAC/FPPAS orders" csv={() => toCsv((surcharge ?? []).map((r) => ({ ...r })))}>
              <EvilLineChart config={{ pct: { label: "Surcharge %", colors: { light: ["#1d70b8"], dark: ["#1d70b8"] } } }}
                data={surchargeData} curveType="stepAfter" className="aspect-auto h-64 w-full flex-none">
                <EvilLineChart.Grid vertical={false} />
                <EvilLineChart.XAxis dataKey="from" tickLine={false} axisLine={false} fontSize={11} />
                <EvilLineChart.YAxis width={36} tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v: number) => `${v}%`} />
                <EvilLineChart.Tooltip />
                <EvilLineChart.Line dataKey="pct" />
              </EvilLineChart>
              <p className="text-sm text-muted-foreground">Context only: the bill model folds surcharge into its calibration and does not apply these orders month by month.</p>
            </ChartCard>
          )}
        </TabsContent>
        <TabsContent value="rates">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat k="RBI repo rate" v={today?.rates ? `${today.rates.repo_pct.toFixed(2)}%` : "…"} tag={<SourceTag tier="govt">RBI · {shortDate(today?.rates?.as_of)}</SourceTag>} />
            <Stat k="Scheme solar loan (≤ 3 kW)" v={today?.rates ? `${today.rates.scheme_loan_pct.toFixed(2)}%` : "…"} tag={<SourceTag tier="govt">repo + 0.50%</SourceTag>} />
            <Stat k="Term deposit > 1 year" v={today?.rates ? `${today.rates.deposit_low_pct.toFixed(2)}–${today.rates.deposit_high_pct.toFixed(2)}%` : "…"}
              tag={<SourceTag tier="govt">what your cash would earn instead</SourceTag>} />
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-sm text-muted-foreground">Market prices come from installer websites and are indicative.</p>
    </div>
  )
}
