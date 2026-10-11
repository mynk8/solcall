/**
 * SolCall - Delhi GeoJSON Dataset for MapLibre GL JS
 * Contains DISCOM territorial boundaries and realistic residential rooftop polygons
 * with solar fit attributes, shade analysis, and capacity ratings.
 */

const DELHI_DISCOM_BOUNDARIES = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "discom_brpl",
      properties: {
        discom: "BRPL",
        fullName: "BSES Rajdhani Power Limited",
        coverage: "South and West Delhi",
        applications: 24864,
        topDivision: "W1JFR (10,294 apps)",
        color: "#f59e0b",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [76.95, 28.52], [77.05, 28.45], [77.18, 28.48], [77.26, 28.52],
            [77.25, 28.58], [77.16, 28.60], [77.08, 28.63], [77.00, 28.65],
            [76.92, 28.60], [76.95, 28.52]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "discom_bypl",
      properties: {
        discom: "BYPL",
        fullName: "BSES Yamuna Power Limited",
        coverage: "East and Central Delhi",
        applications: 27515,
        topDivision: "ENKWR (3,556 apps)",
        color: "#06b6d4",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.23, 28.58], [77.32, 28.58], [77.35, 28.65], [77.33, 28.72],
            [77.25, 28.70], [77.22, 28.65], [77.23, 28.58]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "discom_tpddl",
      properties: {
        discom: "TPDDL",
        fullName: "Tata Power Delhi Distribution Limited",
        coverage: "North and North-West Delhi",
        applications: 27461,
        topDivision: "BAWANA (5,372 apps)",
        color: "#10b981",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.00, 28.68], [77.15, 28.66], [77.24, 28.70], [77.22, 28.86],
            [77.08, 28.88], [76.98, 28.80], [77.00, 28.68]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "discom_ndmc",
      properties: {
        discom: "NDMC",
        fullName: "New Delhi Municipal Council",
        coverage: "Lutyens' Delhi & Central Administration",
        applications: 0,
        topDivision: "CENTRAL",
        color: "#8b5cf6",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.18, 28.58], [77.24, 28.58], [77.24, 28.64], [77.18, 28.64],
            [77.18, 28.58]
          ]
        ]
      }
    }
  ]
};

