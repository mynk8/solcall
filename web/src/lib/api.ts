// Typed client for the engine's endpoints. In dev, Vite proxies /api to uvicorn on :8000.

export type Rung = {
  total: number
  per_kw: number
  tier: string | null
  source: string | null
  as_of: string | null
  n: number | null
}

export type PriceLadder = {
  size_kw: number
  typical_price: number | null // market median, else govt benchmark
  typical_subsidy: number | null // central + Delhi at the typical price
  typical_you_pay: number | null
  benchmark: Rung | null
  market_low: Rung | null
  market_median: Rung | null
  market_high: Rung | null
  history: Rung | null
  central_subsidy: number | null
}

export type Verdict = "GO" | "GO_FREE" | "MARGINAL" | "NOT_WORTH"

export type Outcome = {
  verdict: Verdict
  reason: string
  price: number
  central_subsidy: number
  delhi_subsidy: number
  you_pay: number
  bill_now_month: number
  bill_with_month: number
  saving_year1: number
  payback_years: number | null
  payback_discounted_years: number | null
  value_per_unit: number | null
  cost_per_unit: number | null
  npv: number
  emi_month: number | null
  emi_cover: number | null
  monthly: { month: string; units: number; solar_units: number; bill_now: number; bill_with: number }[]
}

export type Answer = {
  inputs: { units: number; load: number; size: number; quote: number | null }
  size_allowed: boolean
  solar_units_month: number
  price_ladder: PriceLadder
  price_basis: "your quote" | "market median" | "govt benchmark"
  paid: Outcome
  free: Outcome | null
  free_eligible: boolean
  free_operational: boolean
  loan_applies: boolean
}

export type Today = {
  applications: {
    as_on: string | null
    total: number | null
    by_discom: { discom: string; total: number; top: { division: string; applications: number } | null }[]
  }
  rates: { as_of: string; repo_pct: number; scheme_loan_pct: number; deposit_low_pct: number; deposit_high_pct: number } | null
  surcharge_brpl: { pct: number; from: string } | null
  solar_yield: { kwh_per_kwp: number; spread_pct: number; points: { name: string; kwh_per_kwp: number }[] } | null
}

export type Update = { category: string; date: string; title: string; detail: string; source: string }
export type Division = { discom: string; division: string; applications: number; rank: number; share: number }
export type SurchargeRow = { from: string; to: string | null; pct: number; title: string; pdf: string | null }

export type Provenance = {
  sources: Record<string, { name: string; url: string; tier: string }>
  rules: Record<string, { value: unknown; source_id?: string; source_name?: string; url?: string; tier: string; as_of: string; verify: boolean; note?: string }>
  verify_inventory: string[]
  assumption_inventory: string[]
}

async function get<T>(path: string, params?: Record<string, string | number | null | undefined>): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) if (v !== null && v !== undefined && v !== "") qs.set(k, String(v))
  const res = await fetch(`${path}${qs.size ? `?${qs}` : ""}`)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  answer: (p: { units: number; load: number; size: number; quote?: number | null }) => get<Answer>("/api/web/answer", p),
  prices: () => get<{ sizes: PriceLadder[] }>("/api/web/prices"),
  today: () => get<Today>("/api/web/today"),
  updates: () => get<{ items: Update[] }>("/api/web/updates"),
  divisions: () => get<{ divisions: Division[] }>("/api/web/divisions"),
  surcharge: () => get<{ discom: string; rows: SurchargeRow[] }>("/api/web/surcharge"),
  provenance: () => get<Provenance>("/api/provenance"),
  unitsFromBill: (amount: number, load: number) =>
    get<{ units: number; approximate: boolean; bill_at_units?: number; note?: string }>("/api/web/units-from-bill", { amount, load }),
}
