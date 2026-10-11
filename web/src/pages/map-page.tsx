import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { CardTitle, Missing, VerdictPill } from "@/components/bits"
import { PriceLadder } from "@/components/price-ladder"
import { ScopeFilter } from "@/components/scope-filter"
import { Button } from "@/components/ui/button"
import { Map as MapView, MapControls, MapMarker, MarkerContent, MarkerTooltip, useMap } from "@/components/ui/map"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, type Verdict } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { lakh, lakhRange } from "@/lib/format"
import { DISCOM_CENTRES, SAMPLE_ROOFS, shadeLabel, type Discom, type RoofCandidate } from "@/lib/roofs"
import { useIsMobile } from "@/lib/use-mobile"
import { cn } from "@/lib/utils"

const DELHI: [number, number] = [77.15, 28.64]

export function MapPage() {
  const { household, navigate, update, scope, setScope, openCommand } = useApp()
  const [layer, setLayer] = useState<"fit" | "apps">("fit")
  const [sheet, setSheet] = useState<{ kind: "roof" } | { kind: "discom"; id: Discom } | null>(household.roof ? { kind: "roof" } : null)
  const roof = useMemo(() => SAMPLE_ROOFS.find((r) => r.id === household.roof) ?? null, [household.roof])
  const roofs = SAMPLE_ROOFS.filter((r) => scope === "Everywhere" || r.discom === scope)

  const pick = (r: RoofCandidate) => { update({ roof: r.id, disco: r.discom }); setSheet({ kind: "roof" }) }

  return (
    <div className="relative h-full">
      <MapView center={DELHI} zoom={10.4} theme="light" className="absolute inset-0">
        <MapControls position="bottom-right" showZoom showLocate />
        <FlyTo roof={sheet?.kind === "roof" ? roof : null} />
        {layer === "fit"
          ? roofs.map((r) => (
              <MapMarker key={r.id} longitude={r.longitude} latitude={r.latitude} onClick={() => pick(r)}>
                <MarkerContent>
                  <button aria-label={`Roof ${r.id} in ${r.area}, fits ${r.fitKw} kW`}
                    className={cn("rounded-md border-2 border-card px-1.5 py-0.5 text-sm text-muted-foreground shadow-md",
                      r.id === roof?.id ? "bg-primary text-primary-foreground" : FIT_COLOR[r.shade])}>
                    {r.id}
                  </button>
                </MarkerContent>
                <MarkerTooltip>{r.area} · fits {r.fitKw} kW</MarkerTooltip>
              </MapMarker>
            ))
          : <DiscomCircles onPick={(id) => setSheet({ kind: "discom", id })} />}
      </MapView>

      {/* search + layers */}
      <div className="absolute top-3 left-3 z-10 flex w-[min(320px,calc(100%-24px))] flex-col gap-2 rounded-[2px] border bg-white p-3 shadow-lg">
        <button onClick={openCommand} className="flex items-center justify-between gap-2 rounded-md border bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-2 whitespace-nowrap"><Search className="size-4" />Search a place</span>
          <kbd className="rounded border bg-card px-1 text-sm text-muted-foreground">Ctrl K</kbd>
        </button>
        <ToggleGroup type="single" size="sm" variant="outline" value={layer} onValueChange={(v) => v && setLayer(v as typeof layer)}>
          <ToggleGroupItem value="fit">Solar fit (roofs)</ToggleGroupItem>
          <ToggleGroupItem value="apps">Applications</ToggleGroupItem>
        </ToggleGroup>
        <ScopeFilter compact />
      </div>

      {/* legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-[2px] border bg-white px-3 py-2 text-sm shadow-lg">
        <b>Legend</b>
        {layer === "fit" ? (
          <span className="flex flex-wrap gap-x-3 text-muted-foreground">
            <span><i className="mr-1 inline-block size-3 bg-[var(--govuk-green)]" />good fit</span>
            <span><i className="mr-1 inline-block size-3 bg-[var(--govuk-orange)]" />some shade</span>
            <span><i className="mr-1 inline-block size-3 bg-[var(--govuk-secondary-text)]" />poor</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Circle size = homes that have applied</span>
        )}
      </div>

      {/* hint */}
      <div className="absolute top-3 right-3 z-10 hidden max-w-60 flex-col gap-1 rounded-[2px] border bg-white px-3 py-2 text-sm shadow-lg sm:flex">
        <span>{layer === "fit" ? "Click a roof to see what fits and what it costs." : "Click a DISCOM for its application count."}</span>
        <span className="text-sm text-[var(--govuk-secondary-text)]">Sample roofs until the real roof data arrives.</span>
      </div>

      <RoofSheet roof={sheet?.kind === "roof" ? roof : null} onClose={() => setSheet(null)}
        onCheck={(r) => {
          const load = r.fitKw > household.load ? ([2, 3, 5, 7].find((l) => l >= r.fitKw) ?? 7) : household.load
          setSheet(null)
          navigate("check", { roof: r.id, size: Math.min(r.fitKw, load), load, disco: r.discom })
        }} />
      <DiscomSheet id={sheet?.kind === "discom" ? sheet.id : null} onClose={() => setSheet(null)}
        onShowRoofs={(d) => { setScope(d); setLayer("fit"); setSheet(null) }} onAlerts={() => navigate("alerts")} />
    </div>
  )
}

