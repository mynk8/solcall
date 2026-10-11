/**
 * SolCall - MapLibre GL JS Module (Screen 1 & 2)
 * Renders high-performance WebGL map of Delhi with DISCOM boundaries,
 * residential rooftop solar polygons, and interactive Roof Card inspection.
 */

let solcallMap = null;
let selectedRoofFeature = null;

function initSolCallMap() {
  const mapContainer = document.getElementById("maplibre-map-container");
  if (!mapContainer) return;

  // Initialize MapLibre GL Map with Dark Matter vector style
  solcallMap = new maplibregl.Map({
    container: "maplibre-map-container",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    center: [77.1800, 28.6200], // Delhi center
    zoom: 11.2,
    pitch: 42, // 3D perspective pitch
    bearing: -15,
    maxBounds: [
      [76.70, 28.30], // Southwest
      [77.60, 28.95]  // Northeast
    ]
  });

  // Add standard navigation controls
  solcallMap.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  solcallMap.addControl(new maplibregl.FullscreenControl(), "top-right");

  solcallMap.on("load", () => {
    setupMapLayers();
    // Default select first sample roof
    if (DELHI_ROOFTOPS_DATA.features.length > 0) {
      selectRoof(DELHI_ROOFTOPS_DATA.features[0]);
    }
  });
}

function setupMapLayers() {
  // 1. DISCOM Boundaries Source & Layers
  solcallMap.addSource("delhi-discoms", {
    type: "geojson",
    data: DELHI_DISCOM_BOUNDARIES
  });

  solcallMap.addLayer({
    id: "discoms-fill",
    type: "fill",
    source: "delhi-discoms",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.08
    }
  });

  solcallMap.addLayer({
    id: "discoms-border",
    type: "line",
    source: "delhi-discoms",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 2,
      "line-dasharray": [2, 2],
      "line-opacity": 0.6
    }
  });

  // 2. Rooftops Source & Layers
  solcallMap.addSource("delhi-rooftops", {
    type: "geojson",
    data: DELHI_ROOFTOPS_DATA
  });

  // Extruded 3D Roof Polygons
  solcallMap.addLayer({
    id: "rooftops-fill",
    type: "fill-extrusion",
    source: "delhi-rooftops",
    paint: {
      "fill-extrusion-color": [
        "match",
        ["get", "fit_grade"],
        "EXCELLENT", "#10b981",
        "GOOD", "#f59e0b",
        "MARGINAL", "#64748b",
        "#10b981"
      ],
      "fill-extrusion-height": 22,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.88
    }
  });

  // Roof Border line
  solcallMap.addLayer({
    id: "rooftops-outline",
    type: "line",
    source: "delhi-rooftops",
    paint: {
      "line-color": "#ffffff",
      "line-width": 1.5,
      "line-opacity": 0.7
    }
  });

  // Selected Roof Highlight Layer
  solcallMap.addLayer({
    id: "roof-selected-glow",
    type: "line",
    source: "delhi-rooftops",
    paint: {
      "line-color": "#facc15", // Electric solar yellow
      "line-width": 4,
      "line-opacity": 1
    },
    filter: ["==", "id", ""]
  });

  // 3. Popup on hover
  const hoverPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: "map-hover-popup"
  });

  solcallMap.on("mousemove", "rooftops-fill", (e) => {
    solcallMap.getCanvas().style.cursor = "pointer";
    if (e.features.length > 0) {
      const feat = e.features[0];
      const p = feat.properties;
      const html = `
        <div class="popup-box">
          <div class="popup-title">${p.colony}</div>
          <div class="popup-sub">${p.id} • ${p.discom}</div>
          <div class="popup-badge" style="background: ${p.fit_grade === 'EXCELLENT' ? '#065f46' : '#92400e'}">
            Solar Fit: ${p.fit_grade} (${p.fit_score}/100)
          </div>
          <div class="popup-detail"><strong>Capacity:</strong> Fits ${p.fits_kw} kW (${p.usable_area_sqft} sq ft)</div>
          <div class="popup-detail"><strong>Shade:</strong> ${p.shade}</div>
        </div>
      `;
      hoverPopup.setLngLat(e.lngLat).setHTML(html).addTo(solcallMap);
    }
  });

  solcallMap.on("mouseleave", "rooftops-fill", () => {
    solcallMap.getCanvas().style.cursor = "";
    hoverPopup.remove();
  });

  // 4. Click to inspect roof
  solcallMap.on("click", "rooftops-fill", (e) => {
    if (e.features.length > 0) {
      const clickedFeat = e.features[0];
      selectRoof(clickedFeat);
    }
  });
}

