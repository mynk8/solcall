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

// GAP: the portal gives application counts per division but no geometry. These are the
// localities the division codes stand for, at approximate centres (display only, not boundaries).
export const DIVISION_POINTS: Record<string, { name: string; longitude: number; latitude: number }> = {
  // BRPL west
  W1JFR: { name: "Jaffarpur", longitude: 76.915, latitude: 28.592 },
  W1NJF: { name: "Najafgarh", longitude: 76.982, latitude: 28.611 },
  W1MDK: { name: "Mundka", longitude: 77.031, latitude: 28.682 },
  W1NGL: { name: "Nangloi", longitude: 77.066, latitude: 28.672 },
  W1PJB: { name: "Punjabi Bagh", longitude: 77.131, latitude: 28.668 },
  W2PLM: { name: "Palam", longitude: 77.091, latitude: 28.588 },
  W2JKP: { name: "Janakpuri", longitude: 77.088, latitude: 28.621 },
  W2DWK: { name: "Dwarka", longitude: 77.046, latitude: 28.583 },
  W2VKP: { name: "Vikaspuri", longitude: 77.071, latitude: 28.643 },
  W2TGN: { name: "Tagore Garden", longitude: 77.113, latitude: 28.647 },
  W2UTN: { name: "Uttam Nagar", longitude: 77.058, latitude: 28.621 },
  W2MGN: { name: "Mohan Garden", longitude: 77.031, latitude: 28.632 },
  // BRPL south
  S1ALN: { name: "Alaknanda", longitude: 77.252, latitude: 28.528 },
  S1KHP: { name: "Khanpur", longitude: 77.231, latitude: 28.512 },
  S1SVR: { name: "Sarita Vihar", longitude: 77.291, latitude: 28.531 },
  S1NHP: { name: "Nehru Place", longitude: 77.251, latitude: 28.549 },
  S1NFC: { name: "New Friends Colony", longitude: 77.272, latitude: 28.566 },
  S1NZD: { name: "Nizamuddin", longitude: 77.249, latitude: 28.589 },
  S2VKJ: { name: "Vasant Kunj", longitude: 77.158, latitude: 28.522 },
  S2HKS: { name: "Hauz Khas", longitude: 77.203, latitude: 28.549 },
  S2SKT: { name: "Saket", longitude: 77.212, latitude: 28.522 },
  S2RKP: { name: "R K Puram", longitude: 77.181, latitude: 28.566 },
  // BYPL
  ENKWR: { name: "Karawal Nagar", longitude: 77.272, latitude: 28.731 },
  ENYVR: { name: "Yamuna Vihar", longitude: 77.271, latitude: 28.702 },
  ENNNG: { name: "Nand Nagri", longitude: 77.309, latitude: 28.693 },
  ENGTR: { name: "G T Road", longitude: 77.291, latitude: 28.676 },
  ESMVR: { name: "Mayur Vihar", longitude: 77.298, latitude: 28.608 },
  ESKKD: { name: "Karkardooma", longitude: 77.302, latitude: 28.651 },
  ESVSE: { name: "Vasundhara Enclave", longitude: 77.319, latitude: 28.601 },
  ESLNR: { name: "Laxmi Nagar", longitude: 77.277, latitude: 28.631 },
  ESKNR: { name: "Krishna Nagar", longitude: 77.281, latitude: 28.659 },
  CESRD: { name: "Shankar Road", longitude: 77.183, latitude: 28.639 },
  CEDRG: { name: "Darya Ganj", longitude: 77.241, latitude: 28.644 },
  CECCK: { name: "Chandni Chowk", longitude: 77.231, latitude: 28.657 },
  CEPHG: { name: "Paharganj", longitude: 77.212, latitude: 28.645 },
  CEPNR: { name: "Patel Nagar", longitude: 77.168, latitude: 28.651 },
  // TPDDL
  BAWANA: { name: "Bawana", longitude: 77.034, latitude: 28.799 },
  "SHALIMAR BAGH": { name: "Shalimar Bagh", longitude: 77.163, latitude: 28.717 },
  NARELA: { name: "Narela", longitude: 77.093, latitude: 28.853 },
  BADLI: { name: "Badli", longitude: 77.141, latitude: 28.744 },
  ROHINI: { name: "Rohini", longitude: 77.113, latitude: 28.722 },
  "MANGOL PURI": { name: "Mangolpuri", longitude: 77.083, latitude: 28.692 },
  KIRARI: { name: "Kirari", longitude: 77.051, latitude: 28.701 },
  PITAMPURA: { name: "Pitampura", longitude: 77.131, latitude: 28.699 },
  "MOTI NAGAR": { name: "Moti Nagar", longitude: 77.143, latitude: 28.661 },
  "MODEL TOWN": { name: "Model Town", longitude: 77.191, latitude: 28.711 },
  KESHAVPURAM: { name: "Keshavpuram", longitude: 77.161, latitude: 28.689 },
  "CIVIL LINES": { name: "Civil Lines", longitude: 77.223, latitude: 28.681 },
}

export const divisionName = (code: string) => DIVISION_POINTS[code]?.name ?? code
