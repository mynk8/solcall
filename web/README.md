# SolCall web app

The frontend, following the v1 skeleton (https://claude.ai/artifact/A3eK64PTCwXk6uPkHevoKo):
a sidebar app with DISCOM scope tabs, Ctrl K search, and a three-step household path
(Find my roof → Check with my bill → Get a fair deal). `../static/` is the earlier concept UI and is not used.

## Run

```bash
# 1. engine API (repo root)
uv venv .venv && uv pip install -p .venv -r requirements.txt
PYTHONPATH=src .venv/bin/python run_layer3.py                      # writes out/ feeds
PYTHONPATH=src .venv/bin/uvicorn solcall.api:app --port 8000 --reload --reload-dir src

# 2. web app (web/)
pnpm install
pnpm dev                                                           # http://localhost:5173, proxies /api to :8000
```

Demo: `/map?roof=R-1042` → Check with my bill (450 units, 3 kW) → GO, pays back in 3.3 years, loan covered 2.6× →
Get a deal with a ₹2,40,000 quote → "on the high side, ask for about ₹2.28 lakh".

## Pages

| Route | Page | Data |
|---|---|---|
| `/` | Reference Price: KPIs, price table, DISCOM mini map, latest changes, tabs (ladder · adoption · surcharge · loan rates) | `/api/web/prices`, `today`, `updates`, `divisions`, `surcharge` |
| `/map` | Roof Map: roofs or applications layer; floating roof card (cost split, payback curves by usage) and DISCOM card | `/api/web/answer` (3 usage bands), sample roofs |
| `/check` | Check my bill: inputs, verdict, 4 numbers, monthly chart, "Why?" with sources, share | `/api/web/answer`, `/api/provenance`, `units-from-bill` |
| `/deal` | Get a deal: paid (quote check, loan, subsidy, vendors) / free (eligibility, steps) | `/api/web/answer` |
| `/alerts` | My alerts: subscribe, subscriptions, message preview | browser storage (stub) |
| `/records` | Top division per DISCOM, totals, lowest price per size | `today`, `prices` |
| `/changelog` | Timeline of rule, rate, surcharge, price and adoption changes | `updates`, `surcharge` |
| `/guide` | How Delhi's subsidy works: the gross rule and 4 worked examples | static (policy examples) |
| `/data` | Data catalog & API, feed detail sheet | existing `/api/*` feeds |

Household inputs live in the URL (`?roof=&units=&load=&size=&disco=&quote=&qsize=&tab=`), so any page can be shared.
All money math runs in the Python engine (`src/solcall/web_api.py`); the frontend only formats.

## Placeholders to backfill

Every gap renders as a dashed "placeholder · …" box (`<Missing>` in code) or a `[₹X]` token.

| # | Placeholder | Where | What's needed |
|---|---|---|---|
| 1 | Roof data | Map (all pins), roof sheet | Real roof feed: id, lat/lon, locality, DISCOM, division, fits kW, shade (`src/lib/roofs.ts` has the contract + 7 sample roofs) |
| 2 | Address / locality search | Ctrl K, map search | Geocoder; today it matches sample roof names only |
| 3 | Roof → division mapping | Roof sheet "Your division" | Division for each roof (only 2 sample roofs have one) |
| 4 | Division boundaries | Map and home-page applications layer, DISCOM sheet | Real division shapes or centroids. Dots sit at hand-placed approximate centres of the locality each division code stands for (`DIVISION_POINTS` in `src/lib/roofs.ts`); the code-to-name reading is ours and `S2CHP` has no point yet |
| 4a | Grid emission factor | Home page case strip, Check my bill clean-power strip | Rule `emissions.grid_factor` in `data/delhi_rules.json` is 0.727 kg CO₂ per unit (CEA CO2 Baseline Database v20), marked `verify`. Confirm against the current CEA release |
| 5 | Change since last snapshot | DISCOM sheet, Records | Keep the previous applications snapshot ("+n this week") |
| 6 | BYPL / TPDDL surcharge | Reference KPI + Surcharge tab, Changelog (when scoped) | Scrapers for BYPL and TPDDL surcharge pages |
| 7 | Annotated sample bill | Check → "Where do I find these?" | Image of a Delhi bill with units and sanctioned load circled |
| 8 | Verdict card image | Check → Share verdict | Shareable image for WhatsApp |
| 9 | Registered vendor list | Deal → Registered vendors | Empanelled installers per DISCOM |
| 10 | Free-scheme step details | Deal → Free route | Official steps, documents, timelines once the scheme opens |
| 11 | Alert delivery | My alerts | Subscription store + WhatsApp sender (stored in the browser today) |
| 12 | Surcharge impact `[₹X]`, `[₹Y]` | Alert message preview | Bill model that applies surcharge month by month |
| 13 | Per-feed last-updated time | Data → feed sheet | Each feed reporting when it was last scraped/rebuilt |
| 14 | Area-level prices | Roof card → Cost | Installer prices per locality; prices are Delhi-wide today |
