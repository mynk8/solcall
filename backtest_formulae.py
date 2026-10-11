"""SolCall - Comprehensive Formula Backtesting & Acceptance Test Suite.

Validates all Section 8 acceptance tests and regulatory benchmarks from AGENT_SPEC.md:
1. Tariff billing calibration (400u/3kW -> ₹2,272 ± 1%, 100u/3kW -> ₹613 ± 1%)
2. Multiplier spread agreement (max - min < 0.02)
3. Delhi power subsidy logic (gross-basis eligibility vs net bill deduction)
4. Net metering monthly banking, carry-forward, year-end payout, under-200 incentive
5. Central CFA subsidy formula (1, 2, 3, 5 kW)
6. Delhi State subsidy formula (various capacity & price combinations)
7. MNRE benchmark cost formula (3 kW, 5 kW)
8. Loan EMI amortization (₹1,00,000, 12%, 1 yr -> ₹8,884.88)
9. Internal Rate of Return (IRR bisection on [-100k, 10x 30k] -> 27.32%)
10. Demo case backtest (450 units/month, 3 kW load, 3 kW solar -> payback ~3.3 years)
"""

from __future__ import annotations
import math
import sys
from pathlib import Path

# Ensure src is on sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "src"))

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from solcall.domain.tariff import TariffSchedule
from solcall.domain.subsidy import PowerSubsidyCalculator, CapitalSubsidyCalculator
from solcall.domain.solar_yield import SolarYieldModel
from solcall.domain.net_metering import NetMeteringSimulator
from solcall.domain.finance import FinancialCalculator
from solcall.domain.verdict import VerdictService
from solcall.services.engine import SolarMathEngine


