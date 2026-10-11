import { useEffect, useMemo, useState } from "react"
import { Search, Sun, Zap, Info } from "lucide-react"
import { toast } from "sonner"

import { CardTitle, Missing, VerdictPill } from "@/components/bits"
import { PriceLadder } from "@/components/price-ladder"
import { ScopeFilter } from "@/components/scope-filter"
import { Button } from "@/components/ui/button"
import { Map as MapView, MapControls, MapMarker, MarkerContent, MarkerTooltip, MapGeoJSON, useMap } from "@/components/ui/map"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, type Verdict } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { lakh, lakhRange } from "@/lib/format"
import { DISCOM_CENTRES, SAMPLE_ROOFS, shadeLabel, type Discom, type RoofCandidate } from "@/lib/roofs"
import { FEASIBLE_SOLAR_REGIONS, type FeasibleSolarRegion } from "@/lib/regions"
import { useIsMobile } from "@/lib/use-mobile"
import { cn } from "@/lib/utils"

const DELHI: [number, number] = [77.15, 28.64]

export function MapPage() {
  const { household, navigate, update, scope, setScope, openCommand } = useApp()
  const [layer, setLayer] = useState<"fit" | "apps" | "regions">("fit")
  const [selectedRegionId, setSelectedRegionId] = useState<string>("delhi-ncr")
  const [sheet, setSheet] = useState<
    | { kind: "roof" }
    | { kind: "discom"; id: Discom }
    | { kind: "region"; region: FeasibleSolarRegion }
    | null
  >(household.roof ? { kind: "roof" } : null)

  const roof = useMemo(() => SAMPLE_ROOFS.find((r) => r.id === household.roof) ?? null, [household.roof])
  const roofs = SAMPLE_ROOFS.filter((r) => scope === "Everywhere" || r.discom === scope)
  const selectedRegion = useMemo(
    () => FEASIBLE_SOLAR_REGIONS.find((r) => r.id === selectedRegionId) ?? FEASIBLE_SOLAR_REGIONS[0],
    [selectedRegionId]
  )

  const pick = (r: RoofCandidate) => { update({ roof: r.id, disco: r.discom }); setSheet({ kind: "roof" }) }
  const pickRegion = (r: FeasibleSolarRegion) => {
    setSelectedRegionId(r.id)
    setSheet({ kind: "region", region: r })
  }

  // GeoJSON FeatureCollection of feasible solar regions
  const regionsGeoJson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: FEASIBLE_SOLAR_REGIONS.map((r) => ({
      type: "Feature" as const,
      id: r.id,
      properties: {
        id: r.id,
        name: r.name,
        state: r.state,
        tier: r.tier,
        yield: r.specificYieldKwhPerKwp,
        selected: r.id === selectedRegionId,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [r.boundaryPolygon],
      },
    })),
  }), [selectedRegionId])

  return (
    <div className="relative h-full">
      <MapView center={DELHI} zoom={10.4} theme="light" className="absolute inset-0">
        <MapControls position="bottom-right" showZoom showLocate />
        <FlyTo
          roof={sheet?.kind === "roof" ? roof : null}
          region={sheet?.kind === "region" ? sheet.region : (layer === "regions" ? selectedRegion : null)}
        />

        {/* Feasible Regions Polygons Layer */}
        {layer === "regions" && (
          <>
            <MapGeoJSON
              id="feasible-regions-layer"
              data={regionsGeoJson}
              interactive={true}
              fillPaint={{
                "fill-color": [
                  "case",
                  ["get", "selected"],
                  "#f59e0b",
                  "#10b981",
                ],
                "fill-opacity": [
                  "case",
                  ["get", "selected"],
                  0.35,
                  0.18,
                ],
              }}
              linePaint={{
                "line-color": [
                  "case",
                  ["get", "selected"],
                  "#d97706",
                  "#059669",
                ],
                "line-width": [
                  "case",
                  ["get", "selected"],
                  2.5,
                  1.5,
                ],
                "line-dasharray": [2, 1],
              }}
              onClick={(e) => {
                const featureId = e.feature?.properties?.id
                const found = FEASIBLE_SOLAR_REGIONS.find((r) => r.id === featureId)
                if (found) pickRegion(found)
              }}
            />

            {/* Region Center Markers */}
            {FEASIBLE_SOLAR_REGIONS.map((r) => (
              <MapMarker
                key={r.id}
                longitude={r.center[0]}
                latitude={r.center[1]}
                onClick={() => pickRegion(r)}
              >
                <MarkerContent>
                  <button
                    aria-label={`Solar region ${r.name}`}
                    className={cn(
                      "flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-semibold shadow-md transition-all backdrop-blur-xs",
                      r.id === selectedRegionId
                        ? "border-amber-500 bg-amber-500 text-white scale-110"
                        : "border-emerald-600 bg-white/95 text-emerald-950 hover:bg-emerald-50"
                    )}
                  >
                    <Sun className="size-3 text-amber-400 fill-amber-400" />
                    <span>{r.name}</span>
                    <span className="text-[10px] font-normal opacity-75">({r.specificYieldKwhPerKwp})</span>
                  </button>
                </MarkerContent>
                <MarkerTooltip>
                  <div className="text-xs">
                    <p className="font-bold">{r.name} ({r.state})</p>
                    <p className="text-muted-foreground">{r.specificYieldKwhPerKwp} kWh/kWp/yr · {r.ghiKwhPerM2Day} kWh/m²/day</p>
                    <p className="text-emerald-600 font-semibold mt-0.5">{r.tier} Feasibility</p>
                  </div>
                </MarkerTooltip>
              </MapMarker>
            ))}
          </>
        )}

        {layer === "fit" &&
          roofs.map((r) => (
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
          ))}

        {layer === "apps" && <DiscomCircles onPick={(id) => setSheet({ kind: "discom", id })} />}
      </MapView>

      {/* search + layers */}
      <div className="absolute top-3 left-3 z-10 flex w-[min(340px,calc(100%-24px))] flex-col gap-2 rounded-[2px] border bg-white p-3 shadow-lg">
        <button onClick={openCommand} className="flex items-center justify-between gap-2 rounded-md border bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-2 whitespace-nowrap"><Search className="size-4" />Search place or solar zone</span>
          <kbd className="rounded border bg-card px-1 text-sm text-muted-foreground">Ctrl K</kbd>
        </button>

        {/* Layer Selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Map Layer</span>
          <ToggleGroup type="single" size="sm" variant="outline" value={layer} onValueChange={(v) => v && setLayer(v as typeof layer)}>
            <ToggleGroupItem value="fit" className="text-xs">Solar fit</ToggleGroupItem>
            <ToggleGroupItem value="apps" className="text-xs">Applications</ToggleGroupItem>
            <ToggleGroupItem value="regions" className="text-xs font-semibold text-amber-700 data-[state=on]:bg-amber-100 data-[state=on]:text-amber-900">
              ☀️ India Feasible
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Region Input Selector (when in feasible region layer) */}
        {layer === "regions" ? (
          <div className="flex flex-col gap-1.5 border-t pt-2">
            <label htmlFor="feasible-region-select" className="flex items-center justify-between text-xs font-bold text-foreground">
              <span>Feasible Solar Region</span>
              <span className="text-[10px] font-normal text-muted-foreground">Across India</span>
            </label>
            <select
              id="feasible-region-select"
              value={selectedRegionId}
              onChange={(e) => {
                const reg = FEASIBLE_SOLAR_REGIONS.find((r) => r.id === e.target.value)
                if (reg) pickRegion(reg)
              }}
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {FEASIBLE_SOLAR_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.state}) — {r.specificYieldKwhPerKwp} kWh/kWp
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>GHI: <b className="text-foreground">{selectedRegion.ghiKwhPerM2Day}</b> kWh/m²/d</span>
              <span>Yield: <b className="text-foreground">{selectedRegion.specificYieldKwhPerKwp}</b> kWh/kWp</span>
              <span className="rounded bg-emerald-100 px-1 py-0.2 text-[10px] font-bold text-emerald-800">{selectedRegion.tier}</span>
            </div>
          </div>
        ) : (
          <ScopeFilter compact />
        )}
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
        ) : layer === "apps" ? (
          <span className="text-muted-foreground">Circle size = homes that have applied</span>
        ) : (
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <i className="inline-block size-3 rounded-xs border border-amber-600 bg-amber-500/50" />
              <span>Selected Solar Feasible Zone</span>
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block size-3 rounded-xs border border-emerald-600 bg-emerald-500/25" />
              <span>High Irradiance Zones (India)</span>
            </span>
          </div>
        )}
      </div>

      {/* hint */}
      <div className="absolute top-3 right-3 z-10 hidden max-w-64 flex-col gap-1 rounded-[2px] border bg-white px-3 py-2 text-sm shadow-lg sm:flex">
        <span>
          {layer === "fit"
            ? "Click a roof to see what fits and what it costs."
            : layer === "apps"
            ? "Click a DISCOM for its application count."
            : "Select or click any feasible solar region across India to inspect irradiance & yield."}
        </span>
        <span className="text-xs text-[var(--govuk-secondary-text)]">
          {layer === "regions"
            ? "High solar irradiation corridors (>1,450 kWh/kWp/yr)"
            : "Sample roofs until the real roof data arrives."}
        </span>
      </div>

      <RoofSheet roof={sheet?.kind === "roof" ? roof : null} onClose={() => setSheet(null)}
        onCheck={(r) => {
          const load = r.fitKw > household.load ? ([2, 3, 5, 7].find((l) => l >= r.fitKw) ?? 7) : household.load
          setSheet(null)
          navigate("check", { roof: r.id, size: Math.min(r.fitKw, load), load, disco: r.discom })
        }} />

      <DiscomSheet id={sheet?.kind === "discom" ? sheet.id : null} onClose={() => setSheet(null)}
        onShowRoofs={(d) => { setScope(d); setLayer("fit"); setSheet(null) }} onAlerts={() => navigate("alerts")} />

      <FeasibleRegionSheet
        region={sheet?.kind === "region" ? sheet.region : null}
        onClose={() => setSheet(null)}
        onSelectDelhiRoofs={() => {
          setLayer("fit")
          setSheet(null)
        }}
      />
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

