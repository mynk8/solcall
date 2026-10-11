import { Missing, SourceTag, Stat } from "@/components/bits"
import { ScopeFilter } from "@/components/scope-filter"
import { useApp } from "@/lib/app-context"
import { lakh, shortDate } from "@/lib/format"

export function RecordsPage() {
  const { today, ladders, scope, navigate } = useApp()
  const discoms = (today?.applications.by_discom ?? []).filter((d) => scope === "Everywhere" || d.discom === scope)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-tight font-bold">Records</h1>
        <p className="text-[var(--govuk-secondary-text)]">As on {shortDate(today?.applications.as_on)}</p>
      </div>
      <ScopeFilter />
      <div className="grid gap-3 md:grid-cols-3">
        {discoms.map((d) => (
          <Stat key={d.discom} k={`Most applications: ${d.discom}`}
            v={d.top ? `${d.top.division} · ${d.top.applications.toLocaleString("en-IN")}` : "—"}
            tag={<SourceTag tier="govt">Delhi Solar Portal</SourceTag>} />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Stat k="Delhi total applications" v={today?.applications.total?.toLocaleString("en-IN") ?? "…"} tag={<SourceTag tier="govt">Delhi Solar Portal</SourceTag>} />
          <Missing what="change since last snapshot">“+n since last week” needs the applications feed to keep its previous snapshot.</Missing>
        </div>
        <div className="flex flex-col gap-2 rounded-[2px] border bg-white p-5">
          <h2 className="text-lg font-bold">Lowest price seen per size</h2>
          <table className="w-full text-sm">
            <tbody>
              {[1, 2, 3, 4, 5, 10].map((k) => {
                const low = ladders.get(k)?.market_low
                return (
                  <tr key={k} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => navigate("deal", { quoteSize: k, dealTab: "paid" })}>
                    <td className="py-1.5 font-semibold">{k} kW</td>
                    <td className="tabular-nums">{low ? lakh(low.total) : <span className="text-muted-foreground">no prices yet</span>}</td>
                    <td className="text-sm text-muted-foreground">{low?.as_of ?? ""}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