function selectRoof(feature) {
  selectedRoofFeature = feature;
  const p = feature.properties;

  // Highlight roof polygon on map
  if (solcallMap && solcallMap.getLayer("roof-selected-glow")) {
    solcallMap.setFilter("roof-selected-glow", ["==", "id", p.id]);
  }

  // Smooth camera fly to roof
  if (feature.geometry && feature.geometry.coordinates) {
    const coords = feature.geometry.coordinates[0];
    const centerLng = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
    const centerLat = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;

    solcallMap.flyTo({
      center: [centerLng, centerLat],
      zoom: 15.5,
      pitch: 55,
      bearing: -20,
      duration: 1200
    });
  }

  // Update Roof Card UI (Screen 2)
  updateRoofCardUI(p);
}

function updateRoofCardUI(p) {
  // Update header labels
  document.getElementById("roof-id-badge").textContent = p.id;
  document.getElementById("roof-colony-title").textContent = p.colony;
  document.getElementById("roof-address-text").textContent = p.address;
  document.getElementById("roof-discom-badge").textContent = `${p.discom} (${p.division})`;
  document.getElementById("roof-fit-badge").textContent = `${p.fit_grade} (${p.fit_score}/100)`;

  // Update physical specs
  document.getElementById("roof-capacity-val").textContent = `${p.fits_kw} kW`;
  document.getElementById("roof-area-val").textContent = `${p.usable_area_sqft} sq ft`;
  document.getElementById("roof-shade-val").textContent = p.shade;
  document.getElementById("roof-azimuth-val").textContent = `${p.azimuth} (${p.tilt})`;

  // Render Reference Price Ladder for this exact size (AGENT_SPEC.md §5)
  renderRoofPriceLadder(p.fits_kw);

  // Render Usage Band Outcomes (200, 400, 600, 800 units)
  renderUsageBandOutcomes(p.fits_kw, p.recommended_load_kw || p.fits_kw);
}

