import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useApp } from "@/lib/app-context"
import { DISCOM_CENTRES, SAMPLE_ROOFS, type Discom } from "@/lib/roofs"
import { FEASIBLE_SOLAR_REGIONS } from "@/lib/regions"
import { ROUTES, type Route } from "@/lib/url-state"

/** Ctrl K: pages, places (roofs, DISCOMs, feasible solar regions) and sizes. */
export function CommandPalette() {
  const { commandOpen, setCommandOpen, navigate, setScope } = useApp()
  const run = (fn: () => void) => { setCommandOpen(false); fn() }

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Jump to" description="Search a page, address, division, solar region, or size">
      <CommandInput placeholder="Search a page, address, feasible solar region or size…" />
      <CommandList>
        <CommandEmpty>No match. Try “Jodhpur”, “Dwarka”, or “3 kW”.</CommandEmpty>
        <CommandGroup heading="Pages">
          {(Object.entries(ROUTES) as [Route, (typeof ROUTES)[Route]][]).map(([k, r]) => (
            <CommandItem key={k} onSelect={() => run(() => navigate(k))}>{r.title}</CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Places & Roofs">
          {SAMPLE_ROOFS.map((r) => (
            <CommandItem key={r.id} value={`${r.area} ${r.id}`} onSelect={() => run(() => navigate("map", { roof: r.id, disco: r.discom }))}>
              {r.area} <span className="text-muted-foreground">· roof {r.id}</span>
            </CommandItem>
          ))}
          {(Object.keys(DISCOM_CENTRES) as Discom[]).map((d) => (
            <CommandItem key={d} value={`${d} ${DISCOM_CENTRES[d].name}`} onSelect={() => run(() => { setScope(d); navigate("map") })}>
              {DISCOM_CENTRES[d].name} <span className="text-muted-foreground">· {d}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Feasible Solar Regions (India)">
          {FEASIBLE_SOLAR_REGIONS.map((reg) => (
            <CommandItem
              key={reg.id}
              value={`${reg.name} ${reg.state} solar ${reg.tier}`}
              onSelect={() => run(() => navigate("map"))}
            >
              ☀️ {reg.name} ({reg.state}) <span className="text-muted-foreground">· {reg.specificYieldKwhPerKwp} kWh/kWp/yr</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Sizes">
          {[1, 2, 3, 5, 10].map((k) => (
            <CommandItem key={k} value={`${k} kW price quote`} onSelect={() => run(() => navigate("deal", { size: k }))}>
              {k} kW price and quote check
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
