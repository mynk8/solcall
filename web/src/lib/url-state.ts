// Routing + household inputs. Inputs live in the query string so any household page can be
// shared and reopened: /check?roof=R-1042&units=450&load=3&size=3&disco=BRPL

import { useCallback, useEffect, useState } from "react"

export type Route = "home" | "map" | "check" | "deal" | "alerts" | "records" | "changelog" | "guide" | "data"
export type Scope = "Everywhere" | "BRPL" | "BYPL" | "TPDDL"

export const ROUTES: Record<Route, { path: string; title: string; scope?: boolean; step?: 1 | 2 | 3; household?: boolean }> = {
  home: { path: "/", title: "Reference Price", scope: true },
  map: { path: "/map", title: "Roof Map", scope: true, step: 1, household: true },
  check: { path: "/check", title: "Check my bill", step: 2, household: true },
  deal: { path: "/deal", title: "Get a deal", step: 3, household: true },
  alerts: { path: "/alerts", title: "My alerts", household: true },
  records: { path: "/records", title: "Records", scope: true },
  changelog: { path: "/changelog", title: "Changelog", scope: true },
  guide: { path: "/guide", title: "Subsidy guide" },
  data: { path: "/data", title: "Data catalog & API" },
}

export type Household = {
  roof: string | null
  units: number
  load: number
  size: number
  disco: "BRPL" | "BYPL" | "TPDDL"
  quote: number | null
  quoteSize: number
  dealTab: "paid" | "free" | null // null = pick from eligibility
}

const DEFAULTS: Household = { roof: null, units: 450, load: 3, size: 3, disco: "BRPL", quote: null, quoteSize: 3, dealTab: null }

function routeFromPath(path: string): Route {
  const hit = (Object.entries(ROUTES) as [Route, (typeof ROUTES)[Route]][]).find(([, r]) => r.path === path)
  return hit ? hit[0] : "home"
}

function read(): { household: Household; scope: Scope } {
  const q = new URLSearchParams(location.search)
  const num = (k: string, d: number) => (q.get(k) && !Number.isNaN(+q.get(k)!) ? +q.get(k)! : d)
  const disco = q.get("disco")
  const tab = q.get("tab")
  const scope = q.get("scope")
  return {
    household: {
      roof: q.get("roof"),
      units: num("units", DEFAULTS.units),
      load: num("load", DEFAULTS.load),
      size: num("size", DEFAULTS.size),
      disco: disco === "BYPL" || disco === "TPDDL" ? disco : "BRPL",
      quote: q.get("quote") ? num("quote", 0) || null : null,
      quoteSize: num("qsize", DEFAULTS.quoteSize),
      dealTab: tab === "paid" || tab === "free" ? tab : null,
    },
    scope: scope === "BRPL" || scope === "BYPL" || scope === "TPDDL" ? scope : "Everywhere",
  }
}

function toUrl(route: Route, h: Household, scope: Scope) {
  const q = new URLSearchParams()
  if (ROUTES[route].scope && scope !== "Everywhere") q.set("scope", scope)
  if (ROUTES[route].household) {
    if (h.roof) q.set("roof", h.roof)
    if (h.units !== DEFAULTS.units) q.set("units", String(h.units))
    if (h.load !== DEFAULTS.load) q.set("load", String(h.load))
    if (h.size !== DEFAULTS.size) q.set("size", String(h.size))
    if (h.disco !== DEFAULTS.disco) q.set("disco", h.disco)
    if (route === "deal") {
      if (h.quote) q.set("quote", String(h.quote))
      if (h.quoteSize !== DEFAULTS.quoteSize) q.set("qsize", String(h.quoteSize))
      if (h.dealTab) q.set("tab", h.dealTab)
    }
  }
  return ROUTES[route].path + (q.size ? `?${q}` : "")
}

export function useAppState() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(location.pathname))
  const [{ household, scope }, setState] = useState(read)

  useEffect(() => {
    const onPop = () => {
      setRoute(routeFromPath(location.pathname))
      setState(read())
    }
    addEventListener("popstate", onPop)
    return () => removeEventListener("popstate", onPop)
  }, [])

  // keep the address bar in sync without adding history entries for every slider move
  useEffect(() => {
    const url = toUrl(route, household, scope)
    if (url !== location.pathname + location.search) history.replaceState(null, "", url)
  }, [route, household, scope])

  const navigate = useCallback((to: Route, patch?: Partial<Household>) => {
    setState((s) => {
      const next = { ...s, household: { ...s.household, ...patch } }
      history.pushState(null, "", toUrl(to, next.household, next.scope))
      return next
    })
    setRoute(to)
    document.getElementById("main")?.scrollTo(0, 0)
  }, [])

  const update = useCallback((patch: Partial<Household>) => setState((s) => ({ ...s, household: { ...s.household, ...patch } })), [])
  const setScope = useCallback((scope: Scope) => setState((s) => ({ ...s, scope })), [])

  return { route, navigate, household, update, scope, setScope }
}

export const shareUrl = () => location.origin + location.pathname + location.search
