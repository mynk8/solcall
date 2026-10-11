import { useEffect, useMemo, useState } from "react"
import { ChevronsUpDown, Eye, EyeOff, Layers, X } from "lucide-react"
import { toast } from "sonner"

import { VerdictPill } from "@/components/bits"
import { AppsScale, DivisionDots, appsColor } from "@/components/division-dots"
import { BarList, CostSplit, PaybackCurve } from "@/components/proof"
import { Button } from "@/components/ui/button"
import { Map as MapView, MapControls, MapMarker, MarkerContent, MarkerTooltip, useMap } from "@/components/ui/map"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, type Answer } from "@/lib/api"
import { useApp } from "@/lib/app-context"
import { lakh } from "@/lib/format"
import { DISCOM_CENTRES, SAMPLE_ROOFS, divisionName, shadeLabel, type Discom, type RoofCandidate } from "@/lib/roofs"
import { useIsMobile } from "@/lib/use-mobile"
import { cn } from "@/lib/utils"

const DELHI: [number, number] = [77.12, 28.68]

type Sheet = { kind: "roof" } | { kind: "discom"; id: Discom; division?: string } | null

export function MapPage() {
  const { household, navigate, update, scope, setScope } = useApp()
  const [showRoofs, setShowRoofs] = useState(true)
  const [showApps, setShowApps] = useState(true)
  const [mode, setMode] = useState<"division" | "discom">("division")
  const [sheet, setSheet] = useState<Sheet>(household.roof ? { kind: "roof" } : null)
  const roof = useMemo(() => SAMPLE_ROOFS.find((r) => r.id === household.roof) ?? null, [household.roof])
  const roofs = SAMPLE_ROOFS.filter((r) => scope === "Everywhere" || r.discom === scope)

  const pick = (r: RoofCandidate) => { update({ roof: r.id, disco: r.discom }); setSheet({ kind: "roof" }) }

  return (
    <div className="relative h-full">
      <MapView center={DELHI} zoom={10.2} theme="light" className="absolute inset-0">
        <MapControls position="bottom-right" showZoom showLocate />
        <FlyTo roof={sheet?.kind === "roof" ? roof : null} />
        {showApps && mode === "division" && (
          <DivisionDots selected={sheet?.kind === "discom" ? sheet.division : null}
            onPick={(d) => setSheet({ kind: "discom", id: d.discom as Discom, division: d.division })} />
        )}
        {showApps && mode === "discom" && <DiscomCircles onPick={(id) => setSheet({ kind: "discom", id })} />}
        {showRoofs && roofs.map((r) => (
          <MapMarker key={r.id} className="z-10" longitude={r.longitude} latitude={r.latitude} onClick={() => pick(r)}>
            <MarkerContent>
              <button aria-label={`Roof in ${r.area}, fits ${r.fitKw} kW, ${shadeLabel(r.shade)}`}
                className={cn("flex items-center gap-1 rounded-full border bg-white py-0.5 pr-2 pl-1 text-[13px] font-semibold shadow-md hover:scale-110",
                  r.id === roof?.id ? "border-[#0b0c0c] ring-2 ring-[#0b0c0c]" : "border-[#0b0c0c]/40")}>
                <i className="size-3 rounded-full" style={{ background: FIT_COLOR[r.shade] }} />{r.fitKw} kW
              </button>
            </MarkerContent>
            <MarkerTooltip>{r.area} · {shadeLabel(r.shade)}</MarkerTooltip>
          </MapMarker>
        ))}
      </MapView>

      <LayerPanel showRoofs={showRoofs} setShowRoofs={setShowRoofs} showApps={showApps} setShowApps={setShowApps} mode={mode} setMode={setMode} />

      <RoofSheet roof={sheet?.kind === "roof" ? roof : null} onClose={() => setSheet(null)}
        onCheck={(r) => {
          const load = r.fitKw > household.load ? ([2, 3, 5, 7].find((l) => l >= r.fitKw) ?? 7) : household.load
          setSheet(null)
          navigate("check", { roof: r.id, size: Math.min(r.fitKw, load), load, disco: r.discom })
        }} />
      <DiscomSheet id={sheet?.kind === "discom" ? sheet.id : null} division={sheet?.kind === "discom" ? sheet.division : undefined} onClose={() => setSheet(null)}
        onShowRoofs={(d) => { setScope(d); setShowRoofs(true); setSheet(null) }} onAlerts={() => navigate("alerts")} />
    </div>
  )
}

