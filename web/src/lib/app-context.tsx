import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { api, type Answer, type Division, type PriceLadder, type Provenance, type SurchargeRow, type Today, type Update } from "@/lib/api"
import { useAppState, type Household, type Route, type Scope } from "@/lib/url-state"

type Data = {
  ladders: Map<number, PriceLadder>
  today: Today | null
  updates: Update[] | null
  divisions: Division[] | null
  surcharge: SurchargeRow[] | null
  provenance: Provenance | null
}

type Ctx = Data & {
  route: Route
  navigate: (to: Route, patch?: Partial<Household>) => void
  household: Household
  update: (patch: Partial<Household>) => void
  scope: Scope
  setScope: (s: Scope) => void
  openCommand: () => void
  commandOpen: boolean
  setCommandOpen: (o: boolean) => void
}

const AppContext = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const state = useAppState()
  const [commandOpen, setCommandOpen] = useState(false)
  const [ladders, setLadders] = useState<PriceLadder[]>([])
  const [today, setToday] = useState<Today | null>(null)
  const [updates, setUpdates] = useState<Update[] | null>(null)
  const [divisions, setDivisions] = useState<Division[] | null>(null)
  const [surcharge, setSurcharge] = useState<SurchargeRow[] | null>(null)
  const [provenance, setProvenance] = useState<Provenance | null>(null)

  useEffect(() => {
    api.prices().then((r) => setLadders(r.sizes)).catch(() => {})
    api.today().then(setToday).catch(() => {})
    api.updates().then((r) => setUpdates(r.items)).catch(() => setUpdates([]))
    api.divisions().then((r) => setDivisions(r.divisions)).catch(() => setDivisions([]))
    api.surcharge().then((r) => setSurcharge(r.rows)).catch(() => setSurcharge([]))
    api.provenance().then(setProvenance).catch(() => {})
  }, [])

  const ladderMap = useMemo(() => new Map(ladders.map((l) => [l.size_kw, l])), [ladders])

  const value: Ctx = {
    ...state,
    ladders: ladderMap, today, updates, divisions, surcharge, provenance,
    commandOpen, setCommandOpen, openCommand: () => setCommandOpen(true),
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const c = useContext(AppContext)
  if (!c) throw new Error("useApp outside AppProvider")
  return c
}

/** The engine's answer for the current household inputs (Check and Deal share it). */
export function useAnswer(p: { units: number; load: number; size: number; quote?: number | null }, enabled = true) {
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      api.answer(p)
        .then((a) => alive && (setAnswer(a), setError(null)))
        .catch((e: Error) => alive && setError(e.message))
        .finally(() => alive && setLoading(false))
    }, 120)
    return () => { alive = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.units, p.load, p.size, p.quote, enabled])
  return { answer, loading, error }
}