function renderRoofPriceLadder(sizeKw) {
  const container = document.getElementById("roof-price-ladder-container");
  if (!container) return;

  // Compute rungs for this exact size using Layer 3 math
  const benchmarkCost = 50000 * Math.min(sizeKw, 2) + 45000 * Math.max(sizeKw - 2, 0);
  const centralSub = 30000 * Math.min(sizeKw, 2) + 18000 * Math.min(Math.max(sizeKw - 2, 0), 1);
  const stateSub = Math.min(26000 * Math.min(sizeKw, 3), 78000, benchmarkCost - centralSub);
  const netBenchmark = Math.max(0, benchmarkCost - centralSub - stateSub);

  // Market observation ranges from AGENT_SPEC.md §3 (unpooled)
  let marketMed = 0;
  let marketLow = 0;
  let marketHigh = 0;
  let obsCount = "n=1";

  if (sizeKw === 2) {
    marketMed = 195000; marketLow = 195000; marketHigh = 195000; obsCount = "n=1 (MKT_SS)";
  } else if (sizeKw === 3) {
    marketMed = 227500; marketLow = 198000; marketHigh = 240000; obsCount = "n=2 (SolarSquare, HeavenGreen)";
  } else if (sizeKw === 4) {
    marketMed = 273000; marketLow = 273000; marketHigh = 273000; obsCount = "n=1 (MKT_SS)";
  } else if (sizeKw === 5) {
    marketMed = 305000; marketLow = 258000; marketHigh = 330000; obsCount = "n=2 (SolarSquare, HeavenGreen)";
  } else if (sizeKw === 10) {
    marketMed = 519000; marketLow = 403000; marketHigh = 593000; obsCount = "n=2 (SolarSquare, HeavenGreen)";
  } else {
    marketMed = benchmarkCost * 1.35; marketLow = benchmarkCost * 1.25; marketHigh = benchmarkCost * 1.45;
  }

  const netMarketMed = Math.max(0, marketMed - centralSub - Math.min(26000 * Math.min(sizeKw, 3), 78000, marketMed - centralSub));
  const histTpddl = (sizeKw <= 3 ? 39000 : 37500) * sizeKw;

  container.innerHTML = `
    <div class="rung-card benchmark-rung">
      <div class="rung-header">
        <span class="rung-tag t1-tag">T1 Govt Benchmark</span>
        <span class="rung-name">PM Surya Ghar</span>
      </div>
      <div class="rung-price">₹${benchmarkCost.toLocaleString("en-IN")}</div>
      <div class="rung-net">Net Cost after Subsidies: <span class="highlight-net">₹${netBenchmark.toLocaleString("en-IN")}</span></div>
      <div class="rung-subtext">Central CFA: ₹${centralSub.toLocaleString("en-IN")} • Delhi: ₹${stateSub.toLocaleString("en-IN")}</div>
    </div>

    <div class="rung-card market-rung">
      <div class="rung-header">
        <span class="rung-tag t3-tag">T3 Market (${obsCount})</span>
        <span class="rung-name">Delhi Installer Median</span>
      </div>
      <div class="rung-price">₹${Math.round(marketMed).toLocaleString("en-IN")}</div>
      <div class="rung-net">Net Consumer Cost: <span class="highlight-net">₹${Math.round(netMarketMed).toLocaleString("en-IN")}</span></div>
      <div class="rung-subtext">Observed Range: ₹${marketLow.toLocaleString("en-IN")} – ₹${marketHigh.toLocaleString("en-IN")}</div>
    </div>

    <div class="rung-card history-rung">
      <div class="rung-header">
        <span class="rung-tag t1-tag">T1 Historical</span>
        <span class="rung-name">TPDDL Residential Scheme</span>
      </div>
      <div class="rung-price">₹${histTpddl.toLocaleString("en-IN")}</div>
      <div class="rung-net">Base rate excl. GST: ₹${(histTpddl/sizeKw).toLocaleString("en-IN")}/kW</div>
      <div class="rung-subtext">Empanelled utility tender archive</div>
    </div>
  `;
}

