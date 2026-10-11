import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"

import { CardTitle, Missing, SourceTag, Stat, VerdictPill, tierOf } from "@/components/bits"
import { MonthlyBillChart } from "@/components/monthly-bill-chart"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, type Answer, type Outcome } from "@/lib/api"
import { useAnswer, useApp } from "@/lib/app-context"
import { lakh, rupees, years } from "@/lib/format"
import { SAMPLE_ROOFS } from "@/lib/roofs"
import { shareUrl } from "@/lib/url-state"
import { ChevronDown } from "lucide-react"

const LOADS = [2, 3, 5, 7]
const SIZES = [1, 2, 3, 4, 5]

// Rules shown under "Why?", in the order a household meets them
const WHY_RULES: [string, string][] = [
  ["power_subsidy", "Delhi power subsidy: based on the units you use (gross)"],
  ["central_subsidy", "Central subsidy (PM Surya Ghar)"],
  ["delhi_subsidy", "Delhi subsidy (2nd amendment)"],
  ["net_metering.surplus_rate", "Net-metering surplus rate"],
  ["tariff.energy_slabs", "Tariff slabs"],
  ["yield.extra_losses", "Assumption: extra losses for dust and haze"],
  ["finance.om_after_free", "Assumption: upkeep after year 5"],
]

