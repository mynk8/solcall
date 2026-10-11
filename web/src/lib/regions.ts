/**
 * Feasible solar regions across India.
 * Sourced from National Solar Radiation Database / Global Solar Atlas / MNRE solar irradiance classifications.
 * Specific yield values (kWh/kWp/year) and solar irradiance (GHI kWh/m²/day).
 */

export type SolarFeasibilityTier = "EXCELLENT" | "VERY_GOOD" | "GOOD"

export type FeasibleSolarRegion = {
  id: string
  name: string
  state: string
  zone: "North" | "West" | "Central" | "South" | "East"
  center: [number, number] // [longitude, latitude]
  zoom: number
  ghiKwhPerM2Day: number // Global Horizontal Irradiance kWh/m²/day
  specificYieldKwhPerKwp: number // kWh/kWp/year
  tier: SolarFeasibilityTier
  description: string
  keyFeatures: string
  boundaryPolygon: [number, number][] // [longitude, latitude][]
}

export const FEASIBLE_SOLAR_REGIONS: FeasibleSolarRegion[] = [
  {
    id: "delhi-ncr",
    name: "Delhi NCR",
    state: "Delhi",
    zone: "North",
    center: [77.15, 28.64],
    zoom: 10.4,
    ghiKwhPerM2Day: 5.1,
    specificYieldKwhPerKwp: 1466,
    tier: "GOOD",
    description: "High domestic rooftop density with progressive DISCOM net metering & capital subsidies.",
    keyFeatures: "PM Surya Ghar + Delhi State ₹26k/kW subsidy, fitted billing factor m = 1.37",
    boundaryPolygon: [
      [76.84, 28.40],
      [77.35, 28.40],
      [77.40, 28.88],
      [76.85, 28.88],
      [76.84, 28.40],
    ],
  },
  {
    id: "thar-jodhpur",
    name: "Thar & Marwar (Jodhpur / Bikaner)",
    state: "Rajasthan",
    zone: "West",
    center: [73.02, 26.28],
    zoom: 8.5,
    ghiKwhPerM2Day: 6.2,
    specificYieldKwhPerKwp: 1780,
    tier: "EXCELLENT",
    description: "India's highest solar irradiance belt with over 325 cloudless sunny days per year.",
    keyFeatures: "Bhadla Solar Park corridor; peak direct normal irradiance (DNI > 2000 kWh/m²)",
    boundaryPolygon: [
      [71.50, 25.40],
      [74.20, 25.40],
      [74.50, 28.20],
      [71.80, 28.20],
      [71.50, 25.40],
    ],
  },
  {
    id: "kutch-saurashtra",
    name: "Kutch & Saurashtra",
    state: "Gujarat",
    zone: "West",
    center: [70.50, 22.80],
    zoom: 8.2,
    ghiKwhPerM2Day: 5.9,
    specificYieldKwhPerKwp: 1690,
    tier: "EXCELLENT",
    description: "Premier coastal solar & hybrid energy zone with high sunshine hours and strong state evacuation grid.",
    keyFeatures: "Pioneer in residential solar rooftop adoption and Surya Gujarat initiatives",
    boundaryPolygon: [
      [68.80, 21.20],
      [72.20, 21.20],
      [71.90, 24.20],
      [68.60, 24.20],
      [68.80, 21.20],
    ],
  },
  {
    id: "ladakh-leh",
    name: "Ladakh High Altitude Plateau",
    state: "Ladakh",
    zone: "North",
    center: [77.58, 34.15],
    zoom: 8.0,
    ghiKwhPerM2Day: 6.4,
    specificYieldKwhPerKwp: 1820,
    tier: "EXCELLENT",
    description: "Ultra-pure atmosphere and low ambient temperature dramatically boost PV cell efficiency.",
    keyFeatures: "Pang / Leh ultra-mega renewable corridor with minimal atmospheric scattering",
    boundaryPolygon: [
      [76.50, 33.20],
      [79.20, 33.20],
      [79.00, 35.20],
      [76.30, 35.20],
      [76.50, 33.20],
    ],
  },
  {
    id: "deccan-karnataka",
    name: "Deccan Plateau (Tumakuru / Pavagada)",
    state: "Karnataka",
    zone: "South",
    center: [77.25, 14.10],
    zoom: 8.6,
    ghiKwhPerM2Day: 5.6,
    specificYieldKwhPerKwp: 1610,
    tier: "VERY_GOOD",
    description: "High elevation arid plateau with consistent year-round generation profile.",
    keyFeatures: "Pavagada Solar Park location (2,050 MW); high C&I and residential adoption",
    boundaryPolygon: [
      [76.20, 13.00],
      [78.40, 13.00],
      [78.20, 15.30],
      [76.00, 15.30],
      [76.20, 13.00],
    ],
  },
  {
    id: "rewa-malwa",
    name: "Rewa & Malwa Plateau",
    state: "Madhya Pradesh",
    zone: "Central",
    center: [81.30, 24.53],
    zoom: 8.4,
    ghiKwhPerM2Day: 5.7,
    specificYieldKwhPerKwp: 1640,
    tier: "VERY_GOOD",
    description: "Central India sunshine corridor with flat topography and high solar clearance.",
    keyFeatures: "Supplies solar power to Delhi Metro (DMRC); benchmark utility tariffs",
    boundaryPolygon: [
      [80.00, 23.50],
      [82.60, 23.50],
      [82.40, 25.50],
      [79.80, 25.50],
      [80.00, 23.50],
    ],
  },
  {
    id: "rayalaseema",
    name: "Rayalaseema Belt (Kurnool / Ananthapur)",
    state: "Andhra Pradesh",
    zone: "South",
    center: [77.80, 15.20],
    zoom: 8.3,
    ghiKwhPerM2Day: 5.7,
    specificYieldKwhPerKwp: 1630,
    tier: "VERY_GOOD",
    description: "Dry rain-shadow region of southern India boasting strong solar insolation.",
    keyFeatures: "Kurnool Ultra Mega Solar Park (1,000 MW); rapid green corridor connectivity",
    boundaryPolygon: [
      [76.80, 14.00],
      [79.00, 14.00],
      [78.80, 16.20],
      [76.60, 16.20],
      [76.80, 14.00],
    ],
  },
  {
    id: "maharashtra-vidarbha",
    name: "Vidarbha & Marathwada",
    state: "Maharashtra",
    zone: "West",
    center: [77.50, 20.50],
    zoom: 8.0,
    ghiKwhPerM2Day: 5.5,
    specificYieldKwhPerKwp: 1580,
    tier: "VERY_GOOD",
    description: "Semi-arid belt in Maharashtra ideal for rooftop agricultural and residential feed-in.",
    keyFeatures: "Active MSEDCL agricultural solar feeder scheme & residential subsidies",
    boundaryPolygon: [
      [76.00, 19.20],
      [79.50, 19.20],
      [79.30, 21.80],
      [75.80, 21.80],
      [76.00, 19.20],
    ],
  },
  {
    id: "tamilnadu-kamuthi",
    name: "Southern Tamil Nadu (Ramanathapuram)",
    state: "Tamil Nadu",
    zone: "South",
    center: [78.40, 9.40],
    zoom: 8.5,
    ghiKwhPerM2Day: 5.8,
    specificYieldKwhPerKwp: 1650,
    tier: "EXCELLENT",
    description: "Equatorial proximity delivers consistent solar angles and minimal winter drop in yield.",
    keyFeatures: "Site of historic Kamuthi Solar Plant (648 MW); stable grid evacuation",
    boundaryPolygon: [
      [77.60, 8.50],
      [79.20, 8.50],
      [79.00, 10.40],
      [77.40, 10.40],
      [77.60, 8.50],
    ],
  },
]
