# AGENT_SPEC.md — Delhi Rooftop Solar Reference Price + Household Feeds

Build exactly this. Plain Python 3.12, standard library + numpy. No LLM anywhere. No web framework.
Every number comes from a source listed here or from a scraper below. Values marked **VERIFY** are
placeholders: keep them, label them, never replace them with guesses.

---

## 1. Goal

1. **Core feed:** a reference price for rooftop solar in Delhi, per system size, kept as separate rungs.
2. **Household feeds:** for every household group, what solar costs them and what it is worth to them.
3. Supporting feeds that make 1 and 2 correct: solar output, money rates, surcharge history, adoption by division.

No forecasts. Tariffs are held flat for 25 years (conservative: rising tariffs only help solar).

---

## 2. Sources (all opened and checked on 2026-10-11)

| ID | Source | URL | Tier |
|---|---|---|---|
| TARIFF | Delhi domestic tariff schedule FY2020-21 (latest found) | https://tatapower-ddl.com/Editor_UploadedDocuments/Content/Tariff_Schedule_2020-21.pdf | T1 |
| AMEND2 | Delhi Solar Energy Policy 2023, 2nd amendment (17 Sep 2026) | https://solar.delhi.gov.in/public/assets/solar/delhi_solar_energy_policy_2023_second_amendment.pdf | T1 |
| STATE_SUB | Delhi state subsidy page | https://solar.delhi.gov.in/page/state-subsidy | T1 |
| PMSG | PM Surya Ghar guidelines, residential CFA, capex mode | https://solar.delhi.gov.in/public/assets/solar/PMSG_Guidelines_for_Residential_CFA_Capex_Mode.pdf | T1 |
| NETMETER | DERC Net Metering Regulations 2014 | https://solar.delhi.gov.in/public/assets/solar/1.%20Renewable-Energy-Net-Metering-Regulations2014.pdf | T1 |
| PPAC_FAQ | TPDDL PPAC FAQ (PPAC applies to energy + fixed charges) | https://tatapower-ddl.com/Editor_UploadedDocuments/Content/PPAC_FAQs.pdf | T1 |
| TPDDL_HIST | TPDDL residential scheme (older empanelled rates) | https://tatapower-ddl.com/applysolarportal/Solar%20Subsidy%20Scheme-Residential%20Customers.pdf | T1 |
| APPS | Delhi Solar Portal applications by division (CSV) | https://solar.delhi.gov.in/applications/division-wise/download | T1 |
| BRPL_SURCH | BRPL PPAC / FPPAS page | https://www.bsesdelhi.com/web/brpl/fuel-power-purchase-adjustment-charges | T1 |
| RBI | RBI homepage, "Current Rates" | https://www.rbi.org.in | T1 |
| GSA | Global Solar Atlas point API (World Bank / Solargis; GIS data CC BY 4.0) | https://api.globalsolaratlas.info/data/lta?loc=LAT,LON | T2 |
| MKT_SS | SolarSquare Delhi price page (updated 8 Oct 2026) | https://solarsquare.in/blog/solar-panel-price-in-delhi/ | T3 |
| MKT_HG | Heaven Green Energy Delhi cost page (updated 7 Aug 2026) | https://www.heavengreenenergy.com/blog/solar-cost-delhi | T3 |
| NM_VENDOR | Vendor summary of Delhi net metering (surplus ₹3–4) | https://bridgewaypower.in/blog/net-metering-delhi-2026-how-to-apply | T3 |

Tier: T1 = government / regulator / DISCOM / RBI. T2 = World Bank-grade data. T3 = vendor page (indicative only).

---

## 3. Rules as data (`data/delhi_rules.json`)

Store every value as `{value, unit, source, tier, as_of, verify, note}`.

