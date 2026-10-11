"""DERC Net Metering Simulation Model.

Implements the monthly energy netting cycle (April..March fiscal year),
energy banking / carry-forward logic, annual surplus payout settlement,
and the Delhi Solar Policy under-200 consumption incentive.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple
from solcall.domain.subsidy import PowerSubsidyCalculator


@dataclass(frozen=True)
class MonthlyNetMeteringRecord:
    """Detailed monthly simulation record."""
    month_index: int       # 0..11 corresponding to April..March
    gross_consumption: float  # kWh
    generation: float         # kWh
    bank_in: float            # Banked units available from prior month
    billed_units: float       # Net units billed this month
    bank_out: float           # Banked units carried forward to next month
    self_used_units: float    # Units generated and directly self-consumed
    baseline_payable: float   # Payable bill without solar
    solar_payable: float      # Payable bill with net metering


@dataclass(frozen=True)
class NetMeteringAnnualResult:
    """Annual outcome of the net-metering year."""
    monthly_records: Tuple[MonthlyNetMeteringRecord, ...]
    final_banked_units: float
    surplus_payout: float
    under200_incentive: float
    bill_savings: float
    total_savings: float
    baseline_annual_bill: float
    with_solar_annual_bill: float


@dataclass(frozen=True)
class NetMeteringSimulator:
    """Domain simulator for DERC Net Metering regulations."""
    subsidy_calc: PowerSubsidyCalculator
    surplus_rate: float = 3.50  # Conservative ₹3.5/kWh default; alternative ₹6.5/kWh

    def simulate_year(
        self,
        monthly_consumption: List[float],  # 12 months (April..March)
        monthly_generation: List[float],   # 12 months (April..March)
        sanctioned_load_kw: float,
    ) -> NetMeteringAnnualResult:
        """Simulate a complete 12-month net metering year according to AGENT_SPEC.md §5."""
        if len(monthly_consumption) != 12 or len(monthly_generation) != 12:
            raise ValueError("Monthly consumption and generation lists must contain exactly 12 values.")

        avg_gross = sum(monthly_consumption) / 12.0
        eligible_for_under200 = avg_gross <= 200.0

        records: List[MonthlyNetMeteringRecord] = []
        bank = 0.0

        total_baseline_bill = 0.0
        total_solar_bill = 0.0
        total_self_used = 0.0

        for m_idx in range(12):
            c_m = monthly_consumption[m_idx]
            g_m = monthly_generation[m_idx]
            bank_in = bank

            # Netting formula: x = c_m − g_m − bank
            x = c_m - g_m - bank_in
            billed_m = max(x, 0.0)
            bank_out = max(-x, 0.0)
            bank = bank_out

            self_used_m = min(c_m, g_m)
            total_self_used += self_used_m

            # Billing before and after solar
            baseline_pay = self.subsidy_calc.calculate_payable(c_m, c_m, sanctioned_load_kw)
            solar_pay = self.subsidy_calc.calculate_payable(c_m, billed_m, sanctioned_load_kw)

            total_baseline_bill += baseline_pay
            total_solar_bill += solar_pay

            records.append(
                MonthlyNetMeteringRecord(
                    month_index=m_idx,
                    gross_consumption=c_m,
                    generation=g_m,
                    bank_in=bank_in,
                    billed_units=billed_m,
                    bank_out=bank_out,
                    self_used_units=self_used_m,
                    baseline_payable=baseline_pay,
                    solar_payable=solar_pay,
                )
            )

        final_bank = bank
        payout = final_bank * self.surplus_rate

        # under200_incentive = (avg gross ≤ 200) ? 0.5 × Σ min(c_m, g_m) × 3 : 0
        incentive = (0.5 * total_self_used * 3.0) if eligible_for_under200 else 0.0

        bill_savings = max(0.0, total_baseline_bill - total_solar_bill)
        total_savings = bill_savings + payout + incentive

        return NetMeteringAnnualResult(
            monthly_records=tuple(records),
            final_banked_units=final_bank,
            surplus_payout=payout,
            under200_incentive=incentive,
            bill_savings=bill_savings,
            total_savings=total_savings,
            baseline_annual_bill=total_baseline_bill,
            with_solar_annual_bill=total_solar_bill,
        )
