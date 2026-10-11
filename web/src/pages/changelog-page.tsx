import { useMemo, useState } from "react"

import { SourceTag } from "@/components/bits"
import { ScopeFilter } from "@/components/scope-filter"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useApp } from "@/lib/app-context"
import { shortDate } from "@/lib/format"

const FILTERS = ["All", "Rules", "Rates", "Surcharge", "Prices", "Adoption"] as const
// engine categories → changelog filters
const CATEGORY: Record<string, (typeof FILTERS)[number]> = { Rules: "Rules", Rates: "Rates", Bills: "Surcharge", Prices: "Prices", Neighbours: "Adoption" }

type Item = { category: (typeof FILTERS)[number]; date: string; title: string; detail: string; source: string; url?: string | null }

export function ChangelogPage() {
  const { updates, surcharge, scope, navigate } = useApp()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All")

  const items = useMemo<Item[] | null>(() => {
    if (!updates || !surcharge) return null
    const fromUpdates: Item[] = updates.filter((u) => u.category !== "Bills").map((u) => ({ ...u, category: CATEGORY[u.category] ?? "Rules" }))
    // every BRPL surcharge order, newest first
    const orders: Item[] = surcharge.map((r, i) => ({
      category: "Surcharge", date: r.from,
      title: `BRPL surcharge ${r.pct.toFixed(2)}%${i > 0 ? ` (was ${surcharge[i - 1].pct.toFixed(2)}%)` : ""}`,
      detail: r.to ? `${shortDate(r.from)} to ${shortDate(r.to)}` : `From ${shortDate(r.from)}`,
      source: "BRPL", url: r.pdf,
    }))
    return [...fromUpdates, ...orders].sort((a, b) => b.date.localeCompare(a.date))
  }, [updates, surcharge])

  const shown = (items ?? []).filter((i) => filter === "All" || i.category === filter)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-tight font-bold">Changelog</h1>
        <p className="text-sm text-muted-foreground">What changed, and what it means for you.</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Show</span>
          <ToggleGroup type="single" size="sm" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)} className="flex-wrap justify-start">
            {FILTERS.map((f) => <ToggleGroupItem key={f} value={f}>{f}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <ScopeFilter />
      </div>
      {scope !== "Everywhere" && scope !== "BRPL" && (filter === "All" || filter === "Surcharge") && (
        <p className="text-[var(--govuk-secondary-text)]">Surcharge orders are shown for BRPL only for now.</p>
      )}
      {!items && <Skeleton className="h-40" />}
      <ol className="ml-1.5 flex flex-col gap-3 border-l-2 pl-5">
        {shown.map((i) => (
          <li key={`${i.date}-${i.title}`} className="relative flex flex-col gap-1.5 rounded-[2px] border bg-white p-3">
            <span className="absolute top-4 -left-[27px] size-2.5 rounded-full border-2 border-muted-foreground bg-card" />
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-sm">{i.title}</b>
              <SourceTag tier="data">{i.category}</SourceTag>
              <span className="ml-auto text-sm text-muted-foreground">{shortDate(i.date)}</span>
            </div>
            {i.detail && <span className="text-sm text-muted-foreground">{i.detail}</span>}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <SourceTag tier="govt">{i.source}</SourceTag>
              {i.url && <a className="text-sm govuk-link" href={i.url} target="_blank" rel="noopener noreferrer">order PDF</a>}
              <button className="ml-auto govuk-link" onClick={() => navigate("check")}>Re-check my verdict →</button>
            </div>
          </li>
        ))}
        {items && !shown.length && <p className="text-sm text-muted-foreground">Nothing in this category yet.</p>}
      </ol>
    </div>
  )
}