function renderUsageBandOutcomes(sizeKw, loadKw) {
  const container = document.getElementById("usage-bands-container");
  if (!container) return;

  const usageBands = [200, 400, 600, 800];
  let html = `<div class="usage-band-table-wrap"><table class="usage-table">
    <thead>
      <tr>
        <th>Monthly Units</th>
        <th>Bill Before</th>
        <th>Bill With Solar</th>
        <th>Yearly Savings</th>
        <th>Verdict</th>
      </tr>
    </thead>
    <tbody>`;

  usageBands.forEach((units) => {
    // Exact Layer 3 math simulation
    const evalData = simulateHouseholdQuick(units, loadKw, sizeKw);
    html += `
      <tr>
        <td><strong>${units} kWh</strong></td>
        <td>₹${Math.round(evalData.billBefore).toLocaleString("en-IN")}</td>
        <td>₹${Math.round(evalData.billWith).toLocaleString("en-IN")}</td>
        <td class="savings-col">+₹${Math.round(evalData.yearSavings).toLocaleString("en-IN")}</td>
        <td><span class="badge badge-${evalData.verdict.toLowerCase()}">${evalData.verdict}</span></td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// Quick in-browser mathematical solver mirroring Layer 3 Domain Service
function simulateHouseholdQuick(units, loadKw, sizeKw) {
  const m = 1.369596; // Fitted multiplier
  const annualSpecific = 1466 * 0.95; // 1392.7 kWh/kWp
  const monthlyGen = (sizeKw * annualSpecific) / 12;

  // Bill Before Solar
  const energyBefore = calcEnergyCharge(units);
  const fixedRate = loadKw <= 2 ? 20 : (loadKw <= 5 ? 50 : 100);
  const fixedCharge = fixedRate * loadKw;
  const grossBill = m * (energyBefore + fixedCharge);

  let subsidyBefore = 0;
  if (units <= 200) subsidyBefore = grossBill;
  else if (units <= 400) subsidyBefore = Math.min(0.5 * grossBill, 800, grossBill);

  const billBefore = Math.max(0, grossBill - subsidyBefore);

  // Bill After Solar (monthly netting)
  const netUnits = Math.max(0, units - monthlyGen);
  const energyAfter = calcEnergyCharge(netUnits);
  const netBillBeforeSub = m * (energyAfter + fixedCharge);

  // Delhi subsidy class decided on GROSS units!
  let subsidyAfter = 0;
  if (units <= 200) subsidyAfter = netBillBeforeSub;
  else if (units <= 400) subsidyAfter = Math.min(0.5 * grossBill, 800, netBillBeforeSub);

  const billWith = Math.max(0, netBillBeforeSub - subsidyAfter);

  const monthlyReduction = billBefore - billWith;
  const yearSavings = monthlyReduction * 12;

  // Capital Cost
  const benchmarkCost = 50000 * Math.min(sizeKw, 2) + 45000 * Math.max(sizeKw - 2, 0);
  const centralSub = 30000 * Math.min(sizeKw, 2) + 18000 * Math.min(Math.max(sizeKw - 2, 0), 1);
  const stateSub = Math.min(26000 * Math.min(sizeKw, 3), 78000, benchmarkCost - centralSub);
  const netCost = Math.max(0, benchmarkCost - centralSub - stateSub);

  const payback = netCost === 0 ? 0 : (netCost / yearSavings);

  let verdict = "GO";
  if (yearSavings <= 0) verdict = "NOT_WORTH";
  else if (units <= 200 && sizeKw <= 3) verdict = "GO_FREE";
  else if (payback <= 7.0) verdict = "GO";
  else verdict = "MARGINAL";

  return {
    billBefore,
    billWith,
    yearSavings,
    verdict,
    payback
  };
}

function calcEnergyCharge(u) {
  let ec = 0;
  if (u <= 200) ec = u * 3.0;
  else if (u <= 400) ec = 200 * 3.0 + (u - 200) * 4.5;
  else if (u <= 800) ec = 200 * 3.0 + 200 * 4.5 + (u - 400) * 6.5;
  else if (u <= 1200) ec = 200 * 3.0 + 200 * 4.5 + 400 * 6.5 + (u - 800) * 7.0;
  else ec = 200 * 3.0 + 200 * 4.5 + 400 * 6.5 + 400 * 7.0 + (u - 1200) * 8.0;
  return ec;
}

// Filter map by DISCOM
function filterMapDiscom(discomCode) {
  if (!solcallMap) return;

  if (discomCode === "ALL") {
    solcallMap.setFilter("rooftops-fill", null);
    solcallMap.setFilter("rooftops-outline", null);
    solcallMap.flyTo({ center: [77.1800, 28.6200], zoom: 11.2, pitch: 42 });
  } else {
    solcallMap.setFilter("rooftops-fill", ["==", "discom", discomCode]);
    solcallMap.setFilter("rooftops-outline", ["==", "discom", discomCode]);

    const centers = {
      BRPL: [77.16, 28.55],
      BYPL: [77.29, 28.63],
      TPDDL: [77.12, 28.74],
      NDMC: [77.21, 28.61]
    };
    if (centers[discomCode]) {
      solcallMap.flyTo({ center: centers[discomCode], zoom: 12.5, pitch: 48, duration: 1400 });
    }
  }
}

// Transfer current roof to Bill Calculator (Screen 3)
function transferRoofToCalculator() {
  if (!selectedRoofFeature) return;
  const p = selectedRoofFeature.properties;

  // Pre-fill calculator inputs
  const unitsInput = document.getElementById("calc-units-input");
  const loadInput = document.getElementById("calc-load-input");
  const sizeInput = document.getElementById("calc-size-input");

  if (unitsInput) unitsInput.value = p.typical_units || 450;
  if (loadInput) loadInput.value = p.recommended_load_kw || p.fits_kw;
  if (sizeInput) sizeInput.value = p.fits_kw;

  // Switch to Screen 3
  switchScreen("screen-calculator");
  if (typeof runCalculatorSimulation === "function") {
    runCalculatorSimulation();
  }
}
