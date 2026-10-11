import { ChartCard } from "@/components/bits"
import { BarList } from "@/components/proof"
import { DivisionBars } from "@/components/reference-charts"
import { DISCOM_COLORS } from "@/pages/reference-page"
import { ScopeFilter } from "@/components/scope-filter"
import { useApp } from "@/lib/app-context"
import { lakh, rupees, shortDate } from "@/lib/format"

export function RecordsPage() {
  const { today, ladders, scope, navigate } = useApp()
  const lows = [1, 2, 3, 4, 5, 10].map((k) => ({ k, low: ladders.get(k)?.market_low ?? null }))
  const bestPerKw = Math.min(...lows.flatMap((l) => (l.low ? [l.low.per_kw] : [])))
  const discoms = (today?.applications.by_discom ?? []).filter((d) => scope === "Everywhere" || d.discom === scope)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-tight font-bold">Records</h1>
        <p className="text-[var(--govuk-secondary-text)]">{today?.applications.total?.toLocaleString("en-IN") ?? "…"} homes applied across Delhi · as on {shortDate(today?.applications.as_on)}</p>
      </div>
      <ScopeFilter />
      <div className="grid gap-3 lg:grid-cols-3">
        {discoms.map((d) => (
          <ChartCard boxed key={d.discom} title={`Most applications · ${d.discom}`} source={`${d.total.toLocaleString("en-IN")} homes · Delhi Solar Portal`}
            className={discoms.length === 1 ? "lg:col-span-3" : undefined}>
            <DivisionBars discom={d.discom} limit={discoms.length === 1 ? 14 : 6} color={DISCOM_COLORS[d.discom as keyof typeof DISCOM_COLORS]?.light[0] ?? "#1d70b8"} />
          </ChartCard>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard boxed title="Lowest price seen, by size" source="Installer pages, before subsidy · click a size to check a quote">
          <BarList labelWidth="3.5rem" onPick={(l) => navigate("deal", { size: parseInt(l) })}
            rows={lows.map(({ k, low }) => ({ label: `${k} kW`, value: low?.total ?? 0, display: low ? lakh(low.total) : "no prices", color: "#1d70b8", note: low?.as_of ?? undefined }))} />
        </ChartCard>
        <ChartCard boxed title="Lowest price per kW" source="₹ per kW · green is the best value">
          <BarList labelWidth="3.5rem" rows={lows.map(({ k, low }) => ({
            label: `${k} kW`, value: low?.per_kw ?? 0, display: low ? rupees(low.per_kw) : "no prices",
            color: low && low.per_kw === bestPerKw ? "#00703c" : "#b1b4b6",
          }))} />
        </ChartCard>
      </div>
    </div>
  )
}