const FIT_COLOR: Record<RoofCandidate["shade"], string> = {
  none: "bg-[var(--govuk-green)] text-white",
  light: "bg-[var(--govuk-orange)] text-black",
  heavy: "bg-[var(--govuk-secondary-text)] text-white",
}

function DiscomCircles({ onPick }: { onPick: (d: Discom) => void }) {
  const { today, scope } = useApp()
  return (
    <>
      {today?.applications.by_discom.filter((d) => scope === "Everywhere" || d.discom === scope).map((d) => {
        const c = DISCOM_CENTRES[d.discom as Discom]
        if (!c) return null
        const size = 60 + Math.sqrt(d.total) / 2
        return (
          <MapMarker key={d.discom} longitude={c.longitude} latitude={c.latitude} onClick={() => onPick(d.discom as Discom)}>
            <MarkerContent>
              <button className="grid place-items-center rounded-full border-2 border-dashed border-foreground/70 bg-[#bbd4ea]/70 text-center text-sm font-bold backdrop-blur-[1px]"
                style={{ width: size, height: size }}>
                {d.total.toLocaleString("en-IN")}<span className="text-[10px] font-normal">{d.discom}</span>
              </button>
            </MarkerContent>
          </MapMarker>
        )
      })}
    </>
  )
}

function FlyTo({ roof }: { roof: RoofCandidate | null }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded || !roof) return
    const desktop = window.matchMedia("(min-width: 768px)").matches
    map.easeTo({
      center: [roof.longitude, roof.latitude],
      zoom: Math.max(map.getZoom(), 11),
      padding: desktop ? { right: 400, left: 0, top: 0, bottom: 0 } : { bottom: 380, top: 0, left: 0, right: 0 },
      duration: 700,
    })
  }, [map, isLoaded, roof])
  return null
}

// ---------------------------------------------------------------- roof sheet

const BANDS = [
  { label: "0–200", units: 150 },
  { label: "201–400", units: 300 },
  { label: "400+", units: 500 },
]

