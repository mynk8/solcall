"""SolCall Layer 3 Execution Pipeline.

Executes the mathematical domain engine and builds all feeds into `out/`:
1. `reference_price.json`
2. `feed_household_conservative.csv`
3. `feed_household_policy_example_appc.csv`
4. `feed_best_size_conservative.csv`
5. `feed_best_size_policy_example_appc.csv`
6. `provenance.json`
"""

from __future__ import annotations
import sys
from pathlib import Path

# Ensure src is on sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "src"))

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from solcall.services.engine import SolarMathEngine
from solcall.services.feed_generator import FeedGeneratorService


def main() -> None:
    data_dir = BASE_DIR / "data"
    out_dir = BASE_DIR / "out"

    print("=" * 60)
    print("SolCall - Layer 3 Mathematical Engine Pipeline")
    print("=" * 60)

    engine = SolarMathEngine()
    print(f"-> Fitted tariff calibration multiplier m: {engine.tariff.fitted_multiplier:.6f}")
    print(f"-> Net annual specific solar yield: {engine.yield_model.net_annual_specific_yield:.2f} kWh/kWp/year")

    # Demo case verification (450 units, 3 kW load, 3 kW system)
    demo_eval = engine.evaluate_household(
        consumption=450.0,
        sanctioned_load_kw=3.0,
        system_size_kw=3.0,
    )
    print("\n--- Demo Household Case (450 units/month, 3 kW load, 3 kW solar) ---")
    print(f"Gross benchmark price:  ₹{demo_eval.gross_price:,.2f}")
    print(f"Central subsidy:        ₹{demo_eval.central_subsidy:,.2f}")
    print(f"Delhi state subsidy:    ₹{demo_eval.delhi_subsidy:,.2f}")
    print(f"Net consumer cost:      ₹{demo_eval.net_cost:,.2f}")
    print(f"Monthly bill now:       ₹{demo_eval.bill_now_monthly:,.2f}")
    print(f"Monthly bill with solar:₹{demo_eval.bill_with_monthly:,.2f}")
    print(f"Year 1 savings:         ₹{demo_eval.saving_y1:,.2f}")
    print(f"Discounted payback:     {demo_eval.payback_disc_y:.2f} years")
    print(f"Simple payback:         {demo_eval.payback_simple_y:.2f} years")
    print(f"Spread:                 ₹{demo_eval.spread_per_unit:.2f}/kWh")
    print(f"25-year NPV:            ₹{demo_eval.npv:,.2f}")
    print(f"Verdict:                [{demo_eval.verdict.value}] - {demo_eval.verdict_reason}")

    print("\nGenerating household feeds and catalogs into out/...")
    generator = FeedGeneratorService(engine=engine, out_dir=out_dir, data_dir=data_dir)
    generator.generate_all_feeds()
    print("✓ reference_price.json generated.")
    print("✓ feed_household_conservative.csv generated.")
    print("✓ feed_best_size_conservative.csv generated.")
    print("✓ feed_household_policy_example_appc.csv generated.")
    print("✓ feed_best_size_policy_example_appc.csv generated.")
    print("✓ provenance.json generated.")
    print("\nLayer 3 engine execution completed successfully.")


if __name__ == "__main__":
    main()
