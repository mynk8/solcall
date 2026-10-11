import { useEffect, useState } from "react"
import { Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { CardTitle } from "@/components/bits"
import { PriceLadder } from "@/components/price-ladder"
import { BarList, CostSplit, PaybackCurve } from "@/components/proof"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Outcome } from "@/lib/api"
import { useAnswer, useApp } from "@/lib/app-context"
import { lakh, rupees, years } from "@/lib/format"
import { judgeQuote } from "@/lib/quote"
import { cn } from "@/lib/utils"

const PORTAL = "https://solar.delhi.gov.in"
const SIZES = [1, 2, 3, 4, 5]

export function DealPage() {
  const { household: h, update, navigate, ladders, today } = useApp()
  const size = h.size
  const load = Math.max(h.load, size)

  // fair = priced at the market median; quoted = priced at the installer's quote
  const { answer: fair } = useAnswer({ units: h.units, load, size })
  const { answer: quoted } = useAnswer({ units: h.units, load, size, quote: h.quote }, !!h.quote)
  const priced = h.quote ? quoted : fair

  const [draft, setDraft] = useState(h.quote ? String(h.quote) : "")
  useEffect(() => {
    const t = setTimeout(() => update({ quote: +draft >= 10_000 ? +draft : null }), 350)
    return () => clearTimeout(t)
  }, [draft, update])

  const ladder = ladders.get(size)
  const judged = h.quote && ladder ? judgeQuote(h.quote, ladder) : null
  const rate = today?.rates ? `${today.rates.scheme_loan_pct.toFixed(2)}%` : "the scheme rate"

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-tight font-bold">Get a fair deal</h1>
        <p className="text-[var(--govuk-secondary-text)]">
          {h.units} units a month · {h.load} kW load · {h.disco} · <button className="govuk-link" onClick={() => navigate("check")}>change</button>
        </p>
      </div>

      {fair?.free_eligible && (
        <div className="govuk-inset flex flex-wrap items-center gap-3 border-[var(--govuk-blue)] bg-[#bbd4ea]/30">
          <div className="flex min-w-0 flex-1 flex-col">
            <b>You may get this free</b>
            <span>Homes using up to 400 units with a load up to 3 kW qualify. The scheme isn't open yet.</span>
          </div>
          <Button variant="secondary" onClick={() => navigate("alerts")}>Tell me when it opens</Button>
        </div>
      )}

      {/* 1 · Is the quote fair? */}
      <section className="flex flex-col gap-4 border bg-white p-5">
        <CardTitle>1. Is your quote fair?</CardTitle>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-48 flex-1 flex-col gap-1.5">
            <span className="text-[var(--govuk-secondary-text)]">Installer's quote, before subsidy (₹)</span>
            <Input inputMode="numeric" placeholder="e.g. 240000" value={draft} onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))} className="h-10 text-base" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[var(--govuk-secondary-text)]">System size</span>
            <ToggleGroup type="single" size="sm" variant="outline" value={String(size)} onValueChange={(v) => v && update({ size: +v, load: Math.max(h.load, +v) })}>
              {SIZES.map((k) => <ToggleGroupItem key={k} value={String(k)}>{k} kW</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
        </div>

        {ladder ? <PriceLadder ladder={ladder} quote={h.quote} /> : <Skeleton className="h-24" />}

        {judged ? (
          <div className={cn("govuk-inset flex flex-col gap-1.5",
            judged.tone === "good" ? "border-[var(--govuk-green)] bg-[#cce2d8]/40" : judged.tone === "warn" ? "border-[var(--govuk-orange)] bg-[#fcd6c3]/30" : "border-[var(--govuk-red)] bg-[#f4cdc6]/40")}>
            <b>{judged.text}</b>
            {judged.askFor && (
              <button className="govuk-link flex items-center gap-1 self-start" onClick={async () => {
                const msg = `Hi, for a ${size} kW rooftop system in Delhi the typical market price is ${lakh(judged.askFor)} before subsidy. Can you match ${lakh(judged.askFor)}?`
                try { await navigator.clipboard.writeText(msg); toast("Message copied") } catch { toast.error("Couldn't copy") }
              }}><Copy className="size-4" />Copy a message for the installer</button>
            )}
          </div>
        ) : (
          <p className="text-[var(--govuk-secondary-text)]">Enter a quote to see where it sits against Delhi prices.</p>
        )}

        {/* what overpaying does: same home, fair price vs this quote */}
        {h.quote && fair && quoted && quoted.paid.you_pay !== fair.paid.you_pay && (
          <QuoteImpact fair={fair.paid} quoted={quoted.paid} quote={h.quote} />
        )}

        {priced && priced.paid.price > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold">Who pays the {lakh(priced.paid.price)}</span>
            <CostSplit price={priced.paid.price} central={priced.paid.central_subsidy} delhi={priced.paid.delhi_subsidy} youPay={priced.paid.you_pay} />
          </div>
        )}
      </section>

      {/* 2 · Cash or loan? */}
      <section className="flex flex-col gap-4 border bg-white p-5">
        <CardTitle>2. Pay cash or take the loan?</CardTitle>
        {!priced ? <Skeleton className="h-56" /> : priced.paid.you_pay === 0 ? (
          <p>The subsidies cover the whole price, so there's nothing to pay or borrow.</p>
        ) : !priced.loan_applies || !priced.paid.loan_cumulative ? (
          <p>The {rate} scheme loan is for systems up to 3 kW. For {size} kW, compare a bank loan with paying {rupees(priced.paid.you_pay)} in cash.</p>
        ) : (
          <CashOrLoan o={priced.paid} rate={rate} />
        )}
      </section>

      {/* 3 · Next steps */}
      <section className="flex flex-col gap-4 border bg-white p-5">
        <CardTitle>3. Next steps</CardTitle>
        <ol className="flex flex-col gap-4">
          <Step n={1} title="Get two or three quotes">
            <span className="text-[var(--govuk-secondary-text)]">From installers registered with {h.disco}. Check each one above.</span>
          </Step>
          <Step n={2} title="Apply on the Delhi Solar Portal">
            <span className="text-[var(--govuk-secondary-text)]">With your electricity account number. Subsidy is claimed through the portal.</span>
            <Button asChild className="self-start"><a href={PORTAL} target="_blank" rel="noopener noreferrer">Apply on the portal <ExternalLink /></a></Button>
          </Step>
          <Step n={3} title="Watch for price and rate changes">
            <span className="text-[var(--govuk-secondary-text)]">We'll tell you if prices for {size} kW drop or the loan rate changes.</span>
            <Button variant="secondary" className="self-start" onClick={() => navigate("alerts")}>Set up alerts</Button>
          </Step>
        </ol>
      </section>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-3">
      <span className="grid size-8 place-items-center rounded-full bg-[var(--govuk-blue)] font-bold text-white">{n}</span>
      <div className="flex flex-col gap-1.5"><b>{title}</b>{children}</div>
    </li>
  )
}

