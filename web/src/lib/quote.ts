import type { PriceLadder } from "@/lib/api"
import { lakh } from "@/lib/format"

export type QuoteVerdict = { tone: "good" | "warn" | "bad"; text: string; askFor: number | null }

/** Where an installer's quote sits against the market range for its size. */
export function judgeQuote(quote: number, ladder: PriceLadder): QuoteVerdict {
  const low = ladder.market_low?.total
  const high = ladder.market_high?.total
  const median = ladder.market_median?.total ?? null
  if (median == null) {
    const bench = ladder.benchmark?.total
    return {
      tone: "warn",
      text: `We have no market prices for ${ladder.size_kw} kW yet. The government benchmark is ${lakh(bench)}.`,
      askFor: null,
    }
  }
  if (low != null && quote < low)
    return { tone: "warn", text: "That's below every price we've seen. Check it uses DCR panels and includes 5 years of maintenance.", askFor: null }
  if (high != null && quote > high)
    return { tone: "bad", text: `That's above every price we've seen. Ask for about ${lakh(median)}.`, askFor: median }
  if (quote > median) return { tone: "warn", text: `That's on the high side. Ask for about ${lakh(median)}.`, askFor: median }
  return { tone: "good", text: `That's a fair price: at or below the typical ${lakh(median)}.`, askFor: null }
}
