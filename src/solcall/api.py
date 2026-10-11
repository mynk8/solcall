"""SolCall API Entrypoint for AWS ECS Container.

Exposes health checks and Layer 3 mathematical evaluations for ECS ALB / Target Groups.
"""

from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Optional, List, Union
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field

from solcall.domain.value_objects import RouteType
from solcall.services.engine import SolarMathEngine, HouseholdEvaluation
from solcall.services.feed_generator import FeedGeneratorService
from solcall.services.reference_ladder import ReferenceLadderService
from solcall.services.scraper_delivery import ScraperDeliveryService

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "out"

from fastapi.staticfiles import StaticFiles

STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="SolCall - Delhi Solar Reference Price Engine",
    description="Layer 3 Mathematical Engine running on AWS ECS (Elastic Container Service).",
    version="1.0.0",
)

# Initialize Layer 3 math engine & delivery service
engine = SolarMathEngine()
delivery_service = ScraperDeliveryService(data_dir=DATA_DIR, out_dir=OUT_DIR)

# Endpoints for the consumer web app (web/)
from solcall.web_api import router as web_router  # noqa: E402
app.include_router(web_router)

# Mount static web directory
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


class EvaluationRequest(BaseModel):
    consumption: Union[float, List[float]] = Field(
        ..., description="Monthly consumption in kWh or 12-month array (Apr..Mar)"
    )
    sanctioned_load_kw: float = Field(..., description="Sanctioned load in kW")
    system_size_kw: float = Field(..., description="Solar PV system capacity in kW")
    gross_price: Optional[float] = Field(
        None, description="Gross installer quote in INR. Defaults to MNRE benchmark cost."
    )
    route: RouteType = Field(RouteType.STANDARD, description="Application route: 'standard' or 'free'")
    surplus_rate: Optional[float] = Field(
        3.50, description="Net metering surplus settlement rate (₹3.50 conservative, ₹6.50 policy)"
    )


@app.get("/health")
def health_check() -> dict:
    """AWS ECS Container & ALB Target Group Health Check."""
    return {
        "status": "healthy",
        "service": "solcall-layer3-engine",
        "container": "aws-ecs-fargate",
        "multiplier_m": engine.tariff.fitted_multiplier,
        "release": os.environ.get("SOLCALL_RELEASE", "local"),
    }


@app.get("/")
def serve_index_ui():
    """Serves SolCall Web UI featuring MapLibre GL JS Delhi solar map."""
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "title": "SolCall Delhi Solar Reference Price & Decision Engine",
        "layer": "Layer 3 (The Math Engine)",
        "deployment": "AWS ECS Fargate via Docker",
    }


@app.get("/api/feeds/conservative-csv")
def download_conservative_csv():
    target = OUT_DIR / "feed_household_conservative.csv"
    if target.exists():
        return FileResponse(target, filename="feed_household_conservative.csv", media_type="text/csv")
    return JSONResponse(status_code=404, content={"error": "Feed not found"})


@app.get("/api/feeds/policy-csv")
def download_policy_csv():
    target = OUT_DIR / "feed_household_policy_example_appc.csv"
    if target.exists():
        return FileResponse(target, filename="feed_household_policy_example_appc.csv", media_type="text/csv")
    return JSONResponse(status_code=404, content={"error": "Feed not found"})


@app.get("/api/feeds/best-size-csv")
def download_best_size_csv():
    target = OUT_DIR / "feed_best_size_conservative.csv"
    if target.exists():
        return FileResponse(target, filename="feed_best_size_conservative.csv", media_type="text/csv")
    return JSONResponse(status_code=404, content={"error": "Feed not found"})