| Key | Value | Source |
|---|---|---|
| tariff.energy_slabs | [≤200: ₹3.00, 201–400: ₹4.50, 401–800: ₹6.50, 801–1200: ₹7.00, >1200: ₹8.00] per unit | TARIFF (VERIFY with a current bill) |
| tariff.fixed_charge_bands | ≤2 kW: ₹20/kW, >2–5: ₹50/kW, >5–15: ₹100/kW, >15–25: ₹200/kW, >25: ₹250/kW per month | TARIFF |
| tariff.bill_calibration_points | {400 units, 3 kW load → ₹2,272}, {100 units, 3 kW load → ₹613} (bills before subsidy) | AMEND2 worked examples |
| power_subsidy | basis = **gross** consumption; ≤200 → 100% of net bill; 201–400 → min(50% × bill(gross), ₹800); >400 → 0 | AMEND2 cl. 4.14 + examples |
| under200_incentive | 50% × units self-used × ₹3, paid yearly | AMEND2 example (VERIFY rule text) |
| net_metering | monthly netting; surplus carried forward; unadjusted credit paid at year end (Apr–Mar); system ≤ sanctioned load; min 1 kW | NETMETER reg 5, 9 |
| net_metering.surplus_rate | ₹3.5/unit conservative (VERIFY); alternative ₹6.5 from policy example | NM_VENDOR / AMEND2 |
| central_subsidy | ₹30,000/kW up to 2 kW + ₹18,000 for 3rd kW; cap ₹78,000; DCR panels required | PMSG |
| delhi_subsidy | min(₹26,000 × min(k, 3), ₹78,000, cost − central) | AMEND2, STATE_SUB |
| free_scheme | previous-FY average **gross** ≤ 400 units/month, ≤ 3 kW, zero cost; operational = false (VERIFY) | AMEND2 |
| ula_consumer_cap | ₹5,000/kW | AMEND2 |
| benchmark_cost | ₹50,000/kW up to 2 kW, ₹45,000/kW beyond (incl. 5-yr maintenance; GST treatment VERIFY) | PMSG |
| loan rule | repo + 0.50% for systems up to 3 kW | PMSG |
| free maintenance | 5 years | PMSG |
| yield.extra_losses | 5% (ASSUMPTION: Delhi dust/haze) | — |
| yield.degradation | 0.5%/year (ASSUMPTION) | — |
| finance.life_years | 25 (ASSUMPTION) | — |
| finance.loan_years | 10 (ASSUMPTION, VERIFY) | — |
| finance.om_after_free | ₹600/kW/year (ASSUMPTION, VERIFY) | — |
| finance.inverter_replacement | year 12, ₹8,000/kW (ASSUMPTION, VERIFY) | — |
| decision thresholds | spread ≥ ₹1/unit, discounted payback ≤ 7 yrs, DSCR ≥ 1.2 (ASSUMPTION) | — |

Price observations (`data/price_observations.json`), before subsidy:

| Size | Value | Source | Notes |
|---|---|---|---|
| 2 kW | ₹1,95,000 | MKT_SS | DCR, GST unknown, page shows stale Delhi subsidy |
| 3 kW | ₹2,40,000 | MKT_SS | same |
| 4 kW | ₹2,73,000 | MKT_SS | same |
| 5 kW | ₹3,30,000 | MKT_SS | same |
| 10 kW | ₹5,93,000 | MKT_SS | same |
| 3 kW | ₹1,98,000–2,33,000 | MKT_HG | DCR unknown, GST unknown |
| 5 kW | ₹2,58,000–3,03,000 | MKT_HG | same |
| 10 kW | ₹4,03,000–4,88,000 | MKT_HG | same |
| 1–3 kW | ₹39,000/kW excl. GST | TPDDL_HIST | history only, undated |
| 3.1–10 kW | ₹37,500/kW excl. GST | TPDDL_HIST | history only, undated |

---

## 4. Scrapers (each writes a JSON feed to `out/` and keeps the raw file in `data/raw/`)

