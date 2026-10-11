import { SourceTag } from "@/components/bits"
import { Button } from "@/components/ui/button"
import { useApp } from "@/lib/app-context"

// Worked examples come from the Delhi Solar Energy Policy 2023, 2nd amendment (17 Sep 2026),
// and are the engine's acceptance tests (AGENT_SPEC.md §8).
const SECTIONS = [
  {
    id: "rule", toc: "The gross-consumption rule", title: "The gross-consumption rule",
    body: [
      "Delhi's power subsidy depends on how many units you use in a month, before solar. That number decides your bracket: 200 or less, 201–400, or more than 400.",
      "The subsidy is then applied to the bill left after solar. So two homes with the same bill after solar can get very different subsidies, depending on how much they used.",
    ],
  },
  {
    id: "ex1", toc: "400 units → ₹2,272", title: "Example 1: 400 units, 3 kW load",
    body: ["The bill before subsidy is about ₹2,272. At 201–400 units, Delhi pays half the bill, capped at ₹800.", "You pay about ₹1,472."],
  },
  {
    id: "ex2", toc: "100 units → ₹613", title: "Example 2: 100 units",
    body: ["The bill before subsidy is about ₹613. At 200 units or less, Delhi pays all of it.", "You pay ₹0."],
  },
  {
    id: "ex3", toc: "The 450-unit case", title: "Example 3: 450 units used, solar brings the bill to 150",
    body: ["Your bracket is set by the 450 units you use, not the 150 left after solar. Above 400 there's no subsidy.", "You pay the full bill for 150 units."],
  },
  {
    id: "ex4", toc: "Under 200 units: ₹550 a month", title: "Example 4: 150 units used, 200 generated",
    body: [
      "The 50 extra units are paid out at the year-end surplus rate. Homes using 200 units or less also get an incentive: half of ₹3 for every solar unit they use themselves.",
      "With a ₹6.50 surplus rate that is ₹325 payout + ₹225 incentive = about ₹550 a month.",
    ],
  },
]

export function GuidePage() {
  const { navigate } = useApp()
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <h1 className="text-[2rem] leading-tight font-bold">How Delhi's solar subsidy really works</h1>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-1.5 self-start rounded-[2px] border bg-white p-5 text-sm md:sticky md:top-4">
          <span className="pb-1 text-sm font-semibold text-muted-foreground">On this page</span>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="govuk-link"
              onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" }) }}>{s.toc}</a>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-4">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="flex scroll-mt-4 flex-col gap-2 rounded-[2px] border bg-white p-5">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{s.title}</h2>
                <span className="ml-auto"><SourceTag tier="govt">Delhi solar policy, 2nd amendment · 17 Sep 2026</SourceTag></span></div>
              {s.body.map((p) => <p key={p} className="max-w-prose text-sm leading-relaxed">{p}</p>)}
            </section>
          ))}
          <Button className="self-start" onClick={() => navigate("check")}>Check with my bill →</Button>
        </div>
      </div>
    </div>
  )
}
