import { useState } from "react"
import { ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

export type LegendItem = { color: string; label: string }
export type LegendScale = { from: string; to: string; min: string; max: string; label: string }

/**
 * Map legend that stays a small chip until hovered, focused or tapped, then grows in width and
 * height to show the full key: a vertical list for categories, or a colour scale for counts.
 */
export function MapLegend({ title, items, scale, className }: {
  title: string; items?: LegendItem[]; scale?: LegendScale; className?: string
}) {
  const [open, setOpen] = useState(false)
  const swatches = items?.map((i) => i.color) ?? (scale ? [scale.from, scale.to] : [])

  return (
    <div
      className={cn(
        "absolute bottom-3 left-3 z-10 overflow-hidden border bg-white shadow-lg transition-[max-width] duration-300 ease-out motion-reduce:transition-none",
        open ? "max-w-72" : "max-w-40",
        className,
      )}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      {/* expanding body: grid rows 0fr → 1fr animates height without measuring */}
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className={cn("flex w-64 flex-col gap-2 px-3 pt-3 transition-opacity duration-200", open ? "opacity-100 delay-100" : "opacity-0")}>
            <span className="font-bold">{title}</span>
            {items && (
              <ul className="flex flex-col gap-1.5">
                {items.map((i) => (
                  <li key={i.label} className="flex items-center gap-2">
                    <span className="size-4 shrink-0 border border-black/20" style={{ background: i.color }} />
                    {i.label}
                  </li>
                ))}
              </ul>
            )}
            {scale && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-[var(--govuk-secondary-text)]">{scale.label}</span>
                <div className="h-3 w-full border border-black/20" style={{ background: `linear-gradient(to right, ${scale.from}, ${scale.to})` }} />
                <div className="flex justify-between text-sm tabular-nums"><span>{scale.min}</span><span>{scale.max}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* always-visible chip; also the tap target on touch screens */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold whitespace-nowrap">
        Legend
        <span className="flex gap-0.5" aria-hidden>
          {swatches.map((c, i) => <span key={i} className="size-3 border border-black/20" style={{ background: c }} />)}
        </span>
        <ChevronUp className={cn("ml-auto size-4 transition-transform duration-300", !open && "rotate-180")} />
      </button>
    </div>
  )
}

/** Linear blend between two hex colours, t in [0, 1]. */
export function blend(from: string, to: string, t: number) {
  const a = from.match(/\w\w/g)!.map((h) => parseInt(h, 16))
  const b = to.match(/\w\w/g)!.map((h) => parseInt(h, 16))
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, Math.max(0, t))).toString(16).padStart(2, "0")).join("")}`
}
