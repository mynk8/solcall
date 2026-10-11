import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useApp } from "@/lib/app-context"
import type { Scope } from "@/lib/url-state"
import { cn } from "@/lib/utils"

const SCOPES: { value: Scope; label: string }[] = [
  { value: "Everywhere", label: "All of Delhi" },
  { value: "BRPL", label: "BRPL" },
  { value: "BYPL", label: "BYPL" },
  { value: "TPDDL", label: "TPDDL" },
]

/** DISCOM filter. Lives on the pages whose data it filters (Reference Price, Map, Records, Changelog). */
export function ScopeFilter({ className, compact }: { className?: string; compact?: boolean }) {
  const { scope, setScope } = useApp()
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {!compact && <span className="font-semibold">DISCOM</span>}
      <ToggleGroup type="single" size="sm" variant="outline" value={scope} onValueChange={(v) => v && setScope(v as Scope)}
        aria-label="Filter by DISCOM" className="flex-wrap justify-start">
        {SCOPES.map((s) => <ToggleGroupItem key={s.value} value={s.value}>{compact && s.value === "Everywhere" ? "All" : s.label}</ToggleGroupItem>)}
      </ToggleGroup>
    </div>
  )
}
