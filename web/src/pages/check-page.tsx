import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"

import { CardTitle, ChartCard, Missing, SourceTag, Stat, VerdictPill, tierOf, toCsv } from "@/components/bits"
import { MonthlyBillChart } from "@/components/monthly-bill-chart"
import { BarList, CostSplit, CoverBars, Milestones, PaybackCurve, Split } from "@/components/proof"
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
import { cn } from "@/lib/utils"
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
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">DISCOM</span>
            <Select value={h.disco} onValueChange={(v) => update({ disco: v as typeof h.disco })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{["BRPL", "BYPL", "TPDDL"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* result */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-[2px] border bg-white p-5">
            <CardTitle>Verdict</CardTitle>
            {error ? <p className="text-sm text-destructive">Couldn't reach the engine: {error}</p>
              : sizeTooBig ? <div className="flex items-center gap-2"><VerdictPill v="NOT_WORTH" /><b>System size can't exceed your sanctioned load.</b></div>
              : !answer ? <Skeleton className="h-8" />
              : <VerdictHeadline answer={answer} />}
          </div>

          {answer && !sizeTooBig && (
            <div className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")}>
              {/* the free route's numbers only once the scheme is actually open */}
              <Numbers answer={answer} o={freeOk && answer.free_operational && answer.free ? answer.free : answer.paid} />
              <CleanPower o={answer.paid} env={answer.environment} />
            </div>
          )}
          {!answer && !error && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>}

          <div className="grid gap-3 xl:grid-cols-2">
            <ChartCard boxed title="Money back over time" source="Year-by-year saving after upkeep and inverter replacement"
              csv={() => toCsv((answer?.paid.cumulative ?? []).map((c) => ({ year: c.year, money_in_hand_inr: c.value })))}>
              {answer ? (
                <>
                  <Milestones steps={[
                    { label: "Pay today", value: lakh(answer.paid.you_pay) },
                    { label: "Paid back", value: answer.paid.payback_years != null ? years(answer.paid.payback_years) : "never", tone: answer.paid.payback_years == null ? "bad" : undefined },
                    ...(answer.paid.lifetime_gain != null ? [{ label: "In 25 years", value: `${answer.paid.lifetime_gain >= 0 ? "+" : ""}${lakh(answer.paid.lifetime_gain)}`, tone: answer.paid.lifetime_gain >= 0 ? "good" as const : "bad" as const }] : []),
                  ]} />
                  <PaybackCurve breakEvenYear={answer.paid.payback_years}
                    series={[{ key: "you", label: "Money in hand", color: "#00703c", points: answer.paid.cumulative }]} className="h-56" />
                </>
              ) : <Skeleton className="h-64" />}
            </ChartCard>
            <ChartCard boxed title="Your bill, month by month" source="Bill now against bill with solar"
              csv={() => toCsv((answer?.paid.monthly ?? []).map((m) => ({ ...m })))}>
              {answer ? (
                <>
                  <Milestones steps={[
                    { label: "Bill now", value: `${rupees(answer.paid.bill_now_month)}/mo` },
                    { label: "With solar", value: `${rupees(answer.paid.bill_with_month)}/mo`, tone: "good" },
                    { label: "Year-1 saving", value: rupees(answer.paid.saving_year1), tone: "good" },
                  ]} />
                  <MonthlyBillChart monthly={answer.paid.monthly} />
                </>
              ) : <Skeleton className="h-64" />}
            </ChartCard>
          </div>

          {!sizeTooBig && (
            <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
              <SizeCompare />
              {answer?.paid.value_per_unit != null && answer.paid.cost_per_unit != null && (
                <div className="flex flex-col gap-3 rounded-[2px] border bg-white p-5">
                  <CardTitle source="Over 25 years, per unit of solar power">Worth it per unit?</CardTitle>
                  <BarList labelWidth="5rem" rows={[
                    { label: "Worth", value: answer.paid.value_per_unit, display: `₹${answer.paid.value_per_unit.toFixed(2)}`, color: "#00703c" },
                    { label: "Costs", value: answer.paid.cost_per_unit, display: `₹${answer.paid.cost_per_unit.toFixed(2)}`, color: "#b1b4b6" },
                  ]} />
                  <CostSplit price={answer.paid.price} central={answer.paid.central_subsidy} delhi={answer.paid.delhi_subsidy} youPay={answer.paid.you_pay} />
                </div>
              )}
            </div>
          )}

          <Collapsible className="rounded-[2px] border bg-white px-5 py-4">
            <CollapsibleTrigger className="group flex w-full items-center gap-2 font-semibold">
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
              <p className="text-sm text-muted-foreground">Tariffs held flat for 25 years (conservative). Price used: {answer ? `${lakh(answer.paid.price)} (${answer.price_basis})` : "…"}.</p>
              <button className="self-start text-sm govuk-link" onClick={() => navigate("guide")}>Why is my subsidy different? Read the guide →</button>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex flex-wrap gap-2">
            {sizeTooBig ? (
              <Button onClick={() => update({ size: Math.min(h.load, 5) })}>Use {Math.min(h.load, 5)} kW instead</Button>
            ) : (
              <Button size="lg" className="h-12 px-6 text-lg" onClick={() => navigate("deal")}>Next: get a fair deal →</Button>
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
    case "GO": return `Pays back in ${years(o.payback_years)}${o.emi_cover ? `; loan covered ${o.emi_cover.toFixed(1)}×` : ""}`
    case "MARGINAL": return "Saves money, but slowly at this usage."
    case "NOT_WORTH": return "At this usage, paying for solar costs more than it saves."
    case "GO_FREE": return "You qualify for the zero-cost route (≤ 400 units, ≤ 3 kW)."
  }
}

function VerdictHeadline({ answer }: { answer: Answer }) {
  const paid = <div className="flex flex-wrap items-center gap-3"><VerdictPill v={answer.paid.verdict} large /><b className="text-2xl leading-tight">{headline(answer.paid)}</b></div>
  if (!answer.free_eligible) return paid
  if (answer.free_operational) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3"><VerdictPill v="GO_FREE" large /><b className="text-2xl leading-tight">You qualify for the zero-cost route (≤ 400 units, ≤ 3 kW).</b></div>
        <span className="text-[var(--govuk-secondary-text)]">If you pay for it instead: <VerdictPill v={answer.paid.verdict} /></span>
      </div>
    )
  }
  // eligible, but the scheme isn't taking applications: lead with what's true today
  return (
    <div className="flex flex-col gap-3">
      {paid}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <strong className="govuk-tag govuk-tag--yellow">Not open yet</strong>
        <span>Free-solar scheme: you'd qualify (≤ 400 units, ≤ 3 kW).</span>
      </div>
    </div>
  )
}

/** The energy side of the verdict: what the roof generates in a year and how much of the home's use that covers. */
function CleanPower({ o, env }: { o: Outcome; env: Answer["environment"] }) {
  const solar = o.monthly.reduce((t, m) => t + m.solar_units, 0)
  const used = o.monthly.reduce((t, m) => t + m.units, 0)
  if (!solar || !used) return null
  // net metering carries surplus across months, so cover is judged on the year
  const covered = Math.min(solar, used)
  const units = (v: number) => `${Math.round(v).toLocaleString("en-IN")} units`
  return (
    <div className="grid items-center gap-x-6 gap-y-3 border-l-8 border-[var(--govuk-green)] bg-white p-5 shadow-[inset_0_0_0_1px_var(--border)] sm:grid-cols-[auto_auto_auto_1fr]">
      <div className="flex flex-col">
        <span className="text-[var(--govuk-secondary-text)]">Clean power a year</span>
        <b className="text-[1.75rem] leading-tight tabular-nums">{units(solar)}</b>
      </div>
      <div className="flex flex-col">
        <span className="text-[var(--govuk-secondary-text)]">Of your use</span>
        <b className="text-[1.75rem] leading-tight text-[var(--govuk-green)] tabular-nums">{Math.floor((covered / used) * 100)}%</b>
      </div>
      <div className="flex flex-col">
        <span className="text-[var(--govuk-secondary-text)]">CO₂ avoided a year</span>
        <b className="text-[1.75rem] leading-tight tabular-nums">{env.co2_tonnes_year.toFixed(1)} t</b>
        <span className="text-sm text-[var(--govuk-secondary-text)]">{env.co2_tonnes_lifetime} t over {env.life_years} years</span>
      </div>
      <Split format={units} parts={[
        { label: "From your roof", value: covered, color: "#00703c" },
        { label: "From the grid", value: used - covered, color: "#b1b4b6" },
        { label: "Spare, sent to the grid", value: Math.max(0, solar - used), color: "#f47738" },
      ]} />
    </div>
  )
}

function Numbers({ answer, o }: { answer: Answer; o: Outcome }) {
  const { today } = useApp()
  const p = answer.paid
  const rate = today?.rates ? `${today.rates.scheme_loan_pct.toFixed(2)}%` : "scheme"
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat k="Monthly bill" v={rupees(o.bill_with_month)} tag={<SourceTag tier="govt">down from {rupees(o.bill_now_month)}</SourceTag>} />
      <Stat k="Payback" v={o.verdict === "GO_FREE" ? "Nothing to pay" : years(p.payback_years)}
        tag={<SourceTag tier="govt">at {lakh(p.price)} {answer.price_basis === "your quote" ? "quoted" : "market price"}</SourceTag>} />
      {answer.loan_applies && p.emi_cover && p.emi_month ? (
        <Stat k={`Loan cover (${rate})`} v={`${p.emi_cover.toFixed(1)}×`}
          tag={<CoverBars saving={p.saving_year1 / 12} emi={p.emi_month} className="pt-1" />} />
      ) : (
        <Stat k="Loan cover" v="—" tag={<SourceTag tier="govt">scheme loan is for up to 3 kW</SourceTag>} />
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

/** Every size the roof and load allow, side by side: money back over 25 years and payback. */
function SizeCompare() {
  const { household: h, update } = useApp()
  const roof = SAMPLE_ROOFS.find((r) => r.id === h.roof)
  const sizes = SIZES.filter((k) => k <= h.load && (!roof || k <= roof.fitKw))
  const [rows, setRows] = useState<{ size: number; gain: number; payback: number | null; bench: boolean; co2: number }[] | null>(null)
  useEffect(() => {
    let alive = true
    setRows(null)
    Promise.all(sizes.map((k) => api.answer({ units: h.units, load: h.load, size: k })))
      .then((rs) => alive && setRows(rs.map((a, i) => ({ size: sizes[i], gain: a.paid.lifetime_gain ?? 0, payback: a.paid.payback_years, bench: a.price_basis === "govt benchmark", co2: a.environment.co2_tonnes_year }))))
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.units, h.load, sizes.join()])
  if (sizes.length < 2) return null
  // only sizes with real market prices compete for "most money back"
  const best = rows?.filter((r) => !r.bench).reduce<(typeof rows)[number] | undefined>((a, b) => (!a || b.gain > a.gain ? b : a), undefined)
  const max = Math.max(1, ...(rows ?? []).map((r) => Math.abs(r.gain)))
  return (
    <div className="flex flex-col gap-3 rounded-[2px] border bg-white p-5">
      <CardTitle source={roof ? `Up to ${roof.fitKw} kW fits your roof` : `Up to your ${h.load} kW load`}>Which size?</CardTitle>
      {!rows ? <Skeleton className="h-28" /> : (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[4rem_1fr_5.5rem_6rem] gap-3 text-sm text-[var(--govuk-secondary-text)]">
            <span>Size</span><span>Money back in 25 years</span><span className="text-right">CO₂ a year</span><span className="text-right">Payback</span>
          </div>
          {rows.map((r) => (
            <button key={r.size} onClick={() => update({ size: r.size })} aria-pressed={r.size === h.size}
              className={cn("grid grid-cols-[4rem_1fr_5.5rem_6rem] items-center gap-3 border-l-4 py-1.5 pl-2 text-left hover:bg-[var(--govuk-light-grey)]",
                r.size === h.size ? "border-[var(--govuk-blue)] bg-[var(--govuk-light-grey)]" : "border-transparent")}>
              <span className="flex flex-col"><b>{r.size} kW</b>{r.bench && <span className="text-xs text-[var(--govuk-secondary-text)]">govt price</span>}</span>
              <span className="flex items-center gap-2">
                <span className="h-4 shrink-0 rounded-r-[3px]" style={{ width: `${(Math.max(0, r.gain) / max) * 50}%`, minWidth: 3, background: r.bench ? "#b1b4b6" : r.gain > 0 ? "#00703c" : "#d4351c" }} />
                <span className="text-sm whitespace-nowrap tabular-nums">{r.gain >= 0 ? "+" : ""}{lakh(r.gain)}</span>
                {best?.size === r.size && <span className="govuk-tag govuk-tag--green">Best</span>}
              </span>
              <span className="text-right text-[var(--govuk-green)] tabular-nums">{r.co2.toFixed(1)} t</span>
              <span className="text-right tabular-nums">{r.bench ? "—" : years(r.payback)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
