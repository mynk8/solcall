import { useEffect, useState, type ReactNode } from "react"
import {
  Bell, BookOpen, Calculator, Database, Handshake, History, Map as MapIcon, Menu, Search, Tag, Trophy,
} from "lucide-react"

import { CommandPalette } from "@/components/command-palette"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useApp } from "@/lib/app-context"
import { SAMPLE_ROOFS } from "@/lib/roofs"
import { ROUTES, type Route } from "@/lib/url-state"
import { cn } from "@/lib/utils"

const GROUPS: { label: string; items: { route: Route; label: string; icon: typeof MapIcon }[] }[] = [
  { label: "Solar in Delhi", items: [
    { route: "home", label: "Reference Price", icon: Tag },
    { route: "map", label: "Roof Map", icon: MapIcon },
  ] },
  { label: "For my home", items: [
    { route: "check", label: "Check my bill", icon: Calculator },
    { route: "deal", label: "Get a deal", icon: Handshake },
    { route: "alerts", label: "My alerts", icon: Bell },
  ] },
  { label: "Track", items: [
    { route: "records", label: "Records", icon: Trophy },
    { route: "changelog", label: "Changelog", icon: History },
    { route: "guide", label: "Subsidy guide", icon: BookOpen },
  ] },
  { label: "Data", items: [{ route: "data", label: "Data catalog & API", icon: Database }] },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { route, navigate, openCommand } = useApp()
  const [navOpen, setNavOpen] = useState(false)
  const r = ROUTES[route]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openCommand() }
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [openCommand])

  const go = (to: Route) => { setNavOpen(false); navigate(to) }

  return (
    <div className="flex h-dvh bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r bg-[var(--govuk-light-grey)] md:flex" aria-label="Main navigation">
        <SidebarBody route={route} go={go} openCommand={openCommand} />
      </aside>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarBody route={route} go={go} openCommand={() => { setNavOpen(false); openCommand() }} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* phones only: menu button + page title. On desktop the sidebar and page heading do this job. */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b-4 border-[var(--govuk-dark-blue)] bg-[var(--govuk-blue)] px-3 text-white md:hidden">
          <Button variant="ghost" size="icon" className="size-9 text-white hover:bg-white/15 hover:text-white" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <b className="truncate text-lg font-bold">{r.title}</b>
        </header>
        {r.step && <Stepper />}
        <main id="main" className={cn("relative min-h-0 flex-1", route === "map" ? "overflow-hidden" : "overflow-y-auto")}>
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}

function SidebarBody({ route, go, openCommand }: { route: Route; go: (r: Route) => void; openCommand: () => void }) {
  return (
    <nav className="flex w-full flex-col gap-0.5 overflow-y-auto p-3">
      <button className="flex items-center gap-2 px-3 pt-1 pb-2 text-xl font-bold" onClick={() => go("home")}>
        <span className="size-6 rounded-full bg-[var(--govuk-yellow)] ring-2 ring-[var(--govuk-orange)]" aria-hidden />
        SolCall
      </button>
      <span className="px-3 pb-2 text-sm text-[var(--govuk-secondary-text)]">Rooftop solar in Delhi</span>
      {GROUPS.map((g) => (
        <div key={g.label} className="flex flex-col gap-0.5">
          <span className="px-3 pt-4 pb-1 text-sm font-bold text-[var(--govuk-secondary-text)]">{g.label}</span>
          {g.items.map((it) => (
            <button key={it.route} onClick={() => go(it.route)} aria-current={route === it.route ? "page" : undefined}
              className={cn("flex items-center gap-2.5 border-l-4 border-transparent py-2 pr-2 pl-2 text-left text-[var(--govuk-blue)] hover:bg-white hover:underline",
                route === it.route && "border-[var(--govuk-blue)] bg-white font-bold text-foreground")}>
              <it.icon className="size-4 shrink-0" />
              {it.label}
            </button>
          ))}
        </div>
      ))}
      <div className="flex-1" />
      <button onClick={openCommand} className="mt-4 flex items-center justify-between rounded-[2px] border-2 border-foreground bg-white px-3 py-1.5 text-left">
        <span className="flex items-center gap-2"><Search className="size-4" />Jump to…</span><kbd className="rounded border px-1 text-xs">Ctrl K</kbd>
      </button>
    </nav>
  )
}

function Stepper() {
  const { route, navigate, household } = useApp()
  const step = ROUTES[route].step ?? 0
  const roof = SAMPLE_ROOFS.find((r) => r.id === household.roof)
  const steps: [Route, string][] = [["map", "Find my roof"], ["check", "Check with my bill"], ["deal", "Get a fair deal"]]
  // the roof step is optional: tick it only when a roof was picked
  const done = (i: number) => step > i + 1 && (i > 0 || !!roof)
  return (
    <nav className="flex shrink-0 items-center gap-2 overflow-x-auto border-b bg-white px-4 py-2.5" aria-label="Household steps">
      {steps.map(([to, label], i) => (
        <div key={to} className="flex items-center gap-1.5">
          {i > 0 && <span className="h-0.5 w-8 bg-[var(--govuk-mid-grey)]" />}
          <button onClick={() => navigate(to)}
            className={cn("flex items-center gap-2 px-1.5 py-0.5 whitespace-nowrap text-[var(--govuk-blue)] hover:underline",
              step === i + 1 && "font-bold text-foreground no-underline")}>
            <span className={cn("grid size-7 place-items-center rounded-full border-2 border-current text-sm font-bold",
              step === i + 1 && "border-[var(--govuk-blue)] bg-[var(--govuk-blue)] text-white",
              done(i) && "border-[var(--govuk-green)] bg-[var(--govuk-green)] text-white")}>
              {done(i) ? "✓" : i + 1}
            </span>
            {label}
          </button>
        </div>
      ))}
      <span className="ml-auto hidden pl-4 text-sm whitespace-nowrap text-[var(--govuk-secondary-text)] sm:inline">
        {roof ? `Roof ${roof.id} · ${roof.area}` : "No roof picked (optional)"}
      </span>
    </nav>
  )
}
