# SolCall — Delhi Rooftop Solar Reference Price & Household Decision Engine

> **Track 03:** Waste and Energy (Rooftop Solar)  
> **Event:** Environmental Hacks (Bharat Builds Tour, event 02, WeMakeDevs)  
> **Deployment:** AWS ECS (Elastic Container Service) with Docker & Fargate  

Deploy the current React site, API, and data with `./deploy-aws.sh` or `.\deploy-aws.ps1` in PowerShell.
See [DEPLOY.md](DEPLOY.md) for the Amplify, ECS Express Mode, and S3 deployment steps.

---

## 1. Overview & Problem Statement

A Delhi household seeking rooftop solar currently cannot tell whether the investment is worth it or whether an installer's quotation is fair. 
- The regulatory framework changed significantly with the **Delhi Solar Energy Policy 2023 (2nd Amendment, 17 Sep 2026)** and **PM Surya Ghar: Muft Bijli Yojana**.
- Electricity bills in Delhi follow progressive slabs with PPAC surcharges, pension cess, and power subsidies whose eligibility is decided on **gross consumption** but applied to the **net bill**.
- Installer quotes vary widely without transparent public reference pricing.

**SolCall** delivers a map-to-deal product built on an open **Delhi Solar Reference Price Index**. It features a **pure mathematical engine (Layer 3)** with **zero LLMs, zero forecasts, and flat 25-year tariffs**.

---

## 2. Layer 3: Mathematical Domain Engine (Domain-Driven Design)

Layer 3 is built strictly adhering to **Domain-Driven Design (DDD)** principles:

```
d:\solcall\src\solcall\
├── domain\
│   ├── value_objects.py       # Immutables: Money, EnergyUnits, PowerCapacity, Tiers, Rungs
│   ├── tariff.py              # DERC Slabs, Fixed Charges, Empirical Calibration Multiplier m
│   ├── subsidy.py             # Gross-basis Power Subsidy, Central (PMSG) & State Subsidies
│   ├── solar_yield.py         # Global Solar Atlas (1,466 kWh/kWp/yr), 5% losses, 0.5% degradation
│   ├── net_metering.py        # DERC Net Metering Simulator (Apr..Mar netting, banking, under-200 incentive)
│   ├── finance.py             # 25-yr Lifecycle: NPV, Discounted Payback, IRR, LCOE, Spread, EMI, DSCR
│   └── verdict.py             # Decision Engine: GO, GO_FREE, MARGINAL, NOT_WORTH
├── services\
│   ├── engine.py              # SolarMathEngine orchestrating household evaluations
│   ├── reference_ladder.py    # Reference Ladder per size (Benchmark, Market Low/Med/High, History)
│   ├── feed_generator.py      # Produces out/ CSV & JSON feeds across consumption grids
│   └── provenance.py          # Tracks data lineage, citations, and VERIFY/ASSUMPTION audit items
└── api.py                     # FastAPI HTTP service for AWS ECS ALB & Container Health Check
```

### Core Business Formulas (§5)

All monetary amounts in these formulas are in Indian rupees.

#### 1. Bill Model (Pre-subsidy)

$$
\begin{aligned}
E(u) &= \sum \text{slab\_rate} \times u_{\text{slab}} \\
F(L) &= \text{band\_rate}(L) \times L \\
m &= \text{mean}\left(\frac{\text{bill}_{\text{calib}}}{E(u) + F(L)}\right) \approx 1.3696 \\
\text{Bill}(u, L) &= m \times (E(u) + F(L))
\end{aligned}
$$

#### 2. Delhi Power Subsidy (Gross basis → Net bill)

- If $`\text{gross} \le 200`$: $`\text{subsidy} = \text{net\_bill} \implies \text{payable} = 0`$.
- If $`200 < \text{gross} \le 400`$: $`\text{subsidy} = \min(0.5 \times \text{Bill}(\text{gross}, L), 800, \text{net\_bill})`$.
- If $`\text{gross} > 400`$: $`\text{subsidy} = 0 \implies \text{payable} = \text{net\_bill}`$.

#### 3. Solar PV Generation

$$
\begin{aligned}
\text{annual} &= 1466 \times (1 - 0.05) \approx 1392.70 \text{ kWh/kWp/yr} \\
g_m(k, t) &= k \times \text{annual} \times \text{share}_m \times (1 - 0.005)^{t-1} \quad (m \in \text{Apr..Mar})
\end{aligned}
$$

#### 4. Net-Metering Year Simulation

- Monthly netting with carry-forward energy banking across April..March.
- Year-end surplus payout: $`\text{bank} \times \text{surplus\_rate}`$ (₹3.50 conservative, ₹6.50 policy).
- Under-200 incentive: $`0.5 \times \sum \min(c_m, g_m) \times 3`$ if average gross $`\le 200`$.