function RoofSheet({ roof, onClose, onCheck }: { roof: RoofCandidate | null; onClose: () => void; onCheck: (r: RoofCandidate) => void }) {
  const { ladders, household, divisions } = useApp()
  const mobile = useIsMobile()
  const [bands, setBands] = useState<(Verdict | null)[]>([null, null, null])

  const load = roof ? ([2, 3, 5, 7].find((l) => l >= Math.max(roof.fitKw, household.load)) ?? 7) : 3
  useEffect(() => {
    if (!roof) return
    setBands([null, null, null])
    let alive = true
    Promise.all(BANDS.map((b) => api.answer({ units: b.units, load, size: roof.fitKw })))
      .then((rs) => alive && setBands(rs.map((a) => (a.free_eligible ? "GO_FREE" : a.paid.verdict))))
      .catch(() => {})
    return () => { alive = false }
  }, [roof, load])

  const ladder = roof ? ladders.get(roof.fitKw) : undefined
  const division = roof?.division ? divisions?.find((d) => d.division === roof.division) : undefined

  return (
    <Sheet open={!!roof} onOpenChange={(o) => !o && onClose()} modal={false}>
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-0 p-0", mobile ? "max-h-[80dvh]" : "w-[380px] sm:max-w-[380px]")}
        onInteractOutside={(e) => e.preventDefault()} onOpenAutoFocus={(e) => e.preventDefault()}>
        {roof && (
          <>
            <SheetHeader className="border-b">
              <span className="text-sm text-muted-foreground">{roof.area} · {roof.discom}</span>
              <SheetTitle className="text-2xl font-bold">{roof.fitKw} kW fits</SheetTitle>
              <SheetDescription className="text-base text-foreground">{shadeLabel(roof.shade)}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
              {/* Fair price: one number, the ladder, one supporting line */}
              <section className="flex flex-col gap-1">
                <span className="text-muted-foreground">Fair price</span>
                {ladder ? (
                  <>
                    <span className="text-3xl font-bold tabular-nums">
                      {ladder.market_low ? lakhRange(ladder.market_low.total, ladder.market_high?.total) : lakh(ladder.benchmark?.total)}
                    </span>
                    <span className="text-sm text-muted-foreground">before subsidy</span>
                    <PriceLadder ladder={ladder} className="mt-1" />
                  </>
                ) : <Skeleton className="h-16" />}
              </section>

              {/* Worth it: a 3-column strip, usage on top, answer below */}
              <section className="flex flex-col gap-2">
                <span className="text-muted-foreground">Worth it? <span className="text-sm">(by units used a month)</span></span>
                <div className="grid grid-cols-3 border">
                  {BANDS.map((b, i) => (
                    <div key={b.label} className="flex flex-col items-center gap-2 border-r px-1 py-3 last:border-r-0">
                      <span className="font-bold tabular-nums">{b.label}</span>
                      {bands[i] ? <VerdictPill v={bands[i]!} /> : <Skeleton className="h-6 w-16" />}
                    </div>
                  ))}
                </div>
              </section>

              {/* Neighbours */}
              <section className="flex flex-col gap-1">
                <span className="text-muted-foreground">Neighbours</span>
                {division ? (
                  <span><b className="text-lg tabular-nums">{division.applications.toLocaleString("en-IN")}</b> homes in {division.division} applied</span>
                ) : (
                  <Missing what="roof → division mapping">Which division this roof is in.</Missing>
                )}
              </section>
            </div>
            <SheetFooter className="flex-row border-t">
              <Button className="flex-1" onClick={() => onCheck(roof)}>Check with my bill</Button>
              <Button variant="outline" onClick={async () => {
                try { await navigator.clipboard.writeText(`${location.origin}/map?roof=${roof.id}`); toast("Roof link copied") } catch { toast.error("Couldn't copy") }
              }}>Share</Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------- DISCOM sheet (applications layer)

function DiscomSheet({ id, onClose, onShowRoofs, onAlerts }: {
  id: Discom | null; onClose: () => void; onShowRoofs: (d: Discom) => void; onAlerts: () => void
}) {
  const { today, divisions } = useApp()
  const mobile = useIsMobile()
  const row = today?.applications.by_discom.find((d) => d.discom === id)
  const top = (divisions ?? []).filter((d) => d.discom === id).sort((a, b) => a.rank - b.rank).slice(0, 6)
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()} modal={false}>
      <SheetContent side={mobile ? "bottom" : "right"} className={cn("gap-0 p-0", mobile ? "max-h-[80dvh]" : "w-[380px] sm:max-w-[380px]")}
        onInteractOutside={(e) => e.preventDefault()} onOpenAutoFocus={(e) => e.preventDefault()}>
        {id && (
          <>
            <SheetHeader className="border-b">
              <span className="text-sm text-muted-foreground">DISCOM</span>
              <SheetTitle className="text-lg">{DISCOM_CENTRES[id].name}</SheetTitle>
              <SheetDescription>{row ? `${row.total.toLocaleString("en-IN")} homes have applied` : "…"}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              <section className="flex flex-col gap-2 border-t pt-4">
                <CardTitle source={<>Source: Delhi Solar Portal</>}>Top divisions</CardTitle>
                {top.map((d) => (
                  <div key={d.division} className="flex justify-between text-sm tabular-nums">
                    <span>{d.rank}. {d.division}</span>
                    <span>{d.applications.toLocaleString("en-IN")} · {(d.share * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </section>
              <Missing what="division boundaries">Division shapes on the map (circles are drawn per DISCOM at approximate centres until these exist).</Missing>
              <Missing what="change since last snapshot">Needs a stored previous snapshot of the applications feed to show “+n this week”.</Missing>
            </div>
            <SheetFooter className="flex-row border-t">
              <Button className="flex-1" onClick={() => onShowRoofs(id)}>Show roofs here</Button>
              <Button variant="outline" onClick={onAlerts}>Alert me at milestones</Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