### 4.1 Applications by division — `out/applications_by_division.json`
- **Source:** APPS. Daily.
- **Method:** GET CSV. Structure: title line; `"As on","DD-MM-YYYY HH:MM"`; then per DISCOM: a line `BRPL` / `BYPL` / `TPDDL`, header `S.No.,Division,Applications`, rows `n,DIVISION,count`, then `,"BRPL Total",N`; finally `,"Grand Total",N`. Tolerate an extra leading DISCOM column.
- **Check:** rows sum = each DISCOM total; DISCOM totals sum = grand total. Fail loudly otherwise.
- **Model:** `share_in_discom = applications / discom_total`; `rank_in_discom`; `change_since_previous` when the previous snapshot has a different "As on".
- **Test fixture:** as on 11-10-2026 02:35: BRPL 24,864 (23 divisions, top W1JFR 10,294), BYPL 27,515 (14, top ENKWR 3,556), TPDDL 27,461 (12, top BAWANA 5,372), grand 79,840.

### 4.2 Money rates — `out/money_rates.json`
- **Source:** RBI. Weekly.
- **Method:** GET HTML → strip tags → regex `Policy Repo Rate … (\d+\.\d+)%` and `Term Deposit Rate > 1 Year … (x)% - (y)%`.
- **Model:** `scheme_loan_rate = repo + 0.50%`; `cash_opportunity_rate = y` (top of the deposit range; conservative).
- **Test fixture (9 Oct 2026):** repo 5.50% → loan 6.00%; term deposit 6.00–6.75% → cash rate 6.75%.

### 4.3 Delhi solar output — `out/delhi_solar_yield.json`
- **Source:** GSA, five points: Central (28.6139, 77.2090), Narela (28.85, 77.09), Dwarka (28.59, 77.05), Mayur Vihar (28.61, 77.29), Saket (28.52, 77.21). Run once; cache. Attribute World Bank Group / Solargis.
- **Method:** GET JSON per point; search the whole JSON for key `PVOUT_csi` (number = annual kWh/kWp; list of 12 = monthly Jan–Dec).
- **Model:** `engine_value = min(annual over points)`; `monthly_share_m = monthly_m / Σ monthly` (central point).
- **Test fixture:** annual 1465.97 / 1492.74 / 1468.47 / 1471.14 / 1473.11 → min 1466.0, spread 1.8%. Central monthly Jan–Dec: 100.22, 121.14, 150.47, 146.88, 137.95, 118.80, 105.93, 114.05, 125.37, 131.91, 108.72, 104.53.

### 4.4 Surcharge history — `out/surcharge_history_brpl.json`
- **Source:** BRPL_SURCH. Monthly.
- **Method:** GET HTML → every `<tr>`: cell texts + first link. Row title = longest cell. From the title: `pct = (\d{1,2}\.\d{1,2})%`; period = `DD.MM.YYYY|DD/MM/YYYY (to|-) DD.MM.YYYY`; or `DD.MM.YYYY onwards`.
- **Model:** series of (from, to, pct) sorted by `from`; `latest`; min/max over the last 24 months; rows without % listed as `needs_pdf`. Context only: the bill model does not use it.
- **Test fixture:** 11 rows with %: 27.08, 9.44, 7.49, 6.29, 7.25, 5.39, 6.19, 6.73, 5.76, 8.75, 10.00; latest 10.00% from 2026-06-01.

### 4.5 Installer prices (candidates only) — `data/price_candidates.json`
- **Source:** URL list in `data/installer_pages.json` (start: MKT_SS, MKT_HG). Weekly.
- **Method:** GET → strip tags → regex `(\d{1,2})\s*kW … (₹|Rs|INR)\s*([\d,.]+)\s*(lakh|lac|L)?` (lakh × 100,000; keep ₹10,000–₹20,00,000); page date from `Updated: …`; flag `stale_delhi_subsidy` if the page quotes a Delhi/state subsidy of ₹30,000.
- **Approval:** `approve.py` shows each pair; a person keeps or rejects it and records page date, GST included (yes/no/unknown) and DCR (yes/no/unknown). Only kept pairs go into `price_observations.json`.

Not in the hack: rule-document change watcher (later).

---

