import type { PriceLadder as Ladder } from "@/lib/api"
import { lakh } from "@/lib/format"
import { cn } from "@/lib/utils"

const short = (v: number) => lakh(v).replace(" lakh", "L")

// zone colours match the quote verdict tones
const ZONES = { below: "#dee0e2", fair: "#8fcfb0", high: "#f9b98f", above: "#ee9a8d" }

/**
 * One size's prices as a gauge: below any price seen, fair (lowest to typical), high side
 * (typical to highest), above market. The govt benchmark and the quote are marked on it.
 * `compact` is for small tiles: only the lowest and highest prices are labelled.
 */
export function PriceLadder({ ladder, quote, className, compact }: { ladder: Ladder; quote?: number | null; className?: string; compact?: boolean }) {
  const low = ladder.market_low?.total, high = ladder.market_high?.total
  const median = ladder.market_median?.total, bench = ladder.benchmark?.total
  const market = low != null && high != null && median != null
  // with market prices the scale follows them (and the quote); the benchmark is only drawn if it falls inside
  const values = (market ? [low, high, quote ?? undefined] : [bench, quote ?? undefined]).filter((v): v is number => v != null)
  if (!values.length) return null
  const min = Math.min(...values) * 0.9, max = Math.max(...values) * 1.08
  const at = (v: number) => ((v - min) / (max - min)) * 100
  const benchIn = bench != null && bench > min && bench < max

  const zones = market
    ? [
        { key: "below", from: min, to: low, label: "below market" },
        { key: "fair", from: low, to: median, label: "fair" },
        { key: "high", from: median, to: high, label: "high side" },
        { key: "above", from: high, to: max, label: "too high" },
      ].filter((z) => z.to > z.from)
    : [{ key: "below", from: min, to: max, label: "" }]

  // labels under the track, staggered on two lines so neighbours don't collide
  const ticks = [
    bench != null && !market && { v: bench, text: `govt ${short(bench)} · no market prices yet`, line: 0 },
    bench != null && market && { v: benchIn ? bench : min, text: `${benchIn ? "" : "← "}govt ${short(bench)}`, line: benchIn ? 0 : 1 },
    market && { v: low, text: `lowest ${short(low)}`, line: 0 },
    market && { v: median, text: `typical ${short(median)}`, line: 1 },
    market && high !== low && { v: high, text: `highest ${short(high)}`, line: 0 },
  ].filter((t): t is { v: number; text: string; line: number } => !!t)
    .filter((t) => !compact || !market || /^(lowest|highest)/.test(t.text))

  return (
    <div className={cn("flex select-none flex-col", className)} role="img"
      aria-label={`Govt benchmark ${lakh(bench)}${market ? `; market ${lakh(low)} to ${lakh(high)}, typical ${lakh(median)}` : ""}${quote ? `; your quote ${lakh(quote)}` : ""}`}>
      {quote != null && (
        <div className="relative h-8">
          <span className="absolute bottom-1 -translate-x-1/2 rounded bg-[#0b0c0c] px-2 py-0.5 text-sm font-bold whitespace-nowrap text-white"
            style={{ left: `clamp(4rem, ${at(quote)}%, calc(100% - 4rem))` }}>Your quote {short(quote)}</span>
        </div>
      )}
      <div className="relative h-7">
        <div className="absolute inset-0 flex gap-px overflow-hidden rounded-[3px]">
          {zones.map((z) => (
            <div key={z.key} className="flex items-center justify-center overflow-hidden text-xs font-semibold whitespace-nowrap text-[#0b0c0c]/80"
              style={{ width: `${at(z.to) - at(z.from)}%`, background: ZONES[z.key as keyof typeof ZONES] }}>
              <span className="px-1">{at(z.to) - at(z.from) > (compact ? 30 : 11) ? z.label : ""}</span>
            </div>
          ))}
        </div>
        {bench != null && (benchIn || !market) && <i className="absolute inset-y-0 border-l-2 border-dashed border-[#0b0c0c]" style={{ left: `${at(bench)}%` }} />}
        {market && <i className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[#0b0c0c]/60" style={{ left: `${at(median)}%` }} />}
        {quote != null && (
          <i className="absolute -inset-y-1.5 w-1 -translate-x-1/2 rounded bg-[#0b0c0c] ring-2 ring-white" style={{ left: `${at(quote)}%` }} />
        )}
      </div>
      <div className={cn("relative text-[13px] text-[var(--govuk-secondary-text)] tabular-nums", compact ? "h-5" : "h-9")}>
        {ticks.map((t) => (
          <span key={t.text} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `clamp(${t.text.length * 0.23}rem, ${at(t.v)}%, calc(100% - ${t.text.length * 0.23}rem))`, top: t.line ? "1.1rem" : "0.1rem" }}>{t.text}</span>
        ))}
      </div>
    </div>
  )
}
