// Contract between the map (teammate) and the roof panel.
//
// GAP: there is no roof feed yet. The app needs `GET /api/roofs?bbox=…` (or a static
// GeoJSON) returning one RoofCandidate per roof. Until then these sample roofs stand in.
// The panel only reads these fields, so the real feed can drop in without UI changes.

export type Discom = "BRPL" | "BYPL" | "TPDDL"

export type RoofCandidate = {
  id: string
  longitude: number
  latitude: number
  area: string // colony / locality, shown as the place name
  discom: Discom
  division?: string // DISCOM division code, links to the applications feed
  fitKw: number // largest system the usable roof area supports
  shade: "none" | "light" | "heavy"
}

export const SAMPLE_ROOFS: RoofCandidate[] = [
  { id: "R-1042", longitude: 77.0466, latitude: 28.5921, area: "Dwarka Sector 10", discom: "BRPL", division: "W1JFR", fitKw: 3, shade: "light" },
  { id: "R-1187", longitude: 77.0712, latitude: 28.6328, area: "Janakpuri", discom: "BRPL", fitKw: 4, shade: "none" },
  { id: "R-0918", longitude: 77.2167, latitude: 28.5245, area: "Saket", discom: "BRPL", fitKw: 1, shade: "heavy" },
  { id: "R-2210", longitude: 77.2952, latitude: 28.6090, area: "Mayur Vihar Phase 1", discom: "BYPL", fitKw: 2, shade: "none" },
  { id: "R-2264", longitude: 77.2773, latitude: 28.6692, area: "Shahdara", discom: "BYPL", fitKw: 3, shade: "light" },
  { id: "R-3307", longitude: 77.0952, latitude: 28.8526, area: "Narela", discom: "TPDDL", division: "BAWANA", fitKw: 5, shade: "none" },
  { id: "R-3341", longitude: 77.1314, latitude: 28.7041, area: "Rohini Sector 9", discom: "TPDDL", fitKw: 3, shade: "none" },
]

// GAP: no division boundaries or centroids exist yet, so "Neighbours going solar" is drawn
// per DISCOM at rough service-area centres (approximate, for display only).
export const DISCOM_CENTRES: Record<Discom, { longitude: number; latitude: number; name: string }> = {
  BRPL: { longitude: 77.08, latitude: 28.56, name: "BSES Rajdhani (south & west)" },
  BYPL: { longitude: 77.27, latitude: 28.64, name: "BSES Yamuna (east & central)" },
  TPDDL: { longitude: 77.13, latitude: 28.74, name: "Tata Power DDL (north)" },
}

export const shadeLabel = (s: RoofCandidate["shade"]) =>
  s === "none" ? "no shade" : s === "light" ? "light shade" : "heavy shade"
