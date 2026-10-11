import type { PriceLadder as Ladder } from "@/lib/api"
import { lakh, lakhRange } from "@/lib/format"
import { cn } from "@/lib/utils"

/** One rail for one size: govt benchmark, market low–high band with its median, and an optional quote. */
export function PriceLadder({ ladder, quote, className }: { ladder: Ladder; quote?: number | null; className?: string }) {
  const values = [
    ladder.history?.total,
    ladder.benchmark?.total,
    ladder.market_low?.total,
    ladder.market_high?.total,
    quote ?? undefined,
  ].filter((v): v is number => v != null)
  if (!values.length) return null
  const min = Math.min(...values) * 0.92
  const max = Math.max(...values) * 1.06
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`

  const low = ladder.market_low?.total
  const high = ladder.market_high?.total
  const median = ladder.market_median?.total
  const bench = ladder.benchmark?.total

  return (
    <div className={cn("relative h-16 select-none", className)} role="img"
      aria-label={`Govt benchmark ${lakh(bench)}; market ${lakh(low)} to ${lakh(high)}${quote ? `; your quote ${lakh(quote)}` : ""}`}>
      <div className="absolute inset-x-0 top-3 h-1.5 bg-[var(--govuk-light-grey)]" />
      {low != null && high != null && (
        <div className="absolute top-2 h-3.5 border-2 border-[var(--govuk-blue)] bg-[#bbd4ea]"
          style={{ left: pos(low), width: `calc(${pos(high)} - ${pos(low)} + 2px)` }} />
      )}
      {median != null && <Tick at={pos(median)} className="w-1 bg-[var(--govuk-dark-blue)]" />}
      {bench != null && <Tick at={pos(bench)} className="w-1 bg-[#0b0c0c]" />}
      {quote != null && <Tick at={pos(quote)} className="-top-0 h-7 w-1 bg-[var(--govuk-red)]" />}

      {bench != null && <Label at={pos(bench)}>govt {lakh(bench)}</Label>}
      {low != null && high != null && (
        <Label at={pos((low + high) / 2)}>
          market {lakhRange(low, high)}
        </Label>
      )}
    </div>
  )
}

function Tick({ at, className }: { at: string; className?: string }) {
  return <div className={cn("absolute top-1 h-5 w-0.5 -translate-x-1/2 rounded", className)} style={{ left: at }} />
}

function Label({ at, children }: { at: string; children: React.ReactNode }) {
  // clamp so labels near either end don't spill outside the panel
  const left = `clamp(3.5rem, ${at}, calc(100% - 3.5rem))`
  return (
    <span className="absolute top-8 -translate-x-1/2 text-[13px] whitespace-nowrap text-[var(--govuk-secondary-text)] tabular-nums" style={{ left }}>
      {children}
    </span>
  )
}
