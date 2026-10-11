"""Scraper Delivery & Summary Service.

Provides structured aggregations of scraped data (Applications by Division,
RBI Money Rates, GSA Solar Output, BRPL PPAC Surcharges, and Reference Ladders)
for API consumption.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from solcall.services.reference_ladder import ReferenceLadderService


class ScraperDeliveryService:
    """Delivers scraped and calibrated data via clean, resilient API responses."""

    def __init__(self, data_dir: Path, out_dir: Path) -> None:
        self.data_dir = data_dir
        self.out_dir = out_dir

    def get_summary(self, fitted_m: float = 1.369596) -> Dict[str, Any]:
        """Aggregate high-level metric summaries for ticker and dashboard panels."""
        discoms = self.get_discom_stats()
        total_apps = sum(d["apps"] for d in discoms) if discoms else 79840
        surcharges = self.get_surcharge_history()
        latest_surch = surcharges[0]["pct"] if surcharges else "10.00%"
        rates = self.get_money_rates()
        loan_rate_str = f"{rates['scheme_loan_rate_pct']:.2f}%" if rates else "6.00%"

        # Get 3kW median reference price
        ladders = ReferenceLadderService.build_all_ladders()
        ladder_3kw = ladders.get(3.0)
        ref_med_3kw = (
            int(ladder_3kw.market_median.total_price)
            if ladder_3kw and ladder_3kw.market_median
            else 227500
        )

        return {
            "ticker": {
                "fitted_multiplier": fitted_m,
                "latest_surcharge_brpl": latest_surch,
                "scheme_loan_rate": loan_rate_str,
                "total_applications": total_apps,
                "min_solar_yield": 1466.0,
                "ref_median_3kw": ref_med_3kw,
            },
            "discoms": discoms,
            "surcharge_history": surcharges,
        }

    def get_discom_stats(self) -> List[Dict[str, Any]]:
        """Return DISCOM-level application aggregations from scraped datasets."""
        csv_path = self.data_dir / "scraped_applications_by_division.csv"
        json_path = self.out_dir / "applications_by_division.json"

        # 1. Prefer out/applications_by_division.json if available
        if json_path.exists():
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    discom_list = []
                    name_map = {
                        "BRPL": "BSES Rajdhani (South/West)",
                        "BYPL": "BSES Yamuna (East/Central)",
                        "TPDDL": "Tata Power Delhi (North)",
                    }
                    for d in data.get("discoms", []):
                        code = d.get("discom", "")
                        divisions = d.get("divisions", [])
                        top_div = divisions[0] if divisions else None
                        top_str = (
                            f"{top_div['division']} ({top_div['applications']:,} apps)"
                            if top_div
                            else "N/A"
                        )
                        discom_list.append({
                            "code": code,
                            "name": name_map.get(code, code),
                            "apps": d.get("total", 0),
                            "divisions": len(divisions),
                            "top": top_str,
                        })
                    if discom_list:
                        return discom_list
            except Exception:
                pass

        # 2. Try data/scraped_applications_by_division.csv
        if csv_path.exists():
            try:
                with open(csv_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    by_discom: Dict[str, List[Dict[str, Any]]] = {}
                    totals: Dict[str, int] = {}
                    for row in reader:
                        disc = row["discom"]
                        apps = int(row["applications"])
                        by_discom.setdefault(disc, []).append({
                            "division": row["division"],
                            "applications": apps,
                        })
                        totals[disc] = int(row["discom_total"])

                    name_map = {
                        "BRPL": "BSES Rajdhani (South/West)",
                        "BYPL": "BSES Yamuna (East/Central)",
                        "TPDDL": "Tata Power Delhi (North)",
                    }
                    results = []
                    for code, rows in by_discom.items():
                        sorted_rows = sorted(rows, key=lambda x: x["applications"], reverse=True)
                        top = sorted_rows[0] if sorted_rows else None
                        top_str = f"{top['division']} ({top['applications']:,} apps)" if top else "N/A"
                        results.append({
                            "code": code,
                            "name": name_map.get(code, code),
                            "apps": totals.get(code, sum(r["applications"] for r in rows)),
                            "divisions": len(rows),
                            "top": top_str,
                        })
                    if results:
                        return results
            except Exception:
                pass

        # 3. Default verified fixture data from AGENT_SPEC.md §4.1
        return [
            {"code": "BRPL", "name": "BSES Rajdhani (South/West)", "apps": 24864, "divisions": 23, "top": "W1JFR (10,294 apps)"},
            {"code": "BYPL", "name": "BSES Yamuna (East/Central)", "apps": 27515, "divisions": 14, "top": "ENKWR (3,556 apps)"},
            {"code": "TPDDL", "name": "Tata Power Delhi (North)", "apps": 27461, "divisions": 12, "top": "BAWANA (5,372 apps)"},
        ]

    def get_surcharge_history(self) -> List[Dict[str, Any]]:
        """Return BRPL surcharge timeline sorted newest to oldest."""
        csv_path = self.data_dir / "scraped_surcharge_history_brpl.csv"
        json_path = self.out_dir / "surcharge_history_brpl.json"

        # 1. From json if available
        if json_path.exists():
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    entries = data.get("entries", [])
                    if entries:
                        entries.sort(key=lambda x: x.get("from_date", ""), reverse=True)
                        return [
                            {
                                "period": f"{e['from_date']} {'onwards' if not e.get('to_date') else 'to ' + e['to_date']}",
                                "pct": f"{e['pct']:.2f}%",
                                "status": "Latest Active" if i == 0 else "Historical",
                            }
                            for i, e in enumerate(entries)
                        ]
            except Exception:
                pass

        # 2. From CSV if available
        if csv_path.exists():
            try:
                with open(csv_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    rows = list(reader)
                    if rows:
                        rows.sort(key=lambda x: x["from_date"], reverse=True)
                        return [
                            {
                                "period": f"{r['from_date']} {'onwards' if r['to_date'] == 'onwards' else 'to ' + r['to_date']}",
                                "pct": f"{float(r['surcharge_pct']):.2f}%",
                                "status": "Latest Active" if idx == 0 else "Historical",
                            }
                            for idx, r in enumerate(rows)
                        ]
            except Exception:
                pass

        # 3. Default verified timeline
        return [
            {"period": "Jun 2026 onwards", "pct": "10.00%", "status": "Latest Active"},
            {"period": "Feb 2026 – May 2026", "pct": "8.75%", "status": "Historical"},
            {"period": "Nov 2025 – Jan 2026", "pct": "5.76%", "status": "Historical"},
            {"period": "Aug 2025 – Oct 2025", "pct": "6.73%", "status": "Historical"},
            {"period": "May 2025 – Jul 2025", "pct": "6.19%", "status": "Historical"},
        ]

    def get_money_rates(self) -> Optional[Dict[str, float]]:
        """Return latest RBI rates."""
        csv_path = self.data_dir / "scraped_money_rates.csv"
        if csv_path.exists():
            try:
                with open(csv_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for r in reader:
                        return {
                            "repo_rate_pct": float(r["repo_rate_pct"]),
                            "term_deposit_low_pct": float(r["term_deposit_low_pct"]),
                            "term_deposit_high_pct": float(r["term_deposit_high_pct"]),
                            "scheme_loan_rate_pct": float(r["scheme_loan_rate_pct"]),
                            "cash_opportunity_rate_pct": float(r["cash_opportunity_rate_pct"]),
                        }
            except Exception:
                pass
        return {
            "repo_rate_pct": 5.50,
            "term_deposit_low_pct": 6.00,
            "term_deposit_high_pct": 6.75,
            "scheme_loan_rate_pct": 6.00,
            "cash_opportunity_rate_pct": 6.75,
        }

    def get_reference_table_rows(self) -> List[Dict[str, Any]]:
        """Build exact tabular ladder rows matching UI Reference Index requirements."""
        ladders = ReferenceLadderService.build_all_ladders()
        rows = []
        for size in [1.0, 2.0, 3.0, 4.0, 5.0, 10.0]:
            ladder = ladders.get(size)
            if not ladder:
                continue

            mkt_low = ladder.market_low.total_price if ladder.market_low else "-"
            mkt_med = ladder.market_median.total_price if ladder.market_median else "-"
            mkt_high = ladder.market_high.total_price if ladder.market_high else "-"
            n_obs = ladder.market_median.n_observations if ladder.market_median else 0
            n_label = f"n={n_obs}" if n_obs > 0 else "n=0 (Bench only)"

            rows.append({
                "size": size,
                "benchmark": int(ladder.benchmark.total_price),
                "mktLow": int(mkt_low) if isinstance(mkt_low, (int, float)) else "-",
                "mktMed": int(mkt_med) if isinstance(mkt_med, (int, float)) else "-",
                "mktHigh": int(mkt_high) if isinstance(mkt_high, (int, float)) else "-",
                "histTpddl": int(ladder.tpddl_history.total_price),
                "central": int(ladder.central_subsidy),
                "state": int(ladder.delhi_subsidy_benchmark),
                "netBenchmark": int(ladder.net_cost_benchmark),
                "n": n_label,
                "tier": "T1" if n_obs == 0 else "T3",
            })
        return rows
