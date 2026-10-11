import { Map as MapView, MapMarker, MarkerContent, MarkerTooltip } from "@/components/ui/map"
import { useApp } from "@/lib/app-context"
import { DISCOM_CENTRES, type Discom } from "@/lib/roofs"
import { cn } from "@/lib/utils"

const DELHI: [number, number] = [77.16, 28.65]

/** Small, non-interactive map of applications per DISCOM (placed at approximate service-area centres). */
export function DiscomMiniMap({ className }: { className?: string }) {
  const { today, scope } = useApp()
  return (
    <div className={cn("relative overflow-hidden rounded-lg border", className)}>
      <MapView center={DELHI} zoom={9.2} theme="light" interactive={false} attributionControl={false} className="absolute inset-0">
        {today?.applications.by_discom.map((d) => {
          const c = DISCOM_CENTRES[d.discom as Discom]
          if (!c) return null
          const dim = scope !== "Everywhere" && scope !== d.discom
          const size = 40 + Math.sqrt(d.total) / 3
          return (
            <MapMarker key={d.discom} longitude={c.longitude} latitude={c.latitude}>
              <MarkerContent>
                <div className={cn("grid place-items-center rounded-full border-2 border-primary/60 bg-primary/20 text-center text-[11px] leading-tight font-semibold backdrop-blur-sm", dim && "opacity-30")}
                  style={{ width: size, height: size }}>
                  {Math.round(d.total / 1000)}k<span className="text-[9px] font-normal">{d.discom}</span>
                </div>
              </MarkerContent>
              <MarkerTooltip>{c.name}: {d.total.toLocaleString("en-IN")}</MarkerTooltip>
            </MapMarker>
          )
        })}
      </MapView>
    </div>
  )
}
