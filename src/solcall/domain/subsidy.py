"""Subsidy Domain Models for SolCall.

Encapsulates:
1. Delhi Power Subsidy (gross consumption eligibility applied to net bill)
2. Central Capital Subsidy (PM Surya Ghar Residential CFA)
3. Delhi State Capital Subsidy (Delhi Solar Policy 2023 2nd amendment)
4. MNRE Benchmark Cost and Free Scheme Eligibility logic.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Tuple
from solcall.domain.tariff import TariffSchedule


@dataclass(frozen=True)
class PowerSubsidyCalculator:
    """Calculates Delhi government power bill subsidy and net payable amount.

    Key rule from AGENT_SPEC.md §5 (AMEND2 cl. 4.14):
    - Subsidy bracket/eligibility is strictly decided by GROSS consumption.
    - Subsidy is then applied to reduce the NET (after solar) bill.
    """
    tariff: TariffSchedule

    def calculate_subsidy_and_payable(
        self, gross_units: float, billed_net_units: float, load_kw: float
    ) -> Tuple[float, float, float]:
        """Compute (net_bill_before_subsidy, subsidy_amount, net_payable_amount)."""
        net_bill = self.tariff.calculate_bill(billed_net_units, load_kw)

        if gross_units <= 200.0:
            # 100% subsidy of the net bill
            subsidy = net_bill
        elif gross_units <= 400.0:
            # 50% of gross bill, capped at ₹800 and capped at net bill
            gross_bill = self.tariff.calculate_bill(gross_units, load_kw)
            subsidy = min(0.5 * gross_bill, 800.0, net_bill)
        else:
            # gross > 400: no subsidy
            subsidy = 0.0

        payable = max(0.0, net_bill - subsidy)
        return net_bill, subsidy, payable

    def calculate_payable(
        self, gross_units: float, billed_net_units: float, load_kw: float
    ) -> float:
        """Payable bill amount in INR after Delhi power subsidy."""
        _, _, payable = self.calculate_subsidy_and_payable(
            gross_units, billed_net_units, load_kw
        )
        return payable


@dataclass(frozen=True)
class CapitalSubsidyCalculator:
    """PM Surya Ghar Central Subsidy and Delhi State Solar Subsidy Calculator.

    Formulas from AGENT_SPEC.md §5:
    - central(k) = 30,000 × min(k,2) + 18,000 × min(max(k−2,0),1)  [cap ₹78,000]
    - delhi(k, P) = max(0, min(26,000 × min(k,3), 78,000, P − central(k)))
    - benchmark(k) = 50,000 × min(k,2) + 45,000 × max(k−2,0)
    - net_cost = 0 on free route; else max(0, P − central − delhi)
    """

    @staticmethod
    def central_subsidy(system_kw: float) -> float:
        """PM Surya Ghar CFA subsidy up to 3 kW capacity."""
        k = max(0.0, system_kw)
        sub = 30_000.0 * min(k, 2.0) + 18_000.0 * min(max(k - 2.0, 0.0), 1.0)
        return min(sub, 78_000.0)

    @classmethod
    def delhi_subsidy(cls, system_kw: float, gross_price: float) -> float:
        """Delhi State Solar Policy 2023 (2nd amendment) subsidy."""
        k = max(0.0, system_kw)
        cen = cls.central_subsidy(k)
        max_state_cap = 78_000.0
        calculated_state = 26_000.0 * min(k, 3.0)
        available_margin = gross_price - cen
        return max(0.0, min(calculated_state, max_state_cap, available_margin))

    @staticmethod
    def benchmark_cost(system_kw: float) -> float:
        """Government benchmark cost for solar PV systems."""
        k = max(0.0, system_kw)
        return 50_000.0 * min(k, 2.0) + 45_000.0 * max(k - 2.0, 0.0)

    @classmethod
    def net_cost(
        cls, system_kw: float, gross_price: float, is_free_route: bool = False
    ) -> float:
        """Out of pocket capital cost for the consumer after all subsidies."""
        if is_free_route:
            return 0.0
        cen = cls.central_subsidy(system_kw)
        state = cls.delhi_subsidy(system_kw, gross_price)
        return max(0.0, gross_price - cen - state)

    @staticmethod
    def is_free_scheme_eligible(
        avg_gross_units_monthly: float, system_kw: float
    ) -> bool:
        """Eligibility for Delhi Free Solar Scheme:

        Requires previous-FY average gross <= 400 units/month and system capacity <= 3 kW.
        Note: Currently marked operational = False in policy status.
        """
        return (avg_gross_units_monthly <= 400.0) and (system_kw <= 3.0)
