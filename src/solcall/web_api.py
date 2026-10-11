"""HTTP endpoints shaped for the consumer web app (web/).

The app answers one household question in one panel: what solar should cost,
whether it is worth it for this bill, and what to do next. These endpoints
compose the Layer 3 engine and the scraped feeds into that shape so the
frontend does no finance math of its own.
"""

from __future__ import annotations

import csv
import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query

from solcall.domain.subsidy import CapitalSubsidyCalculator, PowerSubsidyCalculator
from solcall.domain.value_objects import RouteType
from solcall.services.engine import HouseholdEvaluation, SolarMathEngine
from solcall.services.feed_generator import FeedGeneratorService

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "out"

MONTHS_APR_MAR = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
SIZES_KW = [1, 2, 3, 4, 5, 10]

router = APIRouter(prefix="/api/web", tags=["web app"])
engine = SolarMathEngine()


# ---------------------------------------------------------------- data loading

@lru_cache(maxsize=1)
def _rules() -> dict:
    with open(DATA_DIR / "delhi_rules.json", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _reference_prices() -> dict:
    ref_file = OUT_DIR / "reference_price.json"
    if ref_file.exists():
        with open(ref_file, encoding="utf-8") as f:
            return json.load(f)
    generator = FeedGeneratorService(engine=engine, out_dir=OUT_DIR, data_dir=DATA_DIR)
    return generator.generate_reference_prices_json()


def _read_csv(name: str) -> list[dict]:
    path = DATA_DIR / name
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _rung(rung: Optional[dict]) -> Optional[dict]:
    if not rung:
        return None
    return {
        "total": rung["total_price"],
        "per_kw": rung["price_per_kw"],
        "tier": rung.get("tier"),
        "source": rung.get("source"),
        "as_of": rung.get("as_of"),
        "n": rung.get("n_observations"),
    }


def _ladder(size_kw: int) -> dict:
    entry = _reference_prices().get(f"{size_kw}_kw", {})
    # Subsidy and out-of-pocket cost at the typical (median) price, else at the govt benchmark
    typical = (entry.get("market_median") or entry.get("benchmark") or {}).get("total_price")
    subsidy = None
    if typical:
        subsidy = CapitalSubsidyCalculator.central_subsidy(size_kw) + CapitalSubsidyCalculator.delhi_subsidy(size_kw, typical)
    return {
        "typical_price": typical,
        "typical_subsidy": subsidy,
        "typical_you_pay": max(0.0, typical - subsidy) if typical else None,
        "size_kw": size_kw,
        "benchmark": _rung(entry.get("benchmark")),
        "market_low": _rung(entry.get("market_low")),
        "market_median": _rung(entry.get("market_median")),
        "market_high": _rung(entry.get("market_high")),
        "history": _rung(entry.get("tpddl_history")),
        "central_subsidy": entry.get("central_subsidy"),
    }


# ---------------------------------------------------------------- shaping

def _num(x: Optional[float], nd: int = 2) -> Optional[float]:
    if x is None or x == float("inf"):
        return None
    return round(x, nd)


def _cumulative(net_cost: float, flows: list[float]) -> list[dict]:
    out, total = [{"year": 0, "value": round(-net_cost)}], -net_cost
    for t, f in enumerate(flows, start=1):
        total += f
        out.append({"year": t, "value": round(total)})
    return out


def _loan_cumulative(emi: float, flows: list[float], loan_years: int = 10) -> list[dict]:
    out, total = [{"year": 0, "value": 0}], 0.0
    for t, f in enumerate(flows, start=1):
        total += f - (12 * emi if t <= loan_years else 0)
        out.append({"year": t, "value": round(total)})
    return out


def _shape(ev: HouseholdEvaluation) -> dict:
    return {
        "verdict": ev.verdict.value,
        "reason": ev.verdict_reason,
        "price": _num(ev.gross_price, 0),
        "central_subsidy": _num(ev.central_subsidy, 0),
        "delhi_subsidy": _num(ev.delhi_subsidy, 0),
        "you_pay": _num(ev.net_cost, 0),
        "bill_now_month": _num(ev.bill_now_monthly, 0),
        "bill_with_month": _num(ev.bill_with_monthly, 0),
        "saving_year1": _num(ev.saving_y1, 0),
        "payback_years": _num(ev.payback_simple_y),
        "payback_discounted_years": _num(ev.payback_disc_y),
        "value_per_unit": _num(ev.value_per_unit),
        "cost_per_unit": _num(ev.cost_per_unit),
        "npv": _num(ev.npv, 0),
        "emi_month": _num(ev.emi_monthly, 0) if ev.emi_monthly else None,
        "emi_cover": _num(ev.dscr),
        # Money in hand over time: year 0 is what you pay; each year adds that year's net saving
        # (saving − upkeep − inverter). Crossing zero is the simple payback point.
        "cumulative": _cumulative(ev.net_cost, ev.financials.cash_flows),
        "lifetime_gain": _num(ev.financials.cash_flows and sum(ev.financials.cash_flows) - ev.net_cost, 0),
        # Same household, but the whole net cost on the 10-year scheme loan: nothing paid up front,
        # each year adds that year's saving minus twelve EMIs (none after year 10).
        "loan_cumulative": _loan_cumulative(ev.emi_monthly, ev.financials.cash_flows) if ev.emi_monthly else None,
        "monthly": [
            {
                "month": MONTHS_APR_MAR[r.month_index],
                "units": _num(r.gross_consumption, 0),
                "solar_units": _num(r.generation, 0),
                "bill_now": _num(r.baseline_payable, 0),
                "bill_with": _num(r.solar_payable, 0),
            }
            for r in ev.net_metering_y1.monthly_records
        ],
    }


def _environment(size_kw: float, units_month: float) -> dict:
    """Energy and emissions side of one system: generation from the yield model, CO2 from the grid factor rule.

    Avoided CO2 = solar units generated x the grid's average emissions per unit (rule
    `emissions.grid_factor`): every solar unit, used at home or exported, displaces a grid unit.
    Lifetime figures use each year's degraded generation over `finance.life_years`.
    """
    rules = _rules()
    factor = rules["emissions.grid_factor"]["value"]  # kg CO2 per unit
    life = int(rules["finance.life_years"]["value"])
    year1 = engine.yield_model.annual_generation(size_kw)
    lifetime = sum(engine.yield_model.annual_generation(size_kw, year=t) for t in range(1, life + 1))
    used = units_month * 12
    return {
        "units_year": round(year1),
        "units_lifetime": round(lifetime),
        "life_years": life,
        "home_units_year": round(used),
        "covers_pct": _num(min(year1, used) / used * 100, 0) if used else None,
        "co2_tonnes_year": _num(year1 * factor / 1000, 1),
        "co2_tonnes_lifetime": _num(lifetime * factor / 1000, 0),
        "grid_kg_co2_per_unit": factor,
    }


def _quote_check(quote: float, ladder: dict) -> dict:
    low, med, high = ladder["market_low"], ladder["market_median"], ladder["market_high"]
    if not med:
        return {"position": "unknown", "message": "We have no market prices for this size yet."}
    ask = med["total"]
    if low and quote < low["total"]:
        position = "below"
    elif high and quote > high["total"]:
        position = "above"
    elif quote > ask:
        position = "upper"
    else:
        position = "lower"
    return {
        "position": position,  # below | lower | upper | above (relative to the market range and median)
        "ask_for": round(ask),
        "vs_median_pct": round((quote - ask) / ask * 100, 1),
        "n": med.get("n"),
    }


# ---------------------------------------------------------------- endpoints

@router.get("/answer")
def answer(
    units: float = Query(..., ge=0, le=5000, description="Average monthly units (gross)"),
    load: float = Query(3, gt=0, description="Sanctioned load, kW"),
    size: int = Query(3, ge=1, le=10, description="System size, kW"),
    quote: Optional[float] = Query(None, gt=0, description="Installer quote before subsidy, INR"),
    surplus_rate: float = Query(3.50, description="Net-metering surplus rate, INR/unit"),
) -> dict:
    """Everything the roof panel shows, for one household."""
    ladder = _ladder(size)
    free_rule = _rules()["free_scheme"]["value"]

    # Price used for the paid answer: the household's quote, else the market median, else the govt benchmark.
    if quote:
        price, basis = quote, "your quote"
    elif ladder["market_median"]:
        price, basis = ladder["market_median"]["total"], "market median"
    else:
        price, basis = ladder["benchmark"]["total"], "govt benchmark"

    size_ok = size <= load
    paid = engine.evaluate_household(
        consumption=units, sanctioned_load_kw=load, system_size_kw=size,
        gross_price=price, route=RouteType.STANDARD, surplus_rate=surplus_rate,
    )
    free_eligible = units <= free_rule["max_avg_gross_units"] and size <= free_rule["max_system_kw"] and size_ok
    free = None
    if free_eligible:
        free = _shape(engine.evaluate_household(
            consumption=units, sanctioned_load_kw=load, system_size_kw=size,
            route=RouteType.FREE, surplus_rate=surplus_rate,
        ))

    return {
        "inputs": {"units": units, "load": load, "size": size, "quote": quote, "surplus_rate": surplus_rate},
        "size_allowed": size_ok,
        "solar_units_month": round(engine.yield_model.annual_generation(size) / 12),
        "environment": _environment(size, units),
        "price_ladder": ladder,
        "price_basis": basis,
        "paid": _shape(paid),
        "free": free,
        "free_eligible": free_eligible,
        "free_operational": bool(free_rule.get("operational")),
        "loan_applies": size <= 3,
        "quote_check": _quote_check(quote, ladder) if quote else None,
    }


@router.get("/prices")
def prices() -> dict:
    """Price ladder for every size, for the Prices page and the map's 'today' card."""
    return {"sizes": [_ladder(k) for k in SIZES_KW]}


@router.get("/units-from-bill")
def units_from_bill(
    amount: float = Query(..., ge=0, description="Monthly bill the household pays, INR"),
    load: float = Query(3, gt=0),
) -> dict:
    """Invert the bill model: which monthly units produce this payable bill?

    Payable is non-decreasing in units, so a binary search over whole units works.
    Bills of ₹0 map to 200 units (the whole band ≤200 pays nothing after subsidy).
    """
    calc = PowerSubsidyCalculator(tariff=engine.tariff)
    payable = lambda u: calc.calculate_payable(u, u, load)  # noqa: E731
    if amount <= 0:
        return {"units": 200, "approximate": True, "note": "Bills of ₹0 mean 200 units or less."}
    lo, hi = 0, 3000
    while lo < hi:
        mid = (lo + hi) // 2
        if payable(mid) < amount:
            lo = mid + 1
        else:
            hi = mid
    # take whichever neighbour lands closer to the bill they typed
    best = min((max(lo - 1, 0), lo), key=lambda u: abs(payable(u) - amount))
    return {"units": best, "approximate": True, "bill_at_units": round(payable(best))}


@router.get("/today")
def today() -> dict:
    """Headline facts for the map card and Prices page."""
    apps = _read_csv("scraped_applications_by_division.csv")
    rates = _read_csv("scraped_money_rates.csv")
    surcharge = sorted(_read_csv("scraped_surcharge_history_brpl.csv"), key=lambda r: r["from_date"])
    yld = _read_csv("scraped_solar_yield.csv")

    by_discom: dict[str, dict] = {}
    for r in apps:
        d = by_discom.setdefault(r["discom"], {"discom": r["discom"], "total": int(r["discom_total"]), "top": None})
        if r["rank_in_discom"] == "1":
            d["top"] = {"division": r["division"], "applications": int(r["applications"])}

    rate = rates[-1] if rates else None
    latest = surcharge[-1] if surcharge else None
    return {
        "applications": {
            "as_on": apps[0]["as_on"] if apps else None,
            "total": int(apps[0]["grand_total"]) if apps else None,
            "by_discom": list(by_discom.values()),
        },
        "rates": rate and {
            "as_of": rate["as_of"],
            "repo_pct": float(rate["repo_rate_pct"]),
            "scheme_loan_pct": float(rate["scheme_loan_rate_pct"]),
            "deposit_low_pct": float(rate["term_deposit_low_pct"]),
            "deposit_high_pct": float(rate["term_deposit_high_pct"]),
        },
        "solar_yield": yld and {
            "kwh_per_kwp": float(yld[0]["delhi_engine_min_annual"]),
            "spread_pct": float(yld[0]["spread_pct"]),
            "points": [{"name": r["point_name"], "kwh_per_kwp": float(r["annual_kwh_per_kwp"])} for r in yld],
        },
        "surcharge_brpl": latest and {"pct": float(latest["surcharge_pct"]), "from": latest["from_date"]},
    }


@router.get("/divisions")
def divisions() -> dict:
    """Applications per division, for the 'Neighbours going solar' layer."""
    return {"divisions": [
        {
            "discom": r["discom"], "division": r["division"],
            "applications": int(r["applications"]), "rank": int(r["rank_in_discom"]),
            "share": float(r["share_in_discom"]),
        }
        for r in _read_csv("scraped_applications_by_division.csv")
    ]}


@router.get("/updates")
def updates() -> dict:
    """What changed, newest first, each with what it means for a household."""
    items: list[dict] = []
    rules = _rules()

    ds = rules["delhi_subsidy"]
    items.append({
        "category": "Rules", "date": ds["as_of"],
        "title": f"Delhi subsidy is now ₹{ds['value']['rate_per_kw']:,.0f} per kW",
        "detail": f"Up to ₹{ds['value']['cap']:,.0f}, on top of the central subsidy.",
        "source": "Delhi Solar Energy Policy, 2nd amendment",
    })

    t = today()
    if t["rates"]:
        r = t["rates"]
        items.append({
            "category": "Rates", "date": r["as_of"],
            "title": f"Solar loan rate is {r['scheme_loan_pct']:.2f}%",
            "detail": f"RBI repo is {r['repo_pct']:.2f}%; scheme loans for systems up to 3 kW are repo + 0.50%.",
            "source": "RBI",
        })

    surcharge = sorted(_read_csv("scraped_surcharge_history_brpl.csv"), key=lambda r: r["from_date"])
    if len(surcharge) >= 1:
        cur = surcharge[-1]
        prev = surcharge[-2] if len(surcharge) >= 2 else None
        change = f" (was {float(prev['surcharge_pct']):.2f}%)" if prev else ""
        items.append({
            "category": "Bills", "date": cur["from_date"],
            "title": f"BRPL surcharge is {float(cur['surcharge_pct']):.2f}%{change}",
            "detail": "A higher surcharge raises your bill, so solar saves you more.",
            "source": "BRPL",
        })

    if t["applications"]["total"]:
        a = t["applications"]
        top = max((d for d in a["by_discom"] if d["top"]), key=lambda d: d["top"]["applications"], default=None)
        items.append({
            "category": "Neighbours", "date": (a["as_on"] or "")[:10],
            "title": f"{a['total']:,} Delhi homes have applied for rooftop solar",
            "detail": f"Most in {top['top']['division']} ({top['discom']}): {top['top']['applications']:,}." if top else "",
            "source": "Delhi Solar Portal",
        })

    med3 = _ladder(3)["market_median"]
    if med3:
        items.append({
            "category": "Prices", "date": max(str(med3["as_of"]).split(", ")),
            "title": f"Typical 3 kW price is ₹{med3['total']:,.0f}",
            "detail": f"Median of {med3['n']} installer prices, before subsidy.",
            "source": "Installer pages (indicative)",
        })

    items.sort(key=lambda i: i["date"] or "", reverse=True)
    return {"items": items}


@router.get("/surcharge")
def surcharge_history() -> dict:
    """BRPL PPAC/FPPAS surcharge orders, oldest first (context only; the bill model does not use it)."""
    rows = sorted(_read_csv("scraped_surcharge_history_brpl.csv"), key=lambda r: r["from_date"])
    return {
        "discom": "BRPL",
        "rows": [
            {"from": r["from_date"], "to": r["to_date"] or None, "pct": float(r["surcharge_pct"]), "title": r["title"],
             "pdf": ("https://www.bsesdelhi.com" + r["pdf_url"]) if r.get("pdf_url", "").startswith("/") else r.get("pdf_url")}
            for r in rows if r.get("surcharge_pct")
        ],
    }