const FIT_STEPS = [
  { color: "#00703c", label: "Good" },
  { color: "#f47738", label: "Some shade" },
  { color: "#505a5f", label: "Poor" },
]

const FIT_COLOR: Record<RoofCandidate["shade"], string> = { none: "#00703c", light: "#f47738", heavy: "#505a5f" }

/**
 * Map controls in one panel (after GridStatus): area, then each layer as a section with a
 * visibility toggle, its colour scale and its display options.
 */
function LayerPanel({ showRoofs, setShowRoofs, showApps, setShowApps, mode, setMode }: {
  showRoofs: boolean; setShowRoofs: (v: boolean) => void; showApps: boolean; setShowApps: (v: boolean) => void
  mode: "division" | "discom"; setMode: (m: "division" | "discom") => void
}) {
  const { scope, setScope } = useApp()
  const mobile = useIsMobile()
  const [open, setOpen] = useState(!mobile)

  return (
    <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-24px)] items-start gap-2">
      {open && (
        <div className="flex w-[280px] min-w-0 flex-col divide-y rounded-lg border bg-white/95 shadow-lg backdrop-blur-sm">
          <div className="px-3 py-2">
            <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <SelectTrigger className="h-9 w-full justify-start gap-2 border-0 px-0 text-base shadow-none [&>svg:last-child]:hidden">
                <SelectValue /><ChevronsUpDown className="size-4 text-[var(--govuk-secondary-text)]" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Everywhere">All of Delhi</SelectItem>
                {(Object.keys(DISCOM_CENTRES) as Discom[]).map((d) => <SelectItem key={d} value={d}>{d} · {DISCOM_CENTRES[d].name.split(" (")[0]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <LayerRow title="Applications" on={showApps} setOn={setShowApps}>
            <span className="text-sm">Homes applied for solar</span>
            <AppsScale />
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-sm">Show by</span>
              <Segmented value={mode} onChange={setMode} options={[{ value: "division", label: "Division" }, { value: "discom", label: "DISCOM" }]} />
            </div>
          </LayerRow>
          <LayerRow title="Roofs" on={showRoofs} setOn={setShowRoofs}>
            <span className="text-sm">Solar fit · size in kW</span>
            <div className="grid grid-cols-3">
              {FIT_STEPS.map((s) => <div key={s.label} className="h-3.5" style={{ background: s.color }} />)}
              {FIT_STEPS.map((s) => <span key={s.label} className="pt-1 text-center text-xs">{s.label}</span>)}
            </div>
          </LayerRow>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Hide layers" : "Show layers"}
        className="grid size-10 shrink-0 place-items-center rounded-full border bg-white shadow-md hover:bg-[var(--govuk-light-grey)]">
        <Layers className="size-5" />
      </button>
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex rounded-md bg-[var(--govuk-light-grey)] p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={o.value === value}
          className={cn("rounded px-3 py-1 text-[13px] font-semibold", o.value === value ? "bg-white shadow-sm" : "text-[var(--govuk-secondary-text)]")}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function LayerRow({ title, on, setOn, children }: { title: string; on: boolean; setOn: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5">
      <button onClick={() => setOn(!on)} aria-pressed={on} aria-label={`${on ? "Hide" : "Show"} ${title.toLowerCase()}`}
        className={cn("flex items-center gap-2 self-start text-base", !on && "text-[var(--govuk-secondary-text)]")}>
        {title}{on ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
      {on && children}
    </div>
  )
}

function DiscomCircles({ onPick }: { onPick: (d: Discom) => void }) {
  const { today, scope } = useApp()
  return (
    <>
      {today?.applications.by_discom.filter((d) => scope === "Everywhere" || d.discom === scope).map((d) => {
        const c = DISCOM_CENTRES[d.discom as Discom]
        if (!c) return null
        const size = 56 + Math.sqrt(d.total) / 2.5
        return (
          <MapMarker key={d.discom} longitude={c.longitude} latitude={c.latitude} onClick={() => onPick(d.discom as Discom)}>
            <MarkerContent>
              <button className="grid place-items-center rounded-full border border-[#0b0c0c]/50 text-center text-sm font-bold text-white hover:scale-105"
                style={{ width: size, height: size, background: appsColor(d.total), opacity: 0.9 }}>
                {d.total.toLocaleString("en-IN")}<span className="text-xs font-normal">{d.discom}</span>
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

// ---------------------------------------------------------------- floating cards

/** A card that floats inside the map: top-right on desktop, docked to the bottom on phones. */
function FloatingCard({ open, onClose, children, footer }: { open: boolean; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <aside className={cn(
      "absolute z-20 flex flex-col overflow-hidden rounded-lg border bg-white shadow-xl animate-in fade-in duration-200",
      "inset-x-2 bottom-2 max-h-[62%] slide-in-from-bottom-4",
      "md:inset-x-auto md:top-3 md:right-3 md:bottom-auto md:max-h-[calc(100%-24px)] md:w-[360px] md:slide-in-from-right-4",
    )}>
      <button onClick={onClose} aria-label="Close" className="absolute top-2 right-2 grid size-8 place-items-center hover:bg-[var(--govuk-light-grey)]">
        <X className="size-5" />
      </button>
      <div className="flex flex-col gap-4 overflow-y-auto p-4">{children}</div>
      <div className="flex gap-2 border-t p-3">{footer}</div>
    </aside>
  )
}

// ---------------------------------------------------------------- roof card

// representative usage per band, and the colour of its payback line
const BANDS = [
  { label: "0–200", units: 150, color: "#b1b4b6" },
  { label: "201–400", units: 300, color: "#1d70b8" },
  { label: "400+", units: 500, color: "#00703c" },
]

function RoofSheet({ roof, onClose, onCheck }: { roof: RoofCandidate | null; onClose: () => void; onCheck: (r: RoofCandidate) => void }) {
  const { ladders, household, divisions } = useApp()
  const [answers, setAnswers] = useState<Answer[] | null>(null)

  const load = roof ? ([2, 3, 5, 7].find((l) => l >= Math.max(roof.fitKw, household.load)) ?? 7) : 3
  useEffect(() => {
    if (!roof) return
    setAnswers(null)
    let alive = true
    Promise.all(BANDS.map((b) => api.answer({ units: b.units, load, size: roof.fitKw })))
      .then((rs) => alive && setAnswers(rs))
      .catch(() => {})
    return () => { alive = false }
  }, [roof, load])

  const ladder = roof ? ladders.get(roof.fitKw) : undefined
  const division = roof?.division ? divisions?.find((d) => d.division === roof.division) : undefined
  const anyFree = answers?.some((a) => a.free_eligible)
  const top = answers?.[2]?.paid

  return (
    <FloatingCard open={!!roof} onClose={onClose} footer={roof && (
      <>
        <Button className="flex-1" onClick={() => onCheck(roof)}>Check with my bill</Button>
        <Button variant="outline" onClick={async () => {
          try { await navigator.clipboard.writeText(`${location.origin}/map?roof=${roof.id}`); toast("Roof link copied") } catch { toast.error("Couldn't copy") }
        }}>Share</Button>
      </>
    )}>
      {roof && (
        <>
          <div className="flex flex-col pr-8">
            <span className="text-sm text-muted-foreground">{roof.area} · {roof.discom}</span>
            <h2 className="text-xl font-bold">{roof.fitKw} kW fits · {shadeLabel(roof.shade)}</h2>
          </div>

          {/* what it costs, split by who pays */}
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">Cost</span>
              {ladder && <span className="text-sm text-muted-foreground">{lakh(ladder.typical_price)} typical</span>}
            </div>
            {ladder?.typical_price && ladder.typical_subsidy != null && ladder.typical_you_pay != null ? (
              <CostSplit price={ladder.typical_price} central={ladder.central_subsidy ?? 0}
                delhi={ladder.typical_subsidy - (ladder.central_subsidy ?? 0)} youPay={ladder.typical_you_pay} />
            ) : <Skeleton className="h-14" />}
          </section>

          {/* payback by usage band */}
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">Money back over time</span>
              {top?.lifetime_gain != null && top.lifetime_gain > 0 && (
                <span className="text-sm text-muted-foreground">up to <b className="text-[var(--govuk-green)]">+{lakh(top.lifetime_gain)}</b></span>
              )}
            </div>
            {answers ? (
              <>
                <PaybackCurve series={BANDS.map((b, i) => ({ key: `b${i}`, label: `${b.label} units`, color: b.color, points: answers[i].paid.cumulative }))} />
                <div className="grid grid-cols-3 gap-1.5 text-sm">
                  {BANDS.map((b, i) => (
                    <div key={b.label} className="flex flex-col items-start gap-1">
                      <span className="flex items-center gap-1.5 font-semibold"><i className="inline-block h-1 w-4" style={{ background: b.color }} />{b.label}</span>
                      <VerdictPill v={answers[i].paid.verdict} />
                    </div>
                  ))}
                </div>
                {anyFree && <p className="text-sm text-muted-foreground">Up to 400 units and 3 kW may get it free once the Delhi scheme opens.</p>}
              </>
            ) : <Skeleton className="h-56" />}
          </section>

          {division && (<p className="text-sm"><span className="font-semibold">Neighbours: </span><b className="tabular-nums">{division.applications.toLocaleString("en-IN")}</b> homes in {divisionName(division.division)} applied</p>)}
        </>
      )}
    </FloatingCard>
  )
}

// ---------------------------------------------------------------- DISCOM card (applications layer)

function DiscomSheet({ id, division, onClose, onShowRoofs, onAlerts }: {
  id: Discom | null; division?: string; onClose: () => void; onShowRoofs: (d: Discom) => void; onAlerts: () => void
}) {
  const { today, divisions } = useApp()
  const row = today?.applications.by_discom.find((d) => d.discom === id)
  const all = (divisions ?? []).filter((d) => d.discom === id).sort((a, b) => a.rank - b.rank)
  const picked = all.find((d) => d.division === division)
  // top divisions, plus the picked one if it ranks lower
  const top = all.slice(0, 7)
  if (picked && !top.includes(picked)) top[top.length - 1] = picked
  return (
    <FloatingCard open={!!id} onClose={onClose} footer={id && (
      <>
        <Button className="flex-1" onClick={() => onShowRoofs(id)}>Show roofs here</Button>
        <Button variant="outline" onClick={onAlerts}>Alerts</Button>
      </>
    )}>
      {id && (
        <>
          <div className="flex flex-col pr-8">
            <span className="text-sm text-muted-foreground">{picked ? `${id} · rank #${picked.rank} of ${all.length}` : DISCOM_CENTRES[id].name}</span>
            <h2 className="text-xl font-bold">
              {picked ? `${divisionName(picked.division)} · ${picked.applications.toLocaleString("en-IN")} homes` : row ? `${row.total.toLocaleString("en-IN")} homes applied` : "…"}
            </h2>
          </div>
          <section className="flex flex-col gap-2">
            <span className="font-semibold">Homes applied, {id} divisions</span>
            <BarList rows={top.map((d) => ({
              label: divisionName(d.division), value: d.applications, display: d.applications.toLocaleString("en-IN"),
              color: d.division === division ? "#0b0c0c" : appsColor(d.applications),
            }))} labelWidth="7.5rem" />
            <span className="text-sm text-muted-foreground">Source: Delhi Solar Portal · dot positions approximate</span>
          </section>
        </>
      )}
    </FloatingCard>
  )
}
