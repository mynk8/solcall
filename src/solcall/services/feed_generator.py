"""Household Feeds and Catalog Generator Domain Service.

Generates the core data outputs specified in AGENT_SPEC.md §6:
1. `reference_price.json`
2. `feed_household_conservative.csv` (surplus rate = ₹3.5/kWh)
3. `feed_household_policy_example_appc.csv` (surplus rate = ₹6.5/kWh)
4. `feed_best_size_conservative.csv` & `feed_best_size_policy_example_appc.csv`
5. `provenance.json`
"""

from __future__ import annotations
import csv
import json
from pathlib import Path
from typing import Any, Dict, List
from solcall.domain.value_objects import RouteType
from solcall.domain.subsidy import CapitalSubsidyCalculator
from solcall.services.engine import SolarMathEngine, HouseholdEvaluation
from solcall.services.reference_ladder import ReferenceLadderService, SizePriceLadder
from solcall.services.provenance import ProvenanceService


class FeedGeneratorService:
    """Orchestrates generation of household feed grids and catalog exports."""

    GROSS_UNITS_GRID: List[float] = [
        100.0, 150.0, 200.0, 250.0, 300.0, 350.0, 400.0, 450.0, 500.0, 600.0, 800.0, 1000.0
    ]
    LOAD_GRID: List[float] = [2.0, 3.0, 5.0, 7.0]
    SYSTEM_SIZES_GRID: List[float] = [1.0, 2.0, 3.0, 4.0, 5.0]

    CSV_HEADERS: List[str] = [
        "gross_units_monthly",
        "sanctioned_load_kw",
        "system_size_kw",
        "route",
        "price_rung",
        "gross_price",
        "central_subsidy",
        "delhi_subsidy",
        "net_cost",
        "bill_now_monthly",
        "bill_with_monthly",
        "surplus_payout_y1",
        "incentive_y1",
        "saving_y1",
        "value_per_unit",
        "cost_per_unit",
        "spread_per_unit",
        "payback_simple_y",
        "payback_disc_y",
        "npv",
        "npv_if_cash",
        "irr",
        "emi_monthly",
        "dscr",
        "verdict",
    ]

    def __init__(self, engine: SolarMathEngine, out_dir: Path, data_dir: Path) -> None:
        self.engine = engine
        self.out_dir = out_dir
        self.data_dir = data_dir
        self.out_dir.mkdir(parents=True, exist_ok=True)

    def generate_reference_prices_json(self) -> Dict[str, Any]:
        """Build and save reference_price.json ladder."""
        ladders = ReferenceLadderService.build_all_ladders()
        result: Dict[str, Any] = {}

        for size_kw, ladder in ladders.items():
            key = f"{int(size_kw) if size_kw.is_integer() else size_kw}_kw"
            result[key] = {
                "size_kw": size_kw,
                "central_subsidy": ladder.central_subsidy,
                "delhi_subsidy_benchmark": ladder.delhi_subsidy_benchmark,
                "net_cost_benchmark": ladder.net_cost_benchmark,
                "benchmark": {
                    "total_price": ladder.benchmark.total_price,
                    "price_per_kw": ladder.benchmark.price_per_kw,
                    "tier": ladder.benchmark.tier.value,
                    "source": ladder.benchmark.source,
                    "as_of": ladder.benchmark.as_of,
                },
                "market_low": {
                    "total_price": ladder.market_low.total_price,
                    "price_per_kw": ladder.market_low.price_per_kw,
                    "tier": ladder.market_low.tier.value,
                    "source": ladder.market_low.source,
                    "n_observations": ladder.market_low.n_observations,
                    "as_of": ladder.market_low.as_of,
                    "notes": ladder.market_low.notes,
                } if ladder.market_low else None,
                "market_median": {
                    "total_price": ladder.market_median.total_price,
                    "price_per_kw": ladder.market_median.price_per_kw,
                    "tier": ladder.market_median.tier.value,
                    "source": ladder.market_median.source,
                    "n_observations": ladder.market_median.n_observations,
                    "as_of": ladder.market_median.as_of,
                    "notes": ladder.market_median.notes,
                } if ladder.market_median else None,
                "market_high": {
                    "total_price": ladder.market_high.total_price,
                    "price_per_kw": ladder.market_high.price_per_kw,
                    "tier": ladder.market_high.tier.value,
                    "source": ladder.market_high.source,
                    "n_observations": ladder.market_high.n_observations,
                    "as_of": ladder.market_high.as_of,
                    "notes": ladder.market_high.notes,
                } if ladder.market_high else None,
                "tpddl_history": {
                    "total_price": ladder.tpddl_history.total_price,
                    "price_per_kw": ladder.tpddl_history.price_per_kw,
                    "tier": ladder.tpddl_history.tier.value,
                    "source": ladder.tpddl_history.source,
                    "as_of": ladder.tpddl_history.as_of,
                },
            }

        target_file = self.out_dir / "reference_price.json"
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

        return result

    def generate_household_grid(self, surplus_rate: float) -> List[Dict[str, Any]]:
        """Compute the full household evaluation grid (§6)."""
        ladders = ReferenceLadderService.build_all_ladders()
        rows: List[Dict[str, Any]] = []

        for gross_units in self.GROSS_UNITS_GRID:
            for load_kw in self.LOAD_GRID:
                # System size constrained by sanctioned load (reg 5)
                eligible_sizes = [s for s in self.SYSTEM_SIZES_GRID if s <= load_kw]

                for size_kw in eligible_sizes:
                    ladder = ladders.get(size_kw)
                    if not ladder:
                        continue

                    # Determine available price rungs for this size
                    available_rungs = [("benchmark", ladder.benchmark.total_price)]
                    if ladder.market_low:
                        available_rungs.append(("market_low", ladder.market_low.total_price))
                    if ladder.market_median:
                        available_rungs.append(("market_median", ladder.market_median.total_price))
                    if ladder.market_high:
                        available_rungs.append(("market_high", ladder.market_high.total_price))

                    # Determine routes: standard is always available
                    routes_to_eval = [RouteType.STANDARD]
                    # Free route only if eligible: gross <= 400 and size <= 3
                    if CapitalSubsidyCalculator.is_free_scheme_eligible(gross_units, size_kw):
                        routes_to_eval.append(RouteType.FREE)

                    for route in routes_to_eval:
                        # For free route, evaluate once (price rung doesn't alter zero net cost)
                        rungs_for_route = [("benchmark", ladder.benchmark.total_price)] if route == RouteType.FREE else available_rungs

                        for rung_name, gross_price in rungs_for_route:
                            eval_res: HouseholdEvaluation = self.engine.evaluate_household(
                                consumption=gross_units,
                                sanctioned_load_kw=load_kw,
                                system_size_kw=size_kw,
                                gross_price=gross_price,
                                route=route,
                                surplus_rate=surplus_rate,
                            )

                            row = {
                                "gross_units_monthly": gross_units,
                                "sanctioned_load_kw": load_kw,
                                "system_size_kw": size_kw,
                                "route": route.value,
                                "price_rung": rung_name,
                                "gross_price": round(eval_res.gross_price, 2),
                                "central_subsidy": round(eval_res.central_subsidy, 2),
                                "delhi_subsidy": round(eval_res.delhi_subsidy, 2),
                                "net_cost": round(eval_res.net_cost, 2),
                                "bill_now_monthly": round(eval_res.bill_now_monthly, 2),
                                "bill_with_monthly": round(eval_res.bill_with_monthly, 2),
                                "surplus_payout_y1": round(eval_res.surplus_payout_y1, 2),
                                "incentive_y1": round(eval_res.incentive_y1, 2),
                                "saving_y1": round(eval_res.saving_y1, 2),
                                "value_per_unit": round(eval_res.value_per_unit, 2),
                                "cost_per_unit": round(eval_res.cost_per_unit, 2),
                                "spread_per_unit": round(eval_res.spread_per_unit, 2),
                                "payback_simple_y": (
                                    round(eval_res.payback_simple_y, 2)
                                    if eval_res.payback_simple_y is not None
                                    else ""
                                ),
                                "payback_disc_y": (
                                    round(eval_res.payback_disc_y, 2)
                                    if eval_res.payback_disc_y is not None
                                    else ""
                                ),
                                "npv": round(eval_res.npv, 2),
                                "npv_if_cash": round(eval_res.npv_if_cash, 2),
                                "irr": (
                                    round(eval_res.irr * 100.0, 2)
                                    if eval_res.irr is not None
                                    else ""
                                ),
                                "emi_monthly": round(eval_res.emi_monthly, 2),
                                "dscr": (
                                    "inf"
                                    if eval_res.dscr == float("inf")
                                    else round(eval_res.dscr, 2)
                                ),
                                "verdict": eval_res.verdict.value,
                            }
                            rows.append(row)

        return rows

    def export_csv(self, filename: str, rows: List[Dict[str, Any]]) -> None:
        """Write rows to a CSV file in out/."""
        target_path = self.out_dir / filename
        with open(target_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.CSV_HEADERS)
            writer.writeheader()
            writer.writerows(rows)

    def extract_best_sizes(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter for highest-NPV system size per (gross_units, load_kw, route, price_rung)."""
        groups: Dict[tuple, Dict[str, Any]] = {}
        for r in rows:
            key = (
                r["gross_units_monthly"],
                r["sanctioned_load_kw"],
                r["route"],
                r["price_rung"],
            )
            if key not in groups or r["npv"] > groups[key]["npv"]:
                groups[key] = r

        return list(groups.values())

    def generate_all_feeds(self) -> None:
        """Generate and save all feeds and provenance files to out/."""
        # 1. Reference price JSON
        self.generate_reference_prices_json()

        # 2. Conservative feed (surplus rate = ₹3.50)
        conservative_rows = self.generate_household_grid(surplus_rate=3.50)
        self.export_csv("feed_household_conservative.csv", conservative_rows)
        best_conservative = self.extract_best_sizes(conservative_rows)
        self.export_csv("feed_best_size_conservative.csv", best_conservative)

        # 3. Policy example feed (surplus rate = ₹6.50)
        policy_rows = self.generate_household_grid(surplus_rate=6.50)
        self.export_csv("feed_household_policy_example_appc.csv", policy_rows)
        best_policy = self.extract_best_sizes(policy_rows)
        self.export_csv("feed_best_size_policy_example_appc.csv", best_policy)

        # 4. Provenance JSON
        prov = ProvenanceService.generate_provenance(
            rules_path=self.data_dir / "delhi_rules.json",
            tariff=self.engine.tariff,
        )
        with open(self.out_dir / "provenance.json", "w", encoding="utf-8") as f:
            json.dump(prov, f, indent=2)