## 5. Engine formulas

**Bill (₹/month, before Delhi subsidy)**
```
E(u)      = Σ slab_rate × units falling in that slab
F(L)      = band_rate(L) × L                      (L = sanctioned load, kW)
m         = mean over calibration points of  bill / (E(u) + F(L))      → 1.3696 (fits 1.377, 1.362)
Bill(u,L) = m × (E(u) + F(L))                     (m absorbs PPAC, pension surcharge, tax)
```

**Delhi power subsidy (class from gross, applied to net bill)**
```
gross ≤ 200        : subsidy = net_bill
200 < gross ≤ 400  : subsidy = min(0.5 × Bill(gross, L), 800, net_bill)
gross > 400        : subsidy = 0
payable            = Bill(net_units, L) − subsidy
```

**Generation (units per month, April..March)**
```
annual = engine_value × (1 − extra_losses)                   # 1466 × 0.95 ≈ 1393 kWh/kWp/yr
g_m(k, year) = k × annual × share_m × (1 − 0.005)^(year − 1)  # shares reordered Apr..Mar
```

**Net-metering year**
```
bank = 0
for m in Apr..Mar:
    x = c_m − g_m − bank
    billed_m = max(x, 0);  bank = max(−x, 0)
payout     = bank × surplus_rate
incentive  = (avg gross ≤ 200) ? 0.5 × Σ min(c_m, g_m) × 3 : 0
saving_y   = Σ [payable(c_m, c_m) − payable(c_m, billed_m)] + payout + incentive
```

**Subsidies and cost**
```
central(k)   = 30,000 × min(k,2) + 18,000 × min(max(k−2,0),1)            # ≤ 78,000
delhi(k, P)  = max(0, min(26,000 × min(k,3), 78,000, P − central(k)))
benchmark(k) = 50,000 × min(k,2) + 45,000 × max(k−2,0)
net_cost     = 0 on free route; else max(0, P − central − delhi)
```

**Finance (r = scheme loan rate unless stated)**
```
other_cost_t = (t ≤ 5 ? 0 : 600 × k) + (t = 12 ? 8,000 × k : 0)
flow_t       = saving_t − other_cost_t
NPV          = −net_cost + Σ flow_t / (1+r)^t,  t = 1..25
NPV_cash     = same with r = cash_opportunity_rate
payback      = first (fractional) year where Σ flow_t (discounted for the discounted version) ≥ net_cost
IRR          = r where NPV = 0 (bisection)
LCOE         = [net_cost + Σ other_cost_t/(1+r)^t] / Σ gen_t/(1+r)^t        # ₹ per solar unit
value/unit   = saving_1 / gen_1                                            # ₹ a solar unit is worth to this home
spread       = value/unit − LCOE
EMI          = P·i(1+i)^n / ((1+i)^n − 1),  i = r/12, n = 120, P = net_cost   (only k ≤ 3, paid route)
DSCR         = (saving_1 / 12) / EMI
```

**Verdict**
```
saving_1 ≤ 0                                         → NOT_WORTH
free route                                           → GO_FREE
spread ≥ 1 AND disc. payback ≤ 7 AND (DSCR ≥ 1.2 or no loan) → GO
NPV > 0                                              → MARGINAL
else                                                 → NOT_WORTH
```

**Reference price ladder (per size k ∈ {1,2,3,4,5,10})**
```
benchmark rung : benchmark(k)
market rungs   : from observations at exactly size k (never pool sizes):
                 low = min(low/k), high = max(high/k), median = median((low+high)/2/k); report n, page dates, GST flags
history rung   : TPDDL rate × k (excl. GST)
```

---

## 6. Outputs (`out/`)