function FlyTo({ roof, region }: { roof: RoofCandidate | null; region?: FeasibleSolarRegion | null }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    const desktop = window.matchMedia("(min-width: 768px)").matches

    if (roof) {
      map.easeTo({
        center: [roof.longitude, roof.latitude],
        zoom: Math.max(map.getZoom(), 11),
        padding: desktop ? { right: 400, left: 0, top: 0, bottom: 0 } : { bottom: 380, top: 0, left: 0, right: 0 },
        duration: 700,
      })
    } else if (region) {
      map.easeTo({
        center: region.center,
        zoom: region.zoom,
        padding: desktop ? { right: 380, left: 0, top: 0, bottom: 0 } : { bottom: 340, top: 0, left: 0, right: 0 },
        duration: 900,
      })
    }
  }, [map, isLoaded, roof, region])
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

// ---------------------------------------------------------------- Feasible Region sheet

function FeasibleRegionSheet({
  region,
  onClose,
  onSelectDelhiRoofs,
}: {
  region: FeasibleSolarRegion | null
  onClose: () => void
  onSelectDelhiRoofs: () => void
}) {
  const mobile = useIsMobile()
  const { navigate } = useApp()

  return (
    <Sheet open={!!region} onOpenChange={(o) => !o && onClose()} modal={false}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className={cn("gap-0 p-0", mobile ? "max-h-[85dvh]" : "w-[390px] sm:max-w-[390px]")}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {region && (
          <>
            <SheetHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {region.zone} India · {region.state}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                  {region.tier} Feasibility
                </span>
              </div>
              <SheetTitle className="text-xl font-bold flex items-center gap-1.5 mt-1">
                <Sun className="size-5 text-amber-500 fill-amber-500 shrink-0" />
                <span>{region.name}</span>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {region.description}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              {/* Solar Resource Metrics */}
              <section className="flex flex-col gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase">Solar Resource Metrics</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border p-3 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Zap className="size-3 text-amber-500" />Specific Yield
                    </span>
                    <span className="text-2xl font-bold tabular-nums text-foreground mt-0.5 block">
                      {region.specificYieldKwhPerKwp}
                    </span>
                    <span className="text-[10px] text-muted-foreground">kWh / kWp / year</span>
                  </div>

                  <div className="rounded-md border p-3 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sun className="size-3 text-amber-500" />Daily GHI
                    </span>
                    <span className="text-2xl font-bold tabular-nums text-foreground mt-0.5 block">
                      {region.ghiKwhPerM2Day}
                    </span>
                    <span className="text-[10px] text-muted-foreground">kWh / m² / day</span>
                  </div>
                </div>
              </section>

              {/* Regional Highlights */}
              <section className="flex flex-col gap-1.5 rounded-md border bg-muted/20 p-3 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Info className="size-3.5 text-primary" /> Key Regional Features
                </span>
                <p className="text-muted-foreground leading-relaxed">
                  {region.keyFeatures}
                </p>
              </section>

              {/* Generation Benchmark comparison with Delhi */}
              <section className="flex flex-col gap-1.5 border-t pt-3">
                <span className="text-xs font-bold text-muted-foreground uppercase">Generation Benchmark</span>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between py-1 border-b">
                    <span>Delhi Reference Baseline:</span>
                    <span className="font-mono font-semibold text-foreground">1,466 kWh/kWp/yr</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span>{region.name}:</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {region.specificYieldKwhPerKwp} kWh/kWp/yr
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Yield Multiplier vs Delhi:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {(region.specificYieldKwhPerKwp / 1466).toFixed(2)}x
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <SheetFooter className="flex-col gap-2 border-t sm:flex-col">
              {region.id === "delhi-ncr" ? (
                <Button className="w-full" onClick={onSelectDelhiRoofs}>
                  Inspect Delhi Rooftops
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => {
                    navigate("check", { size: 3, load: 3 })
                  }}
                >
                  Simulate 3 kW Solar Bill
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