const DELHI_ROOFTOPS_DATA = {
  type: "FeatureCollection",
  features: [
    // --- South Delhi (BRPL) ---
    {
      type: "Feature",
      id: "roof_1",
      properties: {
        id: "DEL-GK2-B4-09",
        colony: "Greater Kailash II",
        address: "B-4/18, Greater Kailash II, New Delhi 110048",
        discom: "BRPL",
        division: "SAKET / GK",
        fits_kw: 3.0,
        usable_area_sqft: 450,
        shade: "Light Shade (94% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 95,
        color: "#10b981",
        typical_units: 450,
        recommended_load_kw: 3.0,
        azimuth: "180° South",
        tilt: "28° Optimal"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.2415, 28.5360], [77.2422, 28.5360], [77.2422, 28.5366],
            [77.2415, 28.5366], [77.2415, 28.5360]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_2",
      properties: {
        id: "DEL-GK1-M2-14",
        colony: "Greater Kailash I",
        address: "M-Block Market, GK-I, New Delhi 110048",
        discom: "BRPL",
        division: "SAKET / GK",
        fits_kw: 5.0,
        usable_area_sqft: 680,
        shade: "Unshaded (99% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 98,
        color: "#10b981",
        typical_units: 750,
        recommended_load_kw: 5.0,
        azimuth: "175° South-East",
        tilt: "27° Optimal"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.2385, 28.5480], [77.2395, 28.5480], [77.2395, 28.5488],
            [77.2385, 28.5488], [77.2385, 28.5480]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_3",
      properties: {
        id: "DEL-SKT-J3-22",
        colony: "Saket",
        address: "J-Block, Saket Residential, New Delhi 110017",
        discom: "BRPL",
        division: "SAKET",
        fits_kw: 2.0,
        usable_area_sqft: 280,
        shade: "Moderate Shade (82% Solar Access)",
        fit_grade: "GOOD",
        fit_score: 82,
        color: "#f59e0b",
        typical_units: 300,
        recommended_load_kw: 2.0,
        azimuth: "190° South-West",
        tilt: "25°"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.2100, 28.5220], [77.2108, 28.5220], [77.2108, 28.5227],
            [77.2100, 28.5227], [77.2100, 28.5220]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_4",
      properties: {
        id: "DEL-DWK-S6-88",
        colony: "Dwarka Sector 6",
        address: "Pocket 1, Sector 6, Dwarka, New Delhi 110075",
        discom: "BRPL",
        division: "DWARKA",
        fits_kw: 4.0,
        usable_area_sqft: 520,
        shade: "Unshaded (98% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 96,
        color: "#10b981",
        typical_units: 550,
        recommended_load_kw: 5.0,
        azimuth: "180° South",
        tilt: "28° Optimal"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.0600, 28.5880], [77.0610, 28.5880], [77.0610, 28.5888],
            [77.0600, 28.5888], [77.0600, 28.5880]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_5",
      properties: {
        id: "DEL-JNK-C2-41",
        colony: "Janakpuri",
        address: "C-2 Block, Janakpuri, New Delhi 110058",
        discom: "BRPL",
        division: "W1JFR",
        fits_kw: 3.0,
        usable_area_sqft: 400,
        shade: "Light Shade (91% Solar Access)",
        fit_grade: "GOOD",
        fit_score: 88,
        color: "#10b981",
        typical_units: 420,
        recommended_load_kw: 3.0,
        azimuth: "175° South",
        tilt: "26°"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.0850, 28.6250], [77.0858, 28.6250], [77.0858, 28.6258],
            [77.0850, 28.6258], [77.0850, 28.6250]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_6",
      properties: {
        id: "DEL-HZK-A1-05",
        colony: "Hauz Khas",
        address: "A-Block, Hauz Khas Enclave, New Delhi 110016",
        discom: "BRPL",
        division: "HAUZ KHAS",
        fits_kw: 10.0,
        usable_area_sqft: 1400,
        shade: "Unshaded (99% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 99,
        color: "#10b981",
        typical_units: 1400,
        recommended_load_kw: 10.0,
        azimuth: "180° South",
        tilt: "28° Optimal"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.2020, 28.5480], [77.2035, 28.5480], [77.2035, 28.5492],
            [77.2020, 28.5492], [77.2020, 28.5480]
          ]
        ]
      }
    },

    // --- East Delhi (BYPL) ---
    {
      type: "Feature",
      id: "roof_7",
      properties: {
        id: "DEL-MV1-P2-19",
        colony: "Mayur Vihar Phase 1",
        address: "Pocket 2, Mayur Vihar Phase 1, Delhi 110091",
        discom: "BYPL",
        division: "ENKWR",
        fits_kw: 3.0,
        usable_area_sqft: 430,
        shade: "Light Shade (93% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 91,
        color: "#10b981",
        typical_units: 400,
        recommended_load_kw: 3.0,
        azimuth: "180° South",
        tilt: "27°"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.2960, 28.6040], [77.2968, 28.6040], [77.2968, 28.6047],
            [77.2960, 28.6047], [77.2960, 28.6040]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_8",
      properties: {
        id: "DEL-PRV-G1-50",
        colony: "Preet Vihar",
        address: "G-Block, Preet Vihar, Delhi 110092",
        discom: "BYPL",
        division: "PREET VIHAR",
        fits_kw: 5.0,
        usable_area_sqft: 710,
        shade: "Unshaded (97% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 95,
        color: "#10b981",
        typical_units: 800,
        recommended_load_kw: 5.0,
        azimuth: "175° South",
        tilt: "28°"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.2920, 28.6400], [77.2930, 28.6400], [77.2930, 28.6410],
            [77.2920, 28.6410], [77.2920, 28.6400]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_9",
      properties: {
        id: "DEL-LXN-V4-12",
        colony: "Laxmi Nagar",
        address: "Vikas Marg, Laxmi Nagar, Delhi 110092",
        discom: "BYPL",
        division: "LAXMI NAGAR",
        fits_kw: 2.0,
        usable_area_sqft: 260,
        shade: "Dense Adjacent Structures (74% Solar Access)",
        fit_grade: "MARGINAL",
        fit_score: 72,
        color: "#f59e0b",
        typical_units: 250,
        recommended_load_kw: 2.0,
        azimuth: "160° South-East",
        tilt: "24°"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.2760, 28.6310], [77.2768, 28.6310], [77.2768, 28.6318],
            [77.2760, 28.6318], [77.2760, 28.6310]
          ]
        ]
      }
    },

    // --- North / North-West Delhi (TPDDL) ---
    {
      type: "Feature",
      id: "roof_10",
      properties: {
        id: "DEL-ROH-S9-30",
        colony: "Rohini Sector 9",
        address: "Pocket B, Sector 9, Rohini, Delhi 110085",
        discom: "TPDDL",
        division: "ROHINI",
        fits_kw: 3.0,
        usable_area_sqft: 460,
        shade: "Unshaded (98% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 97,
        color: "#10b981",
        typical_units: 450,
        recommended_load_kw: 3.0,
        azimuth: "180° South",
        tilt: "28° Optimal"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.1210, 28.7120], [77.1218, 28.7120], [77.1218, 28.7128],
            [77.1210, 28.7128], [77.1210, 28.7120]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_11",
      properties: {
        id: "DEL-PIT-E2-15",
        colony: "Pitampura",
        address: "ED-Block, Pitampura, Delhi 110034",
        discom: "TPDDL",
        division: "PITAMPURA",
        fits_kw: 4.0,
        usable_area_sqft: 580,
        shade: "Light Shade (92% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 92,
        color: "#10b981",
        typical_units: 600,
        recommended_load_kw: 5.0,
        azimuth: "180° South",
        tilt: "28°"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.1420, 28.7010], [77.1430, 28.7010], [77.1430, 28.7020],
            [77.1420, 28.7020], [77.1420, 28.7010]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_12",
      properties: {
        id: "DEL-BAW-IND-01",
        colony: "Bawana Industrial/Village",
        address: "Main Road, Sector 1, DSIIDC Bawana, Delhi 110039",
        discom: "TPDDL",
        division: "BAWANA",
        fits_kw: 10.0,
        usable_area_sqft: 1600,
        shade: "Unshaded High Aperture (100% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 100,
        color: "#10b981",
        typical_units: 1600,
        recommended_load_kw: 10.0,
        azimuth: "180° South",
        tilt: "29° Optimal"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.0420, 28.7950], [77.0440, 28.7950], [77.0440, 28.7965],
            [77.0420, 28.7965], [77.0420, 28.7950]
          ]
        ]
      }
    },
    {
      type: "Feature",
      id: "roof_13",
      properties: {
        id: "DEL-NAR-V1-09",
        colony: "Narela",
        address: "Pocket 4, Narela Residential, Delhi 110040",
        discom: "TPDDL",
        division: "NARELA",
        fits_kw: 3.0,
        usable_area_sqft: 440,
        shade: "Unshaded (96% Solar Access)",
        fit_grade: "EXCELLENT",
        fit_score: 95,
        color: "#10b981",
        typical_units: 400,
        recommended_load_kw: 3.0,
        azimuth: "180° South",
        tilt: "28°"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.0940, 28.8500], [77.0948, 28.8500], [77.0948, 28.8508],
            [77.0940, 28.8508], [77.0940, 28.8500]
          ]
        ]
      }
    },

    // --- New Delhi (NDMC) ---
    {
      type: "Feature",
      id: "roof_14",
      properties: {
        id: "DEL-CP-KG-02",
        colony: "Connaught Place / KG Marg",
        address: "Curzon Road Court, KG Marg, New Delhi 110001",
        discom: "NDMC",
        division: "CENTRAL",
        fits_kw: 5.0,
        usable_area_sqft: 750,
        shade: "Light Tree Canopy (89% Solar Access)",
        fit_grade: "GOOD",
        fit_score: 87,
        color: "#10b981",
        typical_units: 800,
        recommended_load_kw: 5.0,
        azimuth: "180° South",
        tilt: "28°"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.2250, 28.6250], [77.2260, 28.6250], [77.2260, 28.6260],
            [77.2250, 28.6260], [77.2250, 28.6250]
          ]
        ]
      }
    }
  ]
};