| File | Content |
|---|---|
| reference_price.json | Ladder per size with tier, source, n, dates |
| feed_household_conservative.csv / _policy_example_appc.csv | One row per gross units {100,150,200,250,300,350,400,450,500,600,800,1000} × load {2,3,5,7} × size {1–5, ≤ load} × route {free if eligible, standard} × rung {benchmark, market_low/median/high}. Columns: net_cost, bill_now_month, bill_with_month, surplus_payout_y1, incentive_y1, saving_y1, value_per_unit, cost_per_unit, spread_per_unit, payback_simple_y, payback_disc_y, npv, npv_if_cash, irr, emi_month, dscr, verdict |
| feed_best_size_*.csv | Highest-NPV size per (units, load, route, rung) |
| applications_by_division.json, money_rates.json, delhi_solar_yield.json, surcharge_history_brpl.json | §4 |
| provenance.json | Every rule with URL, tier, date; fitted m; list of VERIFY / ASSUMPTION keys |

Feeds from §4.2 and §4.3 override the matching rule values at load time (keep their provenance).

---

## 7. Build steps

1. Write `data/delhi_rules.json` and `data/price_observations.json` from §3.
2. Implement the bill model and subsidy rules; pass the acceptance tests in §8 (bill and subsidy).
3. Implement generation, the net-metering year, subsidies, finance, verdict (§5); pass §8.
4. Implement the reference ladder and the household / best-size feeds; write `out/`.
5. Implement scrapers §4.1–4.4 with live and offline modes; save §4 fixtures in `data/fixtures/`; pass §8.
6. Implement §4.5 and the approval step.
7. `run_all.py`: run §4.1–4.4 (one failure must not stop the others), then rebuild all feeds. `--offline` uses fixtures.
8. README: how to run, every VERIFY / ASSUMPTION item, sources.

---

## 8. Acceptance tests (must pass)

| Test | Expected |
|---|---|
| Bill(400, 3 kW) | ₹2,272 ± 1% |
| Bill(100, 3 kW) | ₹613 ± 1% |
| Calibration multipliers agree | max − min < 0.02 |
| payable(gross 400, net 400, 3 kW) | ≈ 2,272 − 800 = ₹1,472 |
| payable(gross 400, net 100, 3 kW) | ₹0 |
| payable(gross 450, net 150, 3 kW) | = Bill(150, 3 kW) (no subsidy) |
| payable(gross 180, …) | ₹0 |
| Year with 150 units/month, 200 generated/month, surplus ₹6.5 | payout ₹325/month, incentive ₹225/month, total ₹550/month |
| Carry-forward: 6 months at 100, 6 at 300, generation 200 | banked surplus at year end = 0 |
| central(1, 2, 3, 5 kW) | 30,000 · 60,000 · 78,000 · 78,000 |
| delhi(1 kW, ₹2L) · delhi(3 kW, ₹3L) · delhi(5 kW, ₹4L) · delhi(3 kW, ₹1.4L) | 26,000 · 78,000 · 78,000 · 62,000 |
| benchmark(3) · benchmark(5) | 1,45,000 · 2,35,000 |
| EMI(₹1,00,000, 12%, 1 yr) | ₹8,884.88 |
| IRR(−1,00,000; 10 × 30,000) | 27.32% |
| Applications fixture | 49 rows; totals 24,864 / 27,515 / 27,461 / 79,840 |
| Surcharge fixture | 11 values; latest 10.00% from 2026-06-01 |
| Money-rates fixture | repo 5.50 → loan 6.00; cash 6.75 |
| Solar fixture | min 1466.0; spread < 2%; shares sum to 1 |
| Installer snippet "3 kW … ₹2.4 lakh … 5 kW: Rs 3,30,000 … Delhi state subsidy ₹30,000" | pairs (3, 240000), (5, 330000); stale flag true |

---

## 9. Open items (keep as VERIFY until closed)

1. Surplus rate paid by DERC per DISCOM (moves an under-200 home's benefit by ~50–70%).
2. More installer prices / real quotes (1–2 per size today).
3. A current tariff schedule or real bills to refit m.
4. Exact under-200 incentive rule text; GST treatment of the benchmark and of installer prices.
5. Assumptions: O&M after year 5, inverter replacement, loan tenure, decision thresholds, extra losses.