#### 5. Capital Subsidies & Cost

$$
\begin{aligned}
\text{central}(k) &= 30000 \min(k, 2) + 18000 \min(\max(k-2, 0), 1) \le 78{,}000 \\
\text{delhi}(k, P) &= \max(0, \min(26000 \min(k, 3), 78000, P - \text{central}(k))) \\
\text{net\_cost} &= 0 \text{ (free route)} \quad \text{or} \quad \max(0, P - \text{central} - \text{delhi})
\end{aligned}
$$

#### 6. 25-Year Financial Metrics

- $`\text{NPV} = -\text{net\_cost} + \sum_{t=1}^{25} \frac{\text{flow}_t}{(1+r)^t}`$
- $`\text{LCOE} = \frac{\text{net\_cost} + \sum \frac{\text{other\_cost}_t}{(1+r)^t}}{\sum \frac{\text{gen}_t}{(1+r)^t}}`$
- $`\text{Spread} = \frac{\text{saving}_1}{\text{gen}_1} - \text{LCOE}`$
- $`\text{EMI} = P \frac{i(1+i)^n}{(1+i)^n - 1}`$ for 10-year loan on systems $`\le 3\text{ kW}`$
- $`\text{DSCR} = \frac{\text{saving}_1 / 12}{\text{EMI}}`$

#### 7. Verdict Logic

- $`\text{saving}_1 \le 0 \implies \mathbf{NOT\_WORTH}`$
- $`\text{free route} \implies \mathbf{GO\_FREE}`$
- $`\text{spread} \ge 1 \land \text{disc. payback} \le 7 \land (\text{DSCR} \ge 1.2 \lor \text{no loan}) \implies \mathbf{GO}`$
- $`\text{NPV} > 0 \implies \mathbf{MARGINAL}`$
- Else $`\implies \mathbf{NOT\_WORTH}`$

---

## 3. Running Locally

### Direct Python Execution
```bash
python run_layer3.py
```
This executes the mathematical engine, validates the official demo case (450 units, 3 kW load, 3 kW solar → payback ~3.3 years), and compiles all feeds into `out/`:
- `out/reference_price.json`
- `out/feed_household_conservative.csv`
- `out/feed_household_policy_example_appc.csv`
- `out/feed_best_size_conservative.csv`
- `out/feed_best_size_policy_example_appc.csv`
- `out/provenance.json`

### Running the API Server Locally
```bash
uvicorn solcall.api:app --host 0.0.0.0 --port 8000 --reload
```
- Interactive Swagger UI: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

---

## 4. Docker & AWS ECS Deployment

SolCall is fully containerized and configured for zero-overhead deployment to **AWS Elastic Container Service (ECS)** on **AWS Fargate**.

### Local Container Run with Docker Compose
```bash
docker-compose up --build
```

### Deploying Directly to AWS ECS via Docker & ECR
Using the automated scripts:

**Linux / macOS:**
```bash
chmod +x deploy-ecs.sh
AWS_ACCOUNT_ID=YOUR_AWS_ACCOUNT_ID AWS_REGION=ap-south-1 ./deploy-ecs.sh
```

**Windows PowerShell:**
```powershell
.\deploy-ecs.ps1 -AwsAccountId "YOUR_AWS_ACCOUNT_ID" -AwsRegion "ap-south-1"
```

The script performs the complete pipeline:
1. Verifies/creates the Amazon ECR repository `solcall-engine`.
2. Authenticates Docker to Amazon ECR.
3. Builds the production Docker image using `Dockerfile`.
4. Tags and pushes the container to Amazon ECR.
5. Invokes `aws ecs update-service` to deploy the new container to the AWS ECS Fargate cluster.

---

## 5. Provenance, Data Tiers & Open Items

Every value in SolCall carries a formal confidence tier:
- **T1:** Government / Regulator / DISCOM / RBI (`AMEND2`, `DERC`, `PMSG`, `RBI`)
- **T2:** World Bank / Solargis scientific standard (`Global Solar Atlas`)
- **T3:** Vendor market observations (`SolarSquare`, `Heaven Green`, indicative only)

### Formally Tracked VERIFY & ASSUMPTION Items
As mandated by the spec, open items are preserved in `data/delhi_rules.json` and `out/provenance.json`:
1. `tariff.energy_slabs`: VERIFY with a current electricity bill.
2. `net_metering.surplus_rate`: ₹3.50/kWh conservative (VERIFY against specific DISCOM filings).
3. `under200_incentive`: Rule text cl. 4.14 interpretation (VERIFY).
4. `benchmark_cost`: GST treatment on residential benchmark cost (VERIFY).
5. `free_scheme`: Marked `operational: false` pending utility notification (VERIFY).
6. `finance.loan_years`, `finance.om_after_free`, `finance.inverter_replacement`: Assumptions tracked with formal provenance.
