import { APPS_BINS, DivisionDots } from "@/components/division-dots"
import { Map as MapView, MapControls } from "@/components/ui/map"
import { useApp } from "@/lib/app-context"
import { cn } from "@/lib/utils"

const DELHI: [number, number] = [77.12, 28.68]

/** Home-page map card: homes applied per division, filling the card, with a button to the full map. */
export function DiscomMiniMap({ className }: { className?: string }) {
  const { navigate } = useApp()
  return (
    <div className={cn("relative min-h-80 overflow-hidden rounded-[2px] border bg-white", className)}>
      <MapView center={DELHI} zoom={9.3} theme="light" scrollZoom={false} attributionControl={false} className="absolute inset-0">
        <MapControls position="bottom-right" showZoom />
        <DivisionDots small onPick={() => navigate("map")} />
      </MapView>
      <span className="absolute top-3 left-3 rounded-md bg-white/90 px-2 py-1 font-bold shadow-sm">Homes applied for solar</span>
      <button onClick={() => navigate("map")} className="absolute top-3 right-3 rounded-md bg-[#0b0c0c] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0b0c0c]/85">
        Open map
      </button>
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-md bg-white/90 p-2 shadow-sm">
        <span className="text-xs font-bold">Per division</span>
        {[...APPS_BINS].reverse().map((b) => (
          <span key={b.from} className="flex items-center gap-1.5 text-xs tabular-nums"><i className="h-3.5 w-5" style={{ background: b.color }} />{b.label}</span>
        ))}
      </div>
    </div>
  )
}
