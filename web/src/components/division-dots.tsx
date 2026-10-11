import { useState } from "react"

import { MapMarker, MapPopup, MarkerContent } from "@/components/ui/map"
import type { Division } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { DIVISION_POINTS } from "@/lib/roofs"
import { cn } from "@/lib/utils"

// Homes applied per division, binned on one blue ramp (light = few, dark = many)
export const APPS_BINS = [
  { from: 0, label: "0", color: "#d2e2f1" },
  { from: 250, label: "250", color: "#a3c4e4" },
  { from: 500, label: "500", color: "#6fa2d4" },
  { from: 1000, label: "1k", color: "#3d7fc0" },
  { from: 2500, label: "2.5k", color: "#1d5a9c" },
  { from: 5000, label: ">5k", color: "#003078" },
]

export const appsColor = (n: number) => APPS_BINS.reduce((c, b) => (n >= b.from ? b.color : c), APPS_BINS[0].color)

/** Horizontal colour key for the applications scale. */
export function AppsScale({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-6", className)}>
      {APPS_BINS.map((b) => <div key={b.from} className="h-3.5" style={{ background: b.color }} />)}
      {APPS_BINS.map((b) => <span key={b.from} className="pt-1 text-center text-xs tabular-nums">{b.label}</span>)}
    </div>
  )
}

/** One dot per division, coloured by homes applied. Hover shows the figures; click picks it. */
export function DivisionDots({ onPick, selected, small }: { onPick?: (d: Division) => void; selected?: string | null; small?: boolean }) {
  const { divisions, scope } = useApp()
  const [hover, setHover] = useState<Division | null>(null)
  const shown = (divisions ?? []).filter((d) => DIVISION_POINTS[d.division] && (scope === "Everywhere" || d.discom === scope))
  // draw small counts first so the busiest divisions sit on top
  const ordered = [...shown].sort((a, b) => a.applications - b.applications)
  const at = hover ? DIVISION_POINTS[hover.division] : null
  return (
    <>
      {ordered.map((d) => {
        const p = DIVISION_POINTS[d.division]
        const size = (small ? 9 : 12) + Math.sqrt(d.applications) / (small ? 9 : 6)
        return (
          <MapMarker key={d.division} longitude={p.longitude} latitude={p.latitude} onClick={() => onPick?.(d)}
            onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover((h) => (h === d ? null : h))}>
            <MarkerContent>
              <button aria-label={`${p.name}, ${d.discom}: ${d.applications.toLocaleString("en-IN")} homes applied`}
                className={cn("block rounded-full border border-[#0b0c0c]/50 transition-transform hover:scale-125",
                  selected === d.division && "ring-2 ring-[#0b0c0c] ring-offset-2")}
                style={{ width: size, height: size, background: appsColor(d.applications) }} />
            </MarkerContent>
          </MapMarker>
        )
      })}
      {hover && at && (
        <MapPopup longitude={at.longitude} latitude={at.latitude} offset={14} closeOnClick={false} className="pointer-events-none rounded-lg border bg-white p-3 shadow-lg">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <b>{at.name}</b>
              <span className="rounded bg-[var(--govuk-light-grey)] px-1.5 py-0.5 text-[11px] font-semibold">{hover.discom}</span>
            </div>
            <div className="grid grid-cols-3 gap-x-4 text-sm">
              <span className="text-[var(--govuk-secondary-text)]">Applied</span>
              <span className="text-[var(--govuk-secondary-text)]">Share</span>
              <span className="text-[var(--govuk-secondary-text)]">Rank</span>
              <b className="tabular-nums">{hover.applications.toLocaleString("en-IN")}</b>
              <b className="tabular-nums">{(hover.share * 100).toFixed(1)}%</b>
              <b className="tabular-nums">#{hover.rank}</b>
            </div>
          </div>
        </MapPopup>
      )}
    </>
  )
}
