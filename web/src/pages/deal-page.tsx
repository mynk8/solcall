import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { CardTitle, Missing, SourceTag, Stat } from "@/components/bits"
import { PriceLadder } from "@/components/price-ladder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAnswer, useApp } from "@/lib/app-context"
import { lakh, rupees } from "@/lib/format"
import { judgeQuote } from "@/lib/quote"
import { cn } from "@/lib/utils"

const PORTAL = "https://solar.delhi.gov.in"
const QUOTE_SIZES = [1, 2, 3, 4, 5, 10]

export function DealPage() {
  const { household: h, update, navigate, ladders, today } = useApp()
  const { answer } = useAnswer({ units: h.units, load: h.load, size: h.size })
  const freeOk = !!answer?.free_eligible
  const tab = h.dealTab ?? (answer ? (freeOk ? "free" : "paid") : "paid")

  const [quoteDraft, setQuoteDraft] = useState(h.quote ? String(h.quote) : "")
  useEffect(() => {
    const t = setTimeout(() => update({ quote: +quoteDraft >= 10_000 ? +quoteDraft : null }), 300)
    return () => clearTimeout(t)
  }, [quoteDraft, update])

  const ladder = ladders.get(h.quoteSize)
  const judged = h.quote && ladder ? judgeQuote(h.quote, ladder) : null
  // the answer for the quoted size at the quoted price, for the subsidy and loan cards
  const { answer: priced } = useAnswer({ units: h.units, load: Math.max(h.load, h.quoteSize), size: h.quoteSize, quote: h.quote })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-tight font-bold">Get a fair deal</h1>
        <p className="text-sm text-muted-foreground">
          For {h.size} kW · {h.units} units/month · {h.load} kW load · {h.disco}{" "}
          <button className="govuk-link" onClick={() => navigate("check")}>change</button>
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => update({ dealTab: v as "paid" | "free" })} className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="paid">Paid route (installer + subsidy)</TabsTrigger>
          <TabsTrigger value="free">Free route{freeOk ? " · you qualify" : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="paid" className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="flex flex-col gap-3 rounded-[2px] border bg-white p-5">
              <CardTitle source="Compared with the Delhi reference price">Check an installer's quote</CardTitle>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm text-muted-foreground">
                  Quote before subsidy (₹)
                  <Input inputMode="numeric" placeholder="e.g. 240000" value={quoteDraft} onChange={(e) => setQuoteDraft(e.target.value.replace(/\D/g, ""))} />
                </label>
                <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  Size
                  <ToggleGroup type="single" size="sm" variant="outline" value={String(h.quoteSize)} onValueChange={(v) => v && update({ quoteSize: +v })}>
                    {QUOTE_SIZES.map((k) => <ToggleGroupItem key={k} value={String(k)}>{k}</ToggleGroupItem>)}
                  </ToggleGroup>
                </div>
              </div>
              <div className="border p-4">
                <span className="text-sm text-muted-foreground">Price ladder for {h.quoteSize} kW{h.quote ? ", with your quote in red" : ""}</span>
                {ladder ? <PriceLadder ladder={ladder} quote={h.quote} /> : <Skeleton className="h-12" />}
              </div>
              {judged ? (
                <div className={cn("govuk-inset flex flex-col gap-1.5",
                  judged.tone === "good" ? "border-[var(--govuk-green)] bg-[#cce2d8]/40" : judged.tone === "warn" ? "border-[var(--govuk-orange)] bg-[#fcd6c3]/30" : "border-[var(--govuk-red)] bg-[#f4cdc6]/40")}>
                  <b>{judged.text}</b>
                  {judged.askFor && (
                    <button className="self-start govuk-link" onClick={async () => {
                      const msg = `Hi, for a ${h.quoteSize} kW rooftop system in Delhi the typical market price is ${lakh(judged.askFor)} before subsidy. Can you match ${lakh(judged.askFor)}?`
                      try { await navigator.clipboard.writeText(msg); toast("Message copied") } catch { toast.error("Couldn't copy") }
                    }}>Copy message for installer</button>
                  )}
                </div>
              ) : <p className="text-sm text-muted-foreground">Enter a quote to see where it sits.</p>}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-[2px] border bg-white p-5">
                <CardTitle source="RBI repo rate + 0.50%, under PM Surya Ghar">Loan (scheme rate)</CardTitle>
                {h.quoteSize <= 3 ? (
                  priced ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Stat k="Rate" v={today?.rates ? `${today.rates.scheme_loan_pct.toFixed(2)}%` : "…"} />
                        <Stat k="EMI, 10 yrs" v={priced.paid.emi_month ? `${rupees(priced.paid.emi_month)}/mo` : "₹0"} />
                      </div>
                      {priced.paid.emi_cover && <span className="text-sm">Your saving covers the EMI <b>{priced.paid.emi_cover.toFixed(1)}×</b>.</span>}
                    </>
                  ) : <Skeleton className="h-20" />
                ) : (
                  <p className="govuk-inset border-[var(--govuk-orange)] bg-[#fcd6c3]/30 text-sm">The scheme loan rate applies up to 3 kW. Above that, use a normal bank loan or cash.</p>
                )}
              </div>
              <div className="flex flex-col gap-3 rounded-[2px] border bg-white p-5">
                <CardTitle source="Central (PM Surya Ghar) and Delhi subsidy">Subsidy you'll get back</CardTitle>
                {priced ? (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex flex-col"><span className="text-sm text-muted-foreground">Central</span><b className="tabular-nums">{rupees(priced.paid.central_subsidy)}</b></div>
                    <div className="flex flex-col"><span className="text-sm text-muted-foreground">Delhi</span><b className="tabular-nums">{rupees(priced.paid.delhi_subsidy)}</b></div>
                    <div className="flex flex-col"><span className="text-sm text-muted-foreground">You pay</span><b className="tabular-nums">{rupees(priced.paid.you_pay)}</b></div>
                  </div>
                ) : <Skeleton className="h-12" />}
                {priced && <SourceTag tier="govt">at {lakh(priced.paid.price)} · {priced.price_basis}</SourceTag>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[2px] border bg-white p-5">
            <h2 className="text-lg font-bold">Registered vendors</h2>
            <Missing what="registered vendor list">Empanelled installers for {h.disco} (name, rating, DCR panels, phone). Until then, use the portal's vendor list.</Missing>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild><a href={PORTAL} target="_blank" rel="noopener noreferrer">Apply on the Delhi Solar Portal <ExternalLink /></a></Button>
            <Button variant="outline" onClick={() => navigate("alerts")}>Alert me if prices drop</Button>
          </div>
        </TabsContent>

        <TabsContent value="free" className="flex flex-col gap-4">
          {answer ? (
            freeOk
              ? <p className="govuk-inset border-[var(--govuk-blue)] bg-[#bbd4ea]/30">You qualify: average use ≤ 400 units a month and system ≤ 3 kW.</p>
              : <p className="govuk-inset border-[var(--govuk-orange)] bg-[#fcd6c3]/30 text-sm">You don't qualify (needs ≤ 400 units a month and ≤ 3 kW). <button className="underline" onClick={() => update({ dealTab: "paid" })}>See the paid route</button></p>
          ) : <Skeleton className="h-10" />}
          {answer && !answer.free_operational && (
            <p className="flex items-center gap-2 govuk-inset border-[var(--govuk-orange)] bg-[#fcd6c3]/30 text-sm">The free scheme isn't open yet. We'll tell you when it opens. <SourceTag tier="verify">VERIFY</SourceTag></p>
          )}
          <div className="flex flex-col gap-3 rounded-[2px] border bg-white p-5">
            <h2 className="text-lg font-bold">How to apply (3 steps)</h2>
            {[
              ["1. Register on the Delhi Solar Portal", "With your electricity account number and a recent bill."],
              ["2. DISCOM site check", "Your DISCOM confirms the roof and your sanctioned load."],
              ["3. Installation and net meter", "The installer fits the system; the DISCOM installs the net meter."],
            ].map(([t, d]) => (
              <div key={t} className="flex flex-col gap-0.5 bg-[var(--govuk-light-grey)] p-4">
                <b className="text-sm">{t}</b><span className="text-sm text-muted-foreground">{d}</span>
              </div>
            ))}
            <Missing what="free-scheme step details">Official step list, documents needed and timelines once the scheme opens.</Missing>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild><a href={PORTAL} target="_blank" rel="noopener noreferrer">Go to the Delhi Solar Portal <ExternalLink /></a></Button>
            <Button variant="outline" onClick={() => navigate("alerts")}>Notify me when it opens</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