export function CheckPage() {
  const { household: h, update, navigate, provenance } = useApp()
  const { answer, loading, error } = useAnswer({ units: h.units, load: h.load, size: h.size })
  const roof = SAMPLE_ROOFS.find((r) => r.id === h.roof)
  const [billHelp, setBillHelp] = useState(false)
  const [share, setShare] = useState(false)
  const [draft, setDraft] = useState(h.units)
  useEffect(() => setDraft(h.units), [h.units])

  const freeOk = !!answer?.free_eligible
  const sizeTooBig = h.size > h.load

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-[2rem] leading-tight font-bold">Check with my bill</h1>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* inputs */}
        <div className="flex flex-col gap-4 self-start rounded-[2px] border bg-white p-5">
          <CardTitle source={<button className="govuk-link" onClick={() => setBillHelp(true)}>Where do I find these on my bill?</button>}>Your numbers</CardTitle>
          <div className="flex flex-col gap-2">
            <label htmlFor="units" className="text-sm text-muted-foreground">Monthly units (from your bill)</label>
            <Input id="units" type="number" min={50} max={2000} step={10} value={draft}
              onChange={(e) => setDraft(+e.target.value)} onBlur={() => draft > 0 && update({ units: draft })}
              onKeyDown={(e) => e.key === "Enter" && draft > 0 && update({ units: draft })} />
            <Slider min={50} max={1000} step={10} value={[Math.min(draft, 1000)]} onValueChange={([v]) => setDraft(v)} onValueCommit={([v]) => update({ units: v })}
              aria-label="Monthly units" />
            <BillToUnits load={h.load} onUnits={(u) => update({ units: u })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Sanctioned load</span>
            <ToggleGroup type="single" size="sm" variant="outline" value={String(h.load)}
              onValueChange={(v) => v && update({ load: +v, size: Math.min(h.size, +v) })} className="flex-wrap justify-start">
              {LOADS.map((l) => <ToggleGroupItem key={l} value={String(l)}>{l} kW</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">System size {roof && <SourceTag tier="assumption">your roof fits {roof.fitKw} kW</SourceTag>}</span>
            <ToggleGroup type="single" size="sm" variant="outline" value={String(h.size)} onValueChange={(v) => v && update({ size: +v })} className="flex-wrap justify-start">
              {SIZES.map((k) => <ToggleGroupItem key={k} value={String(k)} disabled={k > h.load}>{k} kW</ToggleGroupItem>)}
            </ToggleGroup>
            <span className="text-sm text-muted-foreground">Can't be larger than your sanctioned load.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">DISCOM</span>
            <Select value={h.disco} onValueChange={(v) => update({ disco: v as typeof h.disco })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{["BRPL", "BYPL", "TPDDL"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!roof && (
            <p className="govuk-inset border-[var(--govuk-blue)] bg-[#bbd4ea]/30">
              No roof picked. <button className="underline" onClick={() => navigate("map")}>Find my roof</button> to get a size suggestion.
            </p>
          )}
        </div>

        {/* result */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-[2px] border bg-white p-5">
            <CardTitle source="Worked out by the SolCall engine from Delhi tariff and subsidy rules">Verdict</CardTitle>
            {error ? <p className="text-sm text-destructive">Couldn't reach the engine: {error}</p>
              : sizeTooBig ? <div className="flex items-center gap-2"><VerdictPill v="NOT_WORTH" /><b>System size can't exceed your sanctioned load.</b></div>
              : !answer ? <Skeleton className="h-8" />
              : <VerdictHeadline answer={answer} />}
          </div>

          {answer && !sizeTooBig && (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <Numbers answer={answer} o={freeOk && answer.free ? answer.free : answer.paid} />
            </div>
          )}
          {!answer && !error && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>}

          <div className="flex flex-col gap-2 rounded-[2px] border bg-white p-5">
            <CardTitle source="Delhi tariff and net metering, year 1">Monthly bill, Apr–Mar: now vs with solar</CardTitle>
            {answer ? <MonthlyBillChart monthly={answer.paid.monthly} /> : <Skeleton className="h-44" />}
          </div>

          <Collapsible className="rounded-[2px] border bg-white px-5 py-4">
            <CollapsibleTrigger className="group flex w-full items-center gap-2 text-sm font-semibold">
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />Why? Rules and sources used
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-2 pt-3">
              {WHY_RULES.map(([key, label]) => {
                const r = provenance?.rules[key]
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{label}</span>
                    {r ? (
                      <>
                        <SourceTag tier={key.startsWith("yield") || key.startsWith("finance") ? "assumption" : tierOf(r.tier)} title={r.note}>
                          {r.source_name ?? r.source_id ?? "assumption"} · {r.as_of}
                        </SourceTag>
                        {r.verify && <SourceTag tier="verify">VERIFY</SourceTag>}
                        {r.url && <a className="text-sm govuk-link" href={r.url} target="_blank" rel="noopener noreferrer">source</a>}
                      </>
                    ) : <Skeleton className="h-5 w-40" />}
                  </div>
                )
              })}
              {answer && (
                <p className="text-sm">A solar unit is worth <b>₹{answer.paid.value_per_unit?.toFixed(2)}</b> to you and costs <b>₹{answer.paid.cost_per_unit?.toFixed(2)}</b> over 25 years.</p>
              )}
              <p className="text-sm text-muted-foreground">Tariffs held flat for 25 years (conservative). Price used: {answer ? `${lakh(answer.paid.price)} (${answer.price_basis})` : "…"}.</p>
              <button className="self-start text-sm govuk-link" onClick={() => navigate("guide")}>Why is my subsidy different? Read the guide →</button>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex flex-wrap gap-2">
            {sizeTooBig ? (
              <Button onClick={() => update({ size: Math.min(h.load, 5) })}>Use {Math.min(h.load, 5)} kW instead</Button>
            ) : (
              <Button onClick={() => navigate("deal", { dealTab: null })}>{freeOk ? "Next: apply for the free scheme →" : "Next: get a fair price →"}</Button>
            )}
            <Button variant="outline" onClick={() => setShare(true)} disabled={!answer}>Share verdict</Button>
            <Button variant="outline" onClick={() => navigate("alerts")}>Alert me when this changes</Button>
          </div>
        </div>
      </div>

      <Dialog open={billHelp} onOpenChange={setBillHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Where to find these on your bill</DialogTitle>
            <DialogDescription>“Units consumed” is your monthly units. “Sanctioned load” is in kW near your name and account number.</DialogDescription>
          </DialogHeader>
          <Missing what="annotated sample bill image" className="min-h-48">A BRPL / BYPL / TPDDL bill with “units consumed” and “sanctioned load” circled.</Missing>
        </DialogContent>
      </Dialog>

      <Dialog open={share} onOpenChange={setShare}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share your verdict</DialogTitle></DialogHeader>
          <Missing what="verdict card image" className="min-h-28">A ready-to-send image of this verdict for WhatsApp.</Missing>
          <div className="flex gap-4">
            <div className="rounded-lg bg-white p-2"><QRCodeSVG value={shareUrl()} size={88} /></div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="font-mono text-sm break-all">{shareUrl()}</span>
              <Button size="sm" variant="outline" onClick={async () => {
                try { await navigator.clipboard.writeText(shareUrl()); toast("Link copied") } catch { toast.error("Couldn't copy") }
              }}>Copy link</Button>
              <Button size="sm" asChild>
                <a href={`https://wa.me/?text=${encodeURIComponent(`My rooftop solar check: ${answer ? headline(answer.paid) : ""} ${shareUrl()}`)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function headline(o: Outcome) {
  switch (o.verdict) {
    case "GO": return `Pays back in ${years(o.payback_discounted_years)}${o.emi_cover ? `; loan covered ${o.emi_cover.toFixed(1)}×` : ""}`
    case "MARGINAL": return "Saves money, but slowly at this usage."
    case "NOT_WORTH": return "At this usage, paying for solar costs more than it saves."
    case "GO_FREE": return "You qualify for the zero-cost route (≤ 400 units, ≤ 3 kW)."
  }
}

function VerdictHeadline({ answer }: { answer: Answer }) {
  if (answer.free_eligible) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3"><VerdictPill v="GO_FREE" large /><b className="text-xl">You qualify for the zero-cost route (≤ 400 units, ≤ 3 kW).</b></div>
        <span className="text-sm text-muted-foreground">
          {answer.free_operational ? "" : "The free scheme isn't open yet. "}If you pay for it today: <VerdictPill v={answer.paid.verdict} />
        </span>
      </div>
    )
  }
  return <div className="flex flex-wrap items-center gap-3"><VerdictPill v={answer.paid.verdict} large /><b className="text-xl">{headline(answer.paid)}</b></div>
}

function Numbers({ answer, o }: { answer: Answer; o: Outcome }) {
  const { today } = useApp()
  const p = answer.paid
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat k="Monthly bill: now → with solar" v={`${rupees(o.bill_now_month)} → ${rupees(o.bill_with_month)}`} tag={<SourceTag tier="govt">Delhi tariff + subsidy</SourceTag>} />
      <Stat k="Payback" v={o.verdict === "GO_FREE" ? "nothing to pay" : years(p.payback_discounted_years)}
        tag={<SourceTag tier={answer.price_basis === "market median" ? "market" : "govt"}>at {lakh(p.price)} · {answer.price_basis}</SourceTag>} />
      {answer.loan_applies && p.emi_cover ? (
        <Stat k="Loan EMI cover" v={`${p.emi_cover.toFixed(1)}×`}
          tag={<SourceTag tier="govt">{today?.rates ? `${today.rates.scheme_loan_pct.toFixed(2)}%` : ""} loan · EMI {rupees(p.emi_month)}</SourceTag>} />
      ) : (
        <Stat k="Loan EMI cover" v="—" tag={<SourceTag tier="assumption">scheme loan is for ≤ 3 kW</SourceTag>} />
      )}
    </div>
  )
}

function BillToUnits({ load, onUnits }: { load: number; onUnits: (u: number) => void }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  if (!open) return <button className="self-start text-sm govuk-link" onClick={() => setOpen(true)}>I only know my bill in ₹</button>
  return (
    <form className="flex gap-2" onSubmit={async (e) => {
      e.preventDefault()
      try {
        const r = await api.unitsFromBill(+amount, load)
        onUnits(r.units); setOpen(false)
        toast(`About ${r.units} units a month`, { description: r.note ?? "Worked out from the Delhi tariff." })
      } catch { toast.error("Couldn't convert that bill.") }
    }}>
      <Input inputMode="numeric" placeholder="Bill in ₹" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} autoFocus />
      <Button type="submit" variant="secondary" size="sm">Use</Button>
    </form>
  )
}
