/**
 * SolCall - Delhi Solar Reference Price Index (Screen 5)
 * Renders the unpooled reference price ladder table, DISCOM application counts,
 * and surcharge tracking series with full provenance tiers.
 */

async function initReferenceIndex() {
  loadReferenceTable();
  loadDiscomStats();
  loadSurchargeHistory();
}

function loadReferenceTable() {
  const tbody = document.getElementById("reference-table-body");
  if (!tbody) return;

  const ladderData = [
    {
      size: 1.0,
      benchmark: 50000,
      mktLow: "-",
      mktMed: "-",
      mktHigh: "-",
      histTpddl: 39000,
      central: 30000,
      state: 20000,
      netBenchmark: 0,
      n: "n=0 (Bench only)",
      tier: "T1"
    },
    {
      size: 2.0,
      benchmark: 100000,
      mktLow: 195000,
      mktMed: 195000,
      mktHigh: 195000,
      histTpddl: 78000,
      central: 60000,
      state: 40000,
      netBenchmark: 0,
      n: "n=1 (MKT_SS)",
      tier: "T3"
    },
    {
      size: 3.0,
      benchmark: 145000,
      mktLow: 198000,
      mktMed: 227500,
      mktHigh: 240000,
      histTpddl: 117000,
      central: 78000,
      state: 67000,
      netBenchmark: 0,
      n: "n=2 (SS, HG)",
      tier: "T3"
    },
    {
      size: 4.0,
      benchmark: 190000,
      mktLow: 273000,
      mktMed: 273000,
      mktHigh: 273000,
      histTpddl: 150000,
      central: 78000,
      state: 78000,
      netBenchmark: 34000,
      n: "n=1 (MKT_SS)",
      tier: "T3"
    },
    {
      size: 5.0,
      benchmark: 235000,
      mktLow: 258000,
      mktMed: 305000,
      mktHigh: 330000,
      histTpddl: 187500,
      central: 78000,
      state: 78000,
      netBenchmark: 79000,
      n: "n=2 (SS, HG)",
      tier: "T3"
    },
    {
      size: 10.0,
      benchmark: 460000,
      mktLow: 403000,
      mktMed: 519000,
      mktHigh: 593000,
      histTpddl: 375000,
      central: 78000,
      state: 78000,
      netBenchmark: 304000,
      n: "n=2 (SS, HG)",
      tier: "T3"
    }
  ];

  tbody.innerHTML = ladderData.map(r => `
    <tr>
      <td><strong>${r.size} kW</strong></td>
      <td class="font-mono">₹${r.benchmark.toLocaleString("en-IN")}</td>
      <td class="font-mono">${typeof r.mktLow === "number" ? "₹" + r.mktLow.toLocaleString("en-IN") : "-"}</td>
      <td class="font-mono text-amber"><strong>${typeof r.mktMed === "number" ? "₹" + r.mktMed.toLocaleString("en-IN") : "-"}</strong></td>
      <td class="font-mono">${typeof r.mktHigh === "number" ? "₹" + r.mktHigh.toLocaleString("en-IN") : "-"}</td>
      <td class="font-mono">₹${r.central.toLocaleString("en-IN")}</td>
      <td class="font-mono">₹${r.state.toLocaleString("en-IN")}</td>
      <td class="font-mono text-emerald"><strong>₹${r.netBenchmark.toLocaleString("en-IN")}</strong></td>
      <td><span class="badge ${r.tier === 'T1' ? 'badge-t1' : 'badge-t3'}">${r.n}</span></td>
    </tr>
  `).join("");
}

function loadDiscomStats() {
  const container = document.getElementById("discom-stats-container");
  if (!container) return;

  const discoms = [
    { code: "BRPL", name: "BSES Rajdhani (South/West)", apps: 25456, divisions: 23, top: "W1JFR (10,392 apps)" },
    { code: "BYPL", name: "BSES Yamuna (East/Central)", apps: 27786, divisions: 14, top: "ENKWR (3,565 apps)" },
    { code: "TPDDL", name: "Tata Power Delhi (North)", apps: 28070, divisions: 12, top: "BAWANA (5,490 apps)" }
  ];

  container.innerHTML = discoms.map(d => `
    <div class="stat-card">
      <div class="stat-header">
        <span class="discom-pill discom-${d.code.toLowerCase()}">${d.code}</span>
        <span class="stat-sub">${d.divisions} Divisions</span>
      </div>
      <div class="stat-num">${d.apps.toLocaleString("en-IN")}</div>
      <div class="stat-label">Applications Logged</div>
      <div class="stat-footer">Top Division: <strong>${d.top}</strong></div>
    </div>
  `).join("");
}

function loadSurchargeHistory() {
  const container = document.getElementById("surcharge-history-container");
  if (!container) return;

  const rates = [
    { period: "Jun 2026 onwards", pct: "10.00%", status: "Latest Active" },
    { period: "Feb 2026 – May 2026", pct: "8.75%", status: "Historical" },
    { period: "Nov 2025 – Jan 2026", pct: "5.76%", status: "Historical" },
    { period: "Aug 2025 – Oct 2025", pct: "6.73%", status: "Historical" },
    { period: "May 2025 – Jul 2025", pct: "6.19%", status: "Historical" }
  ];

  container.innerHTML = `
    <div class="surcharge-box">
      <div class="surcharge-headline">
        <span class="surcharge-val">10.00%</span>
        <span class="surcharge-period">Current PPAC Surcharge (BRPL)</span>
      </div>
      <p class="surcharge-note">Power Purchase Adjustment Cost (PPAC) applies to energy + fixed charges. Absorbed automatically into SolCall's fitted billing multiplier <em>m</em> = 1.3696.</p>
      <div class="surcharge-timeline">
        ${rates.map(r => `
          <div class="timeline-row">
            <span class="timeline-period">${r.period}</span>
            <span class="timeline-pct">${r.pct}</span>
            <span class="timeline-badge">${r.status}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}
