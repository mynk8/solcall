import { useEffect, useState } from "react"

import { SourceTag, type Tier } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"

type Feed = { name: string; source: string; tier: Tier; tierLabel: string; cadence: string; href: string; kind: "CSV" | "JSON"; fields: string }

// For lenders, DISCOMs and journalists.
const FEEDS: Feed[] = [
  { name: "Reference price", source: "Govt benchmark + installer pages", tier: "govt", tierLabel: "T1 / T3", cadence: "weekly", href: "/api/reference-price", kind: "JSON", fields: "per size: benchmark, market low/median/high, history, n, dates" },
  { name: "Household outcomes", source: "SolCall engine", tier: "data", tierLabel: "derived", cadence: "on rebuild", href: "/api/feeds/conservative-csv", kind: "CSV", fields: "units × load × size × route × rung → bill, saving, payback, NPV, IRR, EMI, verdict" },
  { name: "Best size per household", source: "SolCall engine", tier: "data", tierLabel: "derived", cadence: "on rebuild", href: "/api/feeds/best-size-csv", kind: "CSV", fields: "highest-NPV size per units × load × route × rung" },
  { name: "Applications by division", source: "Delhi Solar Portal", tier: "govt", tierLabel: "T1", cadence: "daily", href: "/api/web/divisions", kind: "JSON", fields: "discom, division, applications, rank, share" },
  { name: "Money rates", source: "RBI", tier: "govt", tierLabel: "T1", cadence: "weekly", href: "/api/web/today", kind: "JSON", fields: "repo, scheme loan, term deposit range" },
  { name: "Solar output", source: "Global Solar Atlas (World Bank / Solargis)", tier: "data", tierLabel: "T2", cadence: "once", href: "/api/web/today", kind: "JSON", fields: "kWh/kWp per year at 5 Delhi points" },
  { name: "Surcharge history", source: "BRPL", tier: "govt", tierLabel: "T1", cadence: "monthly", href: "/api/web/surcharge", kind: "JSON", fields: "from, to, %, order title, PDF" },
  { name: "Provenance", source: "All rules", tier: "data", tierLabel: "—", cadence: "on rebuild", href: "/api/provenance", kind: "JSON", fields: "every rule with source URL, tier, date; VERIFY and assumption lists" },
]

export function DataPage() {
  const [open, setOpen] = useState<Feed | null>(null)
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-tight font-bold">Data catalog &amp; API</h1>
        <p className="text-sm text-muted-foreground">For lenders, DISCOMs and journalists. Interactive API docs at <a className="govuk-link" href="/docs">/docs</a>.</p>
      </div>
      <div className="overflow-x-auto rounded-[2px] border bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-sm text-muted-foreground">
            <tr><th className="px-3 py-2">Feed</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Tier</th><th className="px-3 py-2">Cadence</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {FEEDS.map((f) => (
              <tr key={f.name} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setOpen(f)}>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{f.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.source}</td>
                <td className="px-3 py-2"><SourceTag tier={f.tier}>{f.tierLabel}</SourceTag></td>
                <td className="px-3 py-2 whitespace-nowrap">{f.cadence}</td>
                <td className="px-3 py-2 text-right govuk-link whitespace-nowrap">Details →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 rounded-[2px] border bg-white p-5">
        <h2 className="text-lg font-bold">API: one endpoint per feed</h2>
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-sm">{`GET /api/reference-price
GET /api/web/answer?units=450&load=3&size=3
GET /api/web/prices · /api/web/today · /api/web/surcharge · /api/web/divisions
POST /api/evaluate`}</pre>
      </div>
      <FeedSheet feed={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function FeedSheet({ feed, onClose }: { feed: Feed | null; onClose: () => void }) {
  const [sample, setSample] = useState<string>("")
  useEffect(() => {
    if (!feed) return
    setSample("")
    fetch(feed.href).then((r) => r.text()).then((t) => setSample(t.slice(0, 900))).catch(() => setSample("(couldn't load)"))
  }, [feed])
  return (
    <Sheet open={!!feed} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="gap-0 p-0 sm:max-w-md">
        {feed && (
          <>
            <SheetHeader className="border-b">
              <span className="text-sm text-muted-foreground">Feed</span>
              <SheetTitle>{feed.name}</SheetTitle>
              <SheetDescription>{feed.source} · {feed.cadence}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm">
              <div className="flex flex-col gap-1"><b>Fields</b><span className="text-muted-foreground">{feed.fields}</span></div>
              <div className="flex flex-col gap-1"><b>Endpoint</b><code className="rounded bg-muted px-2 py-1 text-sm">{feed.href}</code></div>
              <div className="flex flex-col gap-1"><b>Sample</b><pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-[11px] whitespace-pre-wrap">{sample || "Loading…"}</pre></div>
            </div>
            <SheetFooter className="flex-row border-t">
              <Button asChild className="flex-1"><a href={feed.href} target="_blank" rel="noopener noreferrer">Open {feed.kind}</a></Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
