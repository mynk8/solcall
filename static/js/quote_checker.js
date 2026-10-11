/**
 * SolCall - Deal & Installer Quote Checker (Screen 4)
 * Validates private installer quotations against the unpooled
 * Delhi Solar Reference Price ladder, flags GST/DCR risks, and guides decisions.
 */

function initQuoteChecker() {
  const form = document.getElementById("quote-checker-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      evaluateInstallerQuote();
    });
  }

  const sizeSelect = document.getElementById("quote-size-select");
  if (sizeSelect) {
    sizeSelect.addEventListener("change", evaluateInstallerQuote);
  }
}

function evaluateInstallerQuote() {
  const sizeKw = parseFloat(document.getElementById("quote-size-select").value) || 3.0;
  const quotedPrice = parseFloat(document.getElementById("quote-price-input").value) || 240000;
  const installerName = document.getElementById("quote-vendor-input").value || "Installer";
  const dcrStatus = document.getElementById("quote-dcr-select").value;
  const gstStatus = document.getElementById("quote-gst-select").value;

  // Reference medians per size (unpooled, AGENT_SPEC.md §3)
  const referenceData = {
    1: { benchmark: 50000, median: 68000, low: 60000, high: 75000, central: 30000, state: 26000 },
    2: { benchmark: 100000, median: 195000, low: 195000, high: 195000, central: 60000, state: 52000 },
    3: { benchmark: 145000, median: 227500, low: 198000, high: 240000, central: 78000, state: 78000 },
    4: { benchmark: 190000, median: 273000, low: 273000, high: 273000, central: 78000, state: 78000 },
    5: { benchmark: 235000, median: 305000, low: 258000, high: 330000, central: 78000, state: 78000 },
    10: { benchmark: 460000, median: 519000, low: 403000, high: 593000, central: 78000, state: 78000 }
  };

  const ref = referenceData[sizeKw] || referenceData[3];
  const diffFromMedian = quotedPrice - ref.median;
  const pctFromMedian = (diffFromMedian / ref.median) * 100;

  // Deal Classification
  let dealBadge = "FAIR DEAL";
  let dealClass = "deal-fair";
  let dealSummary = "";

  if (pctFromMedian < -5) {
    dealBadge = "BARGAIN DEAL";
    dealClass = "deal-bargain";
    dealSummary = `This quote is ₹${Math.abs(Math.round(diffFromMedian)).toLocaleString("en-IN")} (${Math.abs(pctFromMedian).toFixed(1)}%) below the Delhi market median. Verify installer warranty and hardware quality before signing.`;
  } else if (pctFromMedian > 8) {
    dealBadge = "OVERPRICED";
    dealClass = "deal-overpriced";
    dealSummary = `This quote is ₹${Math.round(diffFromMedian).toLocaleString("en-IN")} (+${pctFromMedian.toFixed(1)}%) above the Delhi Solar Reference Median. You have room to negotiate down towards ₹${ref.median.toLocaleString("en-IN")}.`;
  } else {
    dealBadge = "FAIR MARKET DEAL";
    dealClass = "deal-fair";
    dealSummary = `This quote aligns within ±${Math.abs(pctFromMedian).toFixed(1)}% of typical Delhi vendor pricing (Median: ₹${ref.median.toLocaleString("en-IN")}).`;
  }

  // Net cost after central & state subsidies
  const claimableCentral = (dcrStatus === "no") ? 0 : ref.central;
  const claimableState = Math.min(ref.state, Math.max(0, quotedPrice - claimableCentral));
  const estimatedNetCost = Math.max(0, quotedPrice - claimableCentral - claimableState);

  // Render Deal Verdict Card
  const resultCard = document.getElementById("quote-result-card");
  if (!resultCard) return;

  resultCard.style.display = "block";
  resultCard.innerHTML = `
    <div class="deal-evaluation-box ${dealClass}">
      <div class="deal-header-row">
        <div>
          <span class="deal-badge-pill ${dealClass}">${dealBadge}</span>
          <h3 class="deal-vendor-title">${installerName} — ${sizeKw} kW Proposal</h3>
        </div>
        <div class="deal-quoted-cost">
          <div class="deal-quoted-num">₹${quotedPrice.toLocaleString("en-IN")}</div>
          <div class="deal-quoted-sub">Quoted Total Gross</div>
        </div>
      </div>

      <p class="deal-summary-text">${dealSummary}</p>

      <div class="deal-metrics-grid">
        <div class="deal-metric-tile">
          <div class="deal-tile-label">Delhi Reference Median</div>
          <div class="deal-tile-val">₹${ref.median.toLocaleString("en-IN")}</div>
          <div class="deal-tile-sub">Observed Range: ₹${ref.low.toLocaleString("en-IN")} – ₹${ref.high.toLocaleString("en-IN")}</div>
        </div>
        <div class="deal-metric-tile">
          <div class="deal-tile-label">Govt Benchmark (PMSG)</div>
          <div class="deal-tile-val">₹${ref.benchmark.toLocaleString("en-IN")}</div>
          <div class="deal-tile-sub">₹${(ref.benchmark/sizeKw).toLocaleString("en-IN")}/kW Standard</div>
        </div>
        <div class="deal-metric-tile">
          <div class="deal-tile-label">Net Cost to You (After Subsidies)</div>
          <div class="deal-tile-val text-emerald">₹${estimatedNetCost.toLocaleString("en-IN")}</div>
          <div class="deal-tile-sub">Central: ₹${claimableCentral.toLocaleString("en-IN")} • State: ₹${claimableState.toLocaleString("en-IN")}</div>
        </div>
      </div>

      <!-- Compliance Risk Alerts -->
      <div class="deal-alerts-section">
        ${dcrStatus === "no" ? `
          <div class="alert-box alert-danger">
            <strong>⚠️ DCR Non-Compliance Risk:</strong> You indicated this quote does not use Domestic Content Requirement (DCR) panels. Under PM Surya Ghar rules, <strong>zero Central CFA subsidy (₹${ref.central.toLocaleString("en-IN")}) will be disbursed</strong> without DCR certification!
          </div>
        ` : `
          <div class="alert-box alert-success">
            <strong>✓ DCR Certified:</strong> Fully eligible for ₹${ref.central.toLocaleString("en-IN")} PM Surya Ghar Central subsidy.
          </div>
        `}

        ${gstStatus === "no" ? `
          <div class="alert-box alert-warning">
            <strong>⚠️ Hidden GST Exposure:</strong> If this quote excludes 13.8% GST, expect an additional ₹${Math.round(quotedPrice * 0.138).toLocaleString("en-IN")} added to your final invoice. Ensure the quote is GST-inclusive.
          </div>
        ` : ""}
      </div>

      <div class="deal-actions-row">
        <a href="https://solar.delhi.gov.in" target="_blank" class="btn btn-primary">
          Verify on Delhi Solar Portal ↗
        </a>
        <button class="btn btn-secondary" onclick="transferQuoteToCalculator(${sizeKw}, ${quotedPrice})">
          Simulate Exact Payback with This Quote
        </button>
      </div>
    </div>
  `;
}

function transferQuoteToCalculator(sizeKw, price) {
  const sizeInput = document.getElementById("calc-size-input");
  if (sizeInput) sizeInput.value = sizeKw;

  switchScreen("screen-calculator");
  if (typeof runCalculatorSimulation === "function") {
    runCalculatorSimulation();
  }
}