class BacktestRunner:
    def __init__(self) -> None:
        self.passes = 0
        self.fails = 0
        self.results = []

    def check(self, name: str, expected: str, actual: str, condition: bool, notes: str = "") -> None:
        status = "PASS" if condition else "FAIL"
        if condition:
            self.passes += 1
        else:
            self.fails += 1
        self.results.append({
            "name": name,
            "expected": expected,
            "actual": actual,
            "status": status,
            "notes": notes,
        })

    def run_all(self) -> None:
        tariff = TariffSchedule()
        power_sub = PowerSubsidyCalculator(tariff=tariff)
        yield_model = SolarYieldModel()
        engine = SolarMathEngine(tariff=tariff, yield_model=yield_model)

        print("=" * 80)
        print("  SolCall Layer 3 Formula Backtesting (AGENT_SPEC.md §8)")
        print("=" * 80)

        # -------------------------------------------------------------------
        # 1. Tariff Bill Calibration Tests
        # -------------------------------------------------------------------
        bill_400_3kw = tariff.calculate_bill(units=400.0, load_kw=3.0)
        err_400 = abs(bill_400_3kw - 2272.0) / 2272.0
        self.check(
            name="Bill(400 units, 3 kW)",
            expected="₹2,272 ± 1% (2,249.28 – 2,294.72)",
            actual=f"₹{bill_400_3kw:.2f} (err: {err_400*100:.2f}%)",
            condition=err_400 <= 0.01,
            notes="AMEND2 worked example 1"
        )

        bill_100_3kw = tariff.calculate_bill(units=100.0, load_kw=3.0)
        err_100 = abs(bill_100_3kw - 613.0) / 613.0
        self.check(
            name="Bill(100 units, 3 kW)",
            expected="₹613 ± 1% (606.87 – 619.13)",
            actual=f"₹{bill_100_3kw:.2f} (err: {err_100*100:.2f}%)",
            condition=err_100 <= 0.01,
            notes="AMEND2 worked example 2"
        )

        calib_mults = tariff.calibration_multipliers()
        mult_spread = max(calib_mults) - min(calib_mults)
        self.check(
            name="Calibration Multipliers Agree",
            expected="max - min < 0.02",
            actual=f"{mult_spread:.5f} (m1={calib_mults[0]:.4f}, m2={calib_mults[1]:.4f})",
            condition=mult_spread < 0.02,
            notes=f"Fitted m = {tariff.fitted_multiplier:.6f}"
        )

        # -------------------------------------------------------------------
        # 2. Delhi Power Subsidy Logic (Gross Class -> Net Bill Deduction)
        # -------------------------------------------------------------------
        # payable(gross 400, net 400, 3 kW) ≈ 2,272 - 800 = ₹1,472
        pay_400_400 = power_sub.calculate_payable(gross_units=400.0, billed_net_units=400.0, load_kw=3.0)
        self.check(
            name="payable(gross 400, net 400, 3 kW)",
            expected="≈ ₹1,472 (2,272 − 800 capped subsidy)",
            actual=f"₹{pay_400_400:.2f}",
            condition=abs(pay_400_400 - 1472.0) <= 25.0,  # within calibrated range
            notes="50% subsidy capped at ₹800"
        )

        # payable(gross 400, net 100, 3 kW) = ₹0
        pay_400_100 = power_sub.calculate_payable(gross_units=400.0, billed_net_units=100.0, load_kw=3.0)
        self.check(
            name="payable(gross 400, net 100, 3 kW)",
            expected="₹0.00",
            actual=f"₹{pay_400_100:.2f}",
            condition=abs(pay_400_100 - 0.0) < 1e-4,
            notes="50% gross subsidy exceeds 100-unit net bill"
        )

        # payable(gross 450, net 150, 3 kW) = Bill(150, 3 kW) (no subsidy)
        pay_450_150 = power_sub.calculate_payable(gross_units=450.0, billed_net_units=150.0, load_kw=3.0)
        expected_bill_150 = tariff.calculate_bill(units=150.0, load_kw=3.0)
        self.check(
            name="payable(gross 450, net 150, 3 kW)",
            expected=f"Bill(150, 3 kW) = ₹{expected_bill_150:.2f}",
            actual=f"₹{pay_450_150:.2f}",
            condition=abs(pay_450_150 - expected_bill_150) < 1e-4,
            notes="Gross > 400 units -> 0% power subsidy"
        )

        # payable(gross 180, …) = ₹0
        pay_180 = power_sub.calculate_payable(gross_units=180.0, billed_net_units=80.0, load_kw=2.0)
        self.check(
            name="payable(gross 180, net 80, 2 kW)",
            expected="₹0.00",
            actual=f"₹{pay_180:.2f}",
            condition=abs(pay_180 - 0.0) < 1e-4,
            notes="Gross <= 200 units -> 100% net bill subsidy"
        )

        # -------------------------------------------------------------------
        # 3. Net-Metering Simulation & Carry-Forward Tests
        # -------------------------------------------------------------------
        # Year with 150 units/month, 200 generated/month, surplus ₹6.5
        # Expected: payout ₹325/month, incentive ₹225/month, total ₹550/month
        sim_surplus_6_5 = NetMeteringSimulator(subsidy_calc=power_sub, surplus_rate=6.50)
        res_150_200 = sim_surplus_6_5.simulate_year(
            monthly_consumption=[150.0] * 12,
            monthly_generation=[200.0] * 12,
            sanctioned_load_kw=2.0,
        )
        monthly_payout = res_150_200.surplus_payout / 12.0
        monthly_incentive = res_150_200.under200_incentive / 12.0
        monthly_total_benefit = monthly_payout + monthly_incentive

        self.check(
            name="Net-Metering 150c / 200g (Surplus ₹6.5)",
            expected="Payout ₹325/mo, Incentive ₹225/mo, Total ₹550/mo",
            actual=f"Payout ₹{monthly_payout:.2f}/mo, Incentive ₹{monthly_incentive:.2f}/mo, Total ₹{monthly_total_benefit:.2f}/mo",
            condition=(abs(monthly_payout - 325.0) < 0.01) and (abs(monthly_incentive - 225.0) < 0.01),
            notes="Unadjusted surplus settlement + under-200 self-use incentive"
        )

        # Carry-forward: 6 months at 100, 6 at 300, generation 200
        # Expected: banked surplus at year end = 0
        c_6_6 = [100.0] * 6 + [300.0] * 6
        g_6_6 = [200.0] * 12
        res_banking = sim_surplus_6_5.simulate_year(
            monthly_consumption=c_6_6,
            monthly_generation=g_6_6,
            sanctioned_load_kw=2.0,
        )
        self.check(
            name="Carry-Forward Banking (6m @ 100, 6m @ 300, gen 200)",
            expected="Banked surplus at year end = 0.0 units",
            actual=f"Banked surplus = {res_banking.final_banked_units:.2f} units",
            condition=abs(res_banking.final_banked_units - 0.0) < 1e-4,
            notes="600 units banked in first 6 months fully absorbed in next 6 months"
        )

        # -------------------------------------------------------------------
        # 4. Central & Delhi State Capital Subsidies
        # -------------------------------------------------------------------
        # central(1, 2, 3, 5 kW) = 30,000 · 60,000 · 78,000 · 78,000
        cen_1 = CapitalSubsidyCalculator.central_subsidy(1.0)
        cen_2 = CapitalSubsidyCalculator.central_subsidy(2.0)
        cen_3 = CapitalSubsidyCalculator.central_subsidy(3.0)
        cen_5 = CapitalSubsidyCalculator.central_subsidy(5.0)
        self.check(
            name="central(1, 2, 3, 5 kW)",
            expected="30,000 · 60,000 · 78,000 · 78,000",
            actual=f"{int(cen_1):,} · {int(cen_2):,} · {int(cen_3):,} · {int(cen_5):,}",
            condition=(cen_1 == 30000 and cen_2 == 60000 and cen_3 == 78000 and cen_5 == 78000),
            notes="PM Surya Ghar CFA residential caps"
        )

        # delhi(1 kW, ₹2L) · delhi(3 kW, ₹3L) · delhi(5 kW, ₹4L) · delhi(3 kW, ₹1.4L)
        # Expected: 26,000 · 78,000 · 78,000 · 62,000
        del_1 = CapitalSubsidyCalculator.delhi_subsidy(1.0, 200_000.0)
        del_2 = CapitalSubsidyCalculator.delhi_subsidy(3.0, 300_000.0)
        del_3 = CapitalSubsidyCalculator.delhi_subsidy(5.0, 400_000.0)
        del_4 = CapitalSubsidyCalculator.delhi_subsidy(3.0, 140_000.0)
        self.check(
            name="delhi(1k@2L, 3k@3L, 5k@4L, 3k@1.4L)",
            expected="26,000 · 78,000 · 78,000 · 62,000",
            actual=f"{int(del_1):,} · {int(del_2):,} · {int(del_3):,} · {int(del_4):,}",
            condition=(del_1 == 26000 and del_2 == 78000 and del_3 == 78000 and del_4 == 62000),
            notes="Delhi Solar Policy: min(26k*min(k,3), 78k, cost - central)"
        )

        # benchmark(3) · benchmark(5) = 1,45,000 · 2,35,000
        bm_3 = CapitalSubsidyCalculator.benchmark_cost(3.0)
        bm_5 = CapitalSubsidyCalculator.benchmark_cost(5.0)
        self.check(
            name="benchmark(3 kW, 5 kW)",
            expected="1,45,000 · 2,35,000",
            actual=f"{int(bm_3):,} · {int(bm_5):,}",
            condition=(bm_3 == 145000 and bm_5 == 235000),
            notes="50k/kW up to 2kW + 45k/kW beyond"
        )

        # -------------------------------------------------------------------
        # 5. Financial Engineering Math
        # -------------------------------------------------------------------
        # EMI(₹1,00,000, 12%, 1 yr) = ₹8,884.88
        emi_test = FinancialCalculator.calculate_emi(principal=100_000.0, annual_rate=0.12, tenure_months=12)
        self.check(
            name="EMI(₹1,00,000, 12%, 1 yr)",
            expected="₹8,884.88",
            actual=f"₹{emi_test:.2f}",
            condition=abs(emi_test - 8884.87886) < 0.01,
            notes="Monthly amortization formula verification"
        )

        # IRR(−1,00,000; 10 × 30,000) = 27.32%
        irr_cfs = [30_000.0] * 10
        irr_test = FinancialCalculator.calculate_irr(initial_investment=100_000.0, cash_flows=irr_cfs)
        irr_pct = irr_test * 100.0 if irr_test is not None else 0.0
        self.check(
            name="IRR(−₹1,00,000; 10 × ₹30,000)",
            expected="27.32%",
            actual=f"{irr_pct:.2f}%",
            condition=abs(irr_pct - 27.32) < 0.02,
            notes="Numerical bisection root finding"
        )

        # -------------------------------------------------------------------
        # 6. Global Solar Atlas Minimum & Specific Yield
        # -------------------------------------------------------------------
        self.check(
            name="Solar Specific Yield (Global Solar Atlas)",
            expected="min 1,466.0 kWh/kWp/yr, net yield ~1,392.70 (5% loss)",
            actual=f"Engine min = {yield_model.engine_annual_yield:.1f}, Net = {yield_model.net_annual_specific_yield:.2f}",
            condition=(yield_model.engine_annual_yield == 1466.0) and (abs(yield_model.net_annual_specific_yield - 1392.70) < 0.01),
            notes="Normalized Jan..Dec and Apr..Mar shares sum to 1.0"
        )

        # -------------------------------------------------------------------
        # 7. Official Hackathon Demo Benchmark Case
        # (450 units/month, 3 kW load, 3 kW solar, market quote ₹2.40L)
        # Expected: Payback about 3.3 years
        # -------------------------------------------------------------------
        demo_market_eval = engine.evaluate_household(
            consumption=450.0,
            sanctioned_load_kw=3.0,
            system_size_kw=3.0,
            gross_price=240_000.0,  # SolarSquare / Market observation
            route="standard",
        )
        payback_mkt = demo_market_eval.payback_simple_y or 0.0
        self.check(
            name="Demo Case: 450 units, 3 kW (Market Quote ₹2.40L)",
            expected="Payback ≈ 3.3 years (3.0 – 3.6 yrs)",
            actual=f"Payback = {payback_mkt:.2f} yrs (Net cost = ₹{demo_market_eval.net_cost:,.0f}, Savings = ₹{demo_market_eval.saving_y1:,.0f}/yr)",
            condition=3.0 <= payback_mkt <= 3.6,
            notes="Central ₹78k + Delhi ₹78k -> Net cost ₹84k; Annual savings ~₹25k"
        )

        # Print Backtest Summary
        print("\n" + "-" * 80)
        print(f"{'TEST CASE':<45} | {'EXPECTED':<20} | {'ACTUAL':<20} | STATUS")
        print("-" * 80)
        for r in self.results:
            color_mark = "✓ PASS" if r["status"] == "PASS" else "✗ FAIL"
            print(f"{r['name']:<45} | {r['expected'][:20]:<20} | {r['actual'][:20]:<20} | {color_mark}")

        print("=" * 80)
        print(f"Backtesting Complete: {self.passes} PASSED, {self.fails} FAILED out of {len(self.results)} tests.")
        print("=" * 80)


if __name__ == "__main__":
    runner = BacktestRunner()
    runner.run_all()