@app.post("/api/evaluate")
def evaluate_household_endpoint(req: EvaluationRequest) -> dict:
    """Run full Layer 3 math engine on a household configuration."""
    eval_res: HouseholdEvaluation = engine.evaluate_household(
        consumption=req.consumption,
        sanctioned_load_kw=req.sanctioned_load_kw,
        system_size_kw=req.system_size_kw,
        gross_price=req.gross_price,
        route=req.route,
        surplus_rate=req.surplus_rate,
    )

    return {
        "gross_units_monthly": eval_res.gross_units_monthly,
        "sanctioned_load_kw": eval_res.sanctioned_load_kw,
        "system_size_kw": eval_res.system_size_kw,
        "route": eval_res.route.value,
        "gross_price": eval_res.gross_price,
        "subsidies": {
            "central_pm_surya_ghar": eval_res.central_subsidy,
            "delhi_state_subsidy": eval_res.delhi_subsidy,
            "net_consumer_cost": eval_res.net_cost,
        },
        "monthly_bills": {
            "baseline_before_solar": eval_res.bill_now_monthly,
            "with_net_metering": eval_res.bill_with_monthly,
            "monthly_bill_reduction": max(0.0, eval_res.bill_now_monthly - eval_res.bill_with_monthly),
        },
        "year_1_outcomes": {
            "surplus_payout": eval_res.surplus_payout_y1,
            "under200_incentive": eval_res.incentive_y1,
            "total_savings": eval_res.saving_y1,
        },
        "metrics": {
            "value_per_unit_inr": eval_res.value_per_unit,
            "lcoe_per_unit_inr": eval_res.cost_per_unit,
            "spread_per_unit_inr": eval_res.spread_per_unit,
            "payback_simple_years": eval_res.payback_simple_y,
            "payback_discounted_years": eval_res.payback_disc_y,
            "npv_25_year_inr": eval_res.npv,
            "npv_if_cash_inr": eval_res.npv_if_cash,
            "irr_percent": eval_res.irr * 100.0 if eval_res.irr is not None else None,
            "emi_monthly_inr": eval_res.emi_monthly,
            "dscr": "inf" if eval_res.dscr == float("inf") else eval_res.dscr,
        },
        "verdict": {
            "decision": eval_res.verdict.value,
            "reason": eval_res.verdict_reason,
        },
    }


@app.get("/api/reference-price")
def get_reference_price_endpoint() -> dict:
    """Return the Delhi Solar Reference Price ladder."""
    ref_file = OUT_DIR / "reference_price.json"
    if ref_file.exists():
        with open(ref_file, "r", encoding="utf-8") as f:
            return json.load(f)
    # Generate on demand
    generator = FeedGeneratorService(engine=engine, out_dir=OUT_DIR, data_dir=DATA_DIR)
    return generator.generate_reference_prices_json()


@app.get("/api/provenance")
def get_provenance_endpoint() -> dict:
    """Return regulatory and mathematical provenance."""
    prov_file = OUT_DIR / "provenance.json"
    if prov_file.exists():
        with open(prov_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"error": "Provenance not yet generated. Run /api/generate-feeds first."}


@app.post("/api/generate-feeds")
def trigger_feed_generation() -> dict:
    """Rebuild all Layer 4 feeds and store into out/."""
    generator = FeedGeneratorService(engine=engine, out_dir=OUT_DIR, data_dir=DATA_DIR)
    generator.generate_all_feeds()
    return {"status": "success", "message": "All feeds regenerated in out/"}


@app.get("/api/scrapers/summary")
def get_scrapers_summary_endpoint() -> dict:
    """Return consolidated scraper metrics: ticker values, DISCOM counts, and surcharge history."""
    return delivery_service.get_summary(fitted_m=engine.tariff.fitted_multiplier)


@app.get("/api/scrapers/reference-table")
def get_reference_table_endpoint() -> list:
    """Return unpooled reference ladder formatted specifically for UI table rendering."""
    return delivery_service.get_reference_table_rows()


@app.get("/api/scrapers/discoms")
def get_discom_stats_endpoint() -> list:
    """Return division-level application metrics grouped by DISCOM."""
    return delivery_service.get_discom_stats()


@app.get("/api/scrapers/surcharges")
def get_surcharges_endpoint() -> list:
    """Return BRPL surcharge historical timeline."""
    return delivery_service.get_surcharge_history()
