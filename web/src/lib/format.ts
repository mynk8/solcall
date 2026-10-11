const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })

/** ₹2,27,750 */
export const rupees = (n: number | null | undefined) => (n == null ? "—" : `₹${inr.format(Math.round(n))}`)

/** ₹2.28 lakh for amounts ≥ 1 lakh, else ₹72,000 */
export function lakh(n: number | null | undefined) {
  if (n == null) return "—"
  if (Math.abs(n) < 100_000) return rupees(n)
  return `₹${(n / 100_000).toFixed(2).replace(/\.?0+$/, "")} lakh`
}

export const years = (n: number | null | undefined) =>
  n == null ? "—" : n === 0 ? "right away" : `${n.toFixed(1)} years`

export const shortDate = (iso: string | null | undefined) => {
  if (!iso) return ""
  const d = new Date(iso.slice(0, 10))
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

/** ₹1.98–2.4 lakh (or a single value when low equals high) */
export function lakhRange(lo: number | null | undefined, hi: number | null | undefined) {
  if (lo == null || hi == null) return lakh(lo ?? hi)
  if (lo === hi) return lakh(lo)
  return `${lakh(lo).replace(" lakh", "")}–${lakh(hi).replace("₹", "")}`
}
