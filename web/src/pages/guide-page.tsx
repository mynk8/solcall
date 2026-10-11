import type { ReactNode } from "react"

import { SourceTag } from "@/components/bits"
import { Split } from "@/components/proof"
import { Button } from "@/components/ui/button"
import { useApp } from "@/lib/app-context"
import { rupees } from "@/lib/format"
import { cn } from "@/lib/utils"

// Worked examples come from the Delhi Solar Energy Policy 2023, 2nd amendment (17 Sep 2026),
// and are the engine's acceptance tests (AGENT_SPEC.md §8).
const DELHI = "#28a197", YOU = "#505a5f", PAYOUT = "#1d70b8", BONUS = "#00703c"

const BRACKETS = [
  { upTo: 200, label: "0–200 units", pays: "Delhi pays the whole bill", color: "#00703c" },
  { upTo: 400, label: "201–400 units", pays: "Delhi pays half, up to ₹800", color: "#85994b" },
  { upTo: 600, label: "Over 400 units", pays: "No subsidy", color: "#b1b4b6" },
]

/** The three usage brackets as one band, with optional markers for a home's units. */
function Brackets({ marks = [] }: { marks?: { units: number; label: string; muted?: boolean }[] }) {
  const at = (u: number) => `${(Math.min(u, 600) / 600) * 100}%`
  return (
    <div className="flex flex-col">
      {marks.length > 0 && (
        <div className="relative h-8">
          {marks.map((m) => (
            <span key={m.label} className={cn("absolute bottom-1 -translate-x-1/2 rounded px-2 py-0.5 text-sm font-bold whitespace-nowrap",
              m.muted ? "border border-dashed border-[#0b0c0c] bg-white line-through decoration-[var(--govuk-red)] decoration-2" : "bg-[#0b0c0c] text-white")}
              style={{ left: at(m.units) }}>{m.label}</span>
          ))}
        </div>
      )}
      <div className="relative flex h-12 gap-px">
        {BRACKETS.map((b) => (
          <div key={b.label} className="flex flex-1 flex-col justify-center px-2 text-white" style={{ background: b.color }}>
            <b className="text-sm leading-tight">{b.label}</b>
            <span className="text-xs leading-tight">{b.pays}</span>
          </div>
        ))}
        {marks.map((m) => <i key={m.label} className={cn("absolute -top-1.5 h-3 w-0.5 -translate-x-1/2", m.muted ? "bg-[#0b0c0c]/50" : "bg-[#0b0c0c]")} style={{ left: at(m.units) }} />)}
      </div>
    </div>
  )
}

const SECTIONS: { id: string; toc: string; title: string; line: string; visual: ReactNode }[] = [
  {
    id: "rule", toc: "The usage rule", title: "Your bracket is set by the units you use, before solar",
    line: "The subsidy is then taken off the bill that is left after solar.",
    visual: <Brackets />,
  },
  {
    id: "ex1", toc: "400 units → pay ₹1,472", title: "400 units, 3 kW load: a ₹2,272 bill",
    line: "Half the bill would be ₹1,136, so the ₹800 cap applies.",
    visual: <Split tall format={rupees} parts={[{ label: "Delhi pays", value: 800, color: DELHI }, { label: "You pay", value: 1472, color: YOU }]} />,
  },
  {
    id: "ex2", toc: "100 units → pay ₹0", title: "100 units: a ₹613 bill",
    line: "At 200 units or less, the whole bill is covered.",
    visual: <Split tall format={rupees} parts={[{ label: "Delhi pays", value: 613, color: DELHI }]} />,
  },
  {
    id: "ex3", toc: "450 units, 150 after solar", title: "450 units used, solar cuts the bill to 150 units",
    line: "You pay the full bill for 150 units: the bracket follows the 450 you use.",
    visual: <Brackets marks={[{ units: 150, label: "150 left after solar", muted: true }, { units: 450, label: "450 used: your bracket" }]} />,
  },
  {
    id: "ex4", toc: "Under 200 units → earn ₹550", title: "150 units used, 200 generated: about ₹550 a month to you",
    line: "50 spare units at a ₹6.50 surplus rate, plus half of ₹3 for each of the 150 solar units you use.",
    visual: <Split tall format={rupees} parts={[{ label: "Surplus payout", value: 325, color: PAYOUT }, { label: "Under-200 incentive", value: 225, color: BONUS }]} />,
  },
]

export function GuidePage() {
  const { navigate } = useApp()
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-tight font-bold">How Delhi's solar subsidy really works</h1>
        <SourceTag tier="govt">Delhi solar policy, 2nd amendment · 17 Sep 2026</SourceTag>
      </div>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-1.5 self-start rounded-[2px] border bg-white p-5 text-sm md:sticky md:top-4">
          <span className="pb-1 text-sm font-semibold text-muted-foreground">On this page</span>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="govuk-link"
              onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" }) }}>{s.toc}</a>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="flex scroll-mt-4 flex-col gap-3 rounded-[2px] border bg-white p-5">
              <div className="flex flex-col">
                <span className="text-sm text-[var(--govuk-secondary-text)]">{i === 0 ? "The rule" : `Example ${i}`}</span>
                <h2 className="text-lg font-bold">{s.title}</h2>
              </div>
              {s.visual}
              <p className="text-sm text-[var(--govuk-secondary-text)]">{s.line}</p>
            </section>
          ))}
          <Button className="self-start" onClick={() => navigate("check")}>Check with my bill →</Button>
        </div>
      </div>
    </div>
  )
}
