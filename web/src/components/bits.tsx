import { useState, type ReactNode } from "react"
import { Download, Maximize2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Verdict } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * A labelled hole where data doesn't exist yet (GOV.UK inset text). Every <Missing> is listed
 * in web/README.md ("Placeholders") so it can be backfilled; grep for `<Missing` to find them.
 */
export function Missing({ what, children, className }: { what: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("govuk-inset flex flex-col gap-1 border-dashed bg-[var(--govuk-light-grey)]/60", className)}>
      <span className="font-semibold">Data needed: {what}</span>
      {children && <span className="text-[var(--govuk-secondary-text)]">{children}</span>}
    </div>
  )
}

export type Tier = "govt" | "data" | "market" | "assumption" | "verify"

/**
 * Where a number comes from. Plain secondary text for sources; a tag only when the reader
 * should notice it (an assumption, or a value still to be verified).
 */
export function SourceTag({ tier, children, title }: { tier: Tier; children: ReactNode; title?: string }) {
  if (tier === "verify") return <span className="govuk-tag govuk-tag--yellow" title={title}>To verify</span>
  if (tier === "assumption") return <span className="govuk-tag govuk-tag--grey" title={title}>{children}</span>
  return <span className="text-sm text-[var(--govuk-secondary-text)]" title={title}>{children}</span>
}

export const tierOf = (t: string | null | undefined): Tier => (t === "T1" ? "govt" : t === "T2" ? "data" : t === "T3" ? "market" : "assumption")

export const VERDICT: Record<Verdict, { label: string; tag: string }> = {
  GO: { label: "Worth it", tag: "govuk-tag--green" },
  GO_FREE: { label: "Free for you", tag: "govuk-tag--blue" },
  MARGINAL: { label: "Marginal", tag: "govuk-tag--yellow" },
  NOT_WORTH: { label: "Not worth it", tag: "govuk-tag--red" },
}

export function VerdictPill({ v, large }: { v: Verdict; large?: boolean }) {
  return <strong className={cn("govuk-tag", VERDICT[v].tag)} style={large ? { fontSize: "1.125rem", padding: "4px 12px" } : undefined}>{VERDICT[v].label}</strong>
}

/** Section heading used inside cards: one clear title, optional source line underneath. */
export function CardTitle({ children, source, action }: { children: ReactNode; source?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex min-w-0 flex-col">
        <h2 className="text-lg font-bold">{children}</h2>
        {source && <span className="text-sm text-[var(--govuk-secondary-text)]">{source}</span>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  )
}

/** Chart card: title + source, CSV download and expand. */
export function ChartCard({ title, source, csv, children, className }: {
  title: string; source?: string; csv?: () => string; children: ReactNode; className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <CardTitle source={source && `Source: ${source}`} action={
        <div className="flex gap-1">
          {csv && (
            <Button variant="ghost" size="sm" onClick={() => download(`${slug(title)}.csv`, csv())}>
              <Download /> CSV
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setExpanded(true)} aria-label="Expand chart">
            <Maximize2 />
          </Button>
        </div>
      }>{title}</CardTitle>
      {children}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <div className="min-h-[360px]">{children}</div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** A key figure: label, big number, source line. */
export function Stat({ k, v, tag, className }: { k: string; v: ReactNode; tag?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 border-t-4 border-[var(--govuk-blue)] bg-[var(--govuk-light-grey)] p-4", className)}>
      <span className="text-[var(--govuk-secondary-text)]">{k}</span>
      <span className="text-2xl font-bold tabular-nums">{v}</span>
      {tag && <div>{tag}</div>}
    </div>
  )
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }))
  const a = Object.assign(document.createElement("a"), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const toCsv = (rows: Record<string, unknown>[]) =>
  rows.length ? [Object.keys(rows[0]).join(","), ...rows.map((r) => Object.values(r).map((v) => JSON.stringify(v ?? "")).join(","))].join("\n") : ""