/** Same home at the fair price and at this quote, on the three numbers the quote changes. */
function QuoteImpact({ fair, quoted, quote }: { fair: Outcome; quoted: Outcome; quote: number }) {
  const over = quote > fair.price
  const mine = over ? "#d4351c" : "#1d70b8"
  const pair = (f: number, q: number, show: (v: number) => string) => [
    { label: "Fair price", value: Math.max(0, f), display: show(f), color: "#00703c" },
    { label: "Your quote", value: Math.max(0, q), display: show(q), color: mine },
  ]
  const groups = [
    { title: "You pay after subsidy", rows: pair(fair.you_pay, quoted.you_pay, rupees) },
    { title: "Years to pay back", rows: pair(fair.payback_years ?? 0, quoted.payback_years ?? 0, (v) => (v ? v.toFixed(1) : "never")) },
    { title: "Gain over 25 years", rows: pair(fair.lifetime_gain ?? 0, quoted.lifetime_gain ?? 0, (v) => lakh(v)) },
  ]
  return (
    <div className="flex flex-col gap-3">
      <span className="font-semibold">
        What {over ? "the extra" : "saving"} <span style={{ color: mine }}>{rupees(Math.abs(quote - fair.price))}</span> does
      </span>
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--govuk-secondary-text)]">{g.title}</span>
            <BarList size="lg" labelWidth="5.5rem" rows={g.rows} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CashOrLoan({ o, rate }: { o: Outcome; rate: string }) {
  const loan = o.loan_cumulative!
  const cashEnd = o.cumulative[o.cumulative.length - 1].value
  const loanEnd = loan[loan.length - 1].value
  const saving = o.saving_year1 / 12
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Option title="Cash" color="var(--govuk-green)" figures={[
          { label: "Up front", value: rupees(o.you_pay) },
          { label: "Monthly", value: "₹0" },
          { label: "Paid back", value: years(o.payback_years) },
        ]} />
        <Option title={`Loan at ${rate}`} color="var(--govuk-blue)" figures={[
          { label: "Up front", value: "₹0" },
          { label: "EMI, 10 years", value: rupees(o.emi_month) },
          { label: "Interest", value: rupees(cashEnd - loanEnd) },
        ]} />
      </div>
      <PaybackCurve className="h-48" series={[
        { key: "cash", label: "Cash", color: "#00703c", points: o.cumulative },
        { key: "loan", label: "Loan", color: "#1d70b8", points: loan },
      ]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold">In hand after 25 years</span>
          <BarList labelWidth="3.5rem" rows={[
            { label: "Cash", value: Math.max(0, cashEnd), display: lakh(cashEnd), color: "#00703c" },
            { label: "Loan", value: Math.max(0, loanEnd), display: lakh(loanEnd), color: "#1d70b8" },
          ]} />
        </div>
        {o.emi_month ? (
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold">Each month while the loan runs</span>
            <BarList labelWidth="3.5rem" rows={[
              { label: "Saving", value: saving, display: rupees(saving), color: "#00703c" },
              { label: "EMI", value: o.emi_month, display: rupees(o.emi_month), color: "#b1b4b6" },
            ]} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Option({ title, color, figures }: { title: string; color: string; figures: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-col gap-2 border-t-4 bg-[var(--govuk-light-grey)] p-3" style={{ borderColor: color }}>
      <b>{title}</b>
      <div className="grid grid-cols-3 gap-2">
        {figures.map((f) => (
          <div key={f.label} className="flex min-w-0 flex-col">
            <span className="text-xs text-[var(--govuk-secondary-text)]">{f.label}</span>
            <b className="tabular-nums">{f.value}</b>
          </div>
        ))}
      </div>
    </div>
  )
}
