"""Financial Metrics and Lifecycle Analysis Model for SolCall.

Encapsulates 25-year lifecycle calculations:
- Annual cash flows (savings minus O&M and inverter replacement)
- Net Present Value (NPV) and Cash Opportunity NPV
- Simple and Discounted Payback Periods
- Internal Rate of Return (IRR) via numerical bisection
- Levelized Cost of Electricity (LCOE)
- Value per unit and Tariff-Generation Spread
- Loan Equated Monthly Installment (EMI) and Debt Service Coverage Ratio (DSCR)
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class FinancialMetrics:
    """Comprehensive 25-year lifecycle financial metrics."""
    net_cost: float
    year_1_saving: float
    year_1_generation: float
    npv: float
    npv_if_cash: float
    payback_simple_years: Optional[float]
    payback_discounted_years: Optional[float]
    irr: Optional[float]
    lcoe: float
    value_per_unit: float
    spread_per_unit: float
    emi_monthly: float
    dscr: float
    cash_flows: List[float]


class FinancialCalculator:
    """Calculates financial lifecycle indicators specified in AGENT_SPEC.md §5."""

    LIFE_YEARS: int = 25
    LOAN_TENURE_MONTHS: int = 120  # 10 years standard
    OM_COST_PER_KW_YEAR: float = 600.0  # From year 6 onwards
    INVERTER_REPLACEMENT_YEAR: int = 12
    INVERTER_COST_PER_KW: float = 8000.0

    @staticmethod
    def calculate_emi(principal: float, annual_rate: float, tenure_months: int = 120) -> float:
        """Calculate loan EMI using standard monthly amortization formula.

        EMI = P × i × (1+i)^n / ((1+i)^n − 1), where i = annual_rate / 12.
        """
        if principal <= 0.0 or tenure_months <= 0:
            return 0.0
        if annual_rate <= 0.0:
            return principal / tenure_months

        monthly_rate = annual_rate / 12.0
        compounded = (1.0 + monthly_rate) ** tenure_months
        emi = principal * (monthly_rate * compounded) / (compounded - 1.0)
        return emi

    @classmethod
    def calculate_other_costs(cls, system_kw: float, year: int) -> float:
        """other_cost_t = (t ≤ 5 ? 0 : 600 × k) + (t = 12 ? 8,000 × k : 0)."""
        om = 0.0 if year <= 5 else cls.OM_COST_PER_KW_YEAR * system_kw
        inverter = cls.INVERTER_COST_PER_KW * system_kw if year == cls.INVERTER_REPLACEMENT_YEAR else 0.0
        return om + inverter

    @staticmethod
    def calculate_npv(discount_rate: float, initial_investment: float, cash_flows: List[float]) -> float:
        """NPV = −net_cost + Σ flow_t / (1+r)^t, t = 1..N."""
        npv_val = -initial_investment
        for t, flow in enumerate(cash_flows, start=1):
            npv_val += flow / ((1.0 + discount_rate) ** t)
        return npv_val

    @staticmethod
    def calculate_irr(initial_investment: float, cash_flows: List[float]) -> Optional[float]:
        """Compute Internal Rate of Return (IRR) where NPV = 0 using bisection.

        Handles standard cash flow series [-initial_investment, flow_1, flow_2, ...].
        """
        if initial_investment <= 0.0:
            # Zero capital cost represents essentially infinite return
            return 9.99

        total_inflow = sum(cash_flows)
        if total_inflow <= initial_investment:
            # Project never breaks even nominal
            return None

        # Bisection bounds
        low = -0.50
        high = 5.0  # up to 500%

        # Quick check if root exists within [low, high]
        def npv_at(r: float) -> float:
            val = -initial_investment
            for t, flow in enumerate(cash_flows, start=1):
                val += flow / ((1.0 + r) ** t)
            return val

        if npv_at(low) * npv_at(high) > 0:
            # Both same sign or root outside
            if npv_at(high) > 0:
                return high
            return None

        for _ in range(80):
            mid = (low + high) / 2.0
            val_mid = npv_at(mid)
            if abs(val_mid) < 1e-6:
                return mid
            if val_mid > 0:
                low = mid
            else:
                high = mid

        return (low + high) / 2.0

    @staticmethod
    def calculate_payback_simple(initial_investment: float, cash_flows: List[float]) -> Optional[float]:
        """Compute simple (non-discounted) fractional payback years."""
        if initial_investment <= 0.0:
            return 0.0

        cum = 0.0
        for t, flow in enumerate(cash_flows, start=1):
            prev_cum = cum
            cum += flow
            if cum >= initial_investment:
                fraction = (initial_investment - prev_cum) / flow if flow > 0 else 0.0
                return (t - 1) + max(0.0, min(1.0, fraction))
        return None

    @staticmethod
    def calculate_payback_discounted(
        initial_investment: float, cash_flows: List[float], discount_rate: float
    ) -> Optional[float]:
        """Compute discounted fractional payback years."""
        if initial_investment <= 0.0:
            return 0.0

        cum = 0.0
        for t, flow in enumerate(cash_flows, start=1):
            prev_cum = cum
            disc_flow = flow / ((1.0 + discount_rate) ** t)
            cum += disc_flow
            if cum >= initial_investment:
                fraction = (initial_investment - prev_cum) / disc_flow if disc_flow > 0 else 0.0
                return (t - 1) + max(0.0, min(1.0, fraction))
        return None

    @classmethod
    def analyze_lifecycle(
        cls,
        system_kw: float,
        net_cost: float,
        annual_savings_series: List[float],    # 25 years of savings
        annual_generation_series: List[float], # 25 years of generation
        scheme_loan_rate: float = 0.06,        # repo + 0.50%
        cash_opportunity_rate: float = 0.0675, # RBI term deposit top
        is_free_route: bool = False,
    ) -> FinancialMetrics:
        """Run complete 25-year lifecycle financial analysis (§5)."""
        cash_flows: List[float] = []
        discounted_gen_sum = 0.0
        discounted_other_cost_sum = 0.0

        for t in range(1, cls.LIFE_YEARS + 1):
            saving_t = annual_savings_series[t - 1]
            gen_t = annual_generation_series[t - 1]
            other_cost_t = cls.calculate_other_costs(system_kw, t)

            flow_t = saving_t - other_cost_t
            cash_flows.append(flow_t)

            disc_factor = (1.0 + scheme_loan_rate) ** t
            discounted_gen_sum += gen_t / disc_factor
            discounted_other_cost_sum += other_cost_t / disc_factor

        npv_loan = cls.calculate_npv(scheme_loan_rate, net_cost, cash_flows)
        npv_cash = cls.calculate_npv(cash_opportunity_rate, net_cost, cash_flows)

        payback_simple = cls.calculate_payback_simple(net_cost, cash_flows)
        payback_disc = cls.calculate_payback_discounted(net_cost, cash_flows, scheme_loan_rate)
        irr_val = cls.calculate_irr(net_cost, cash_flows)

        # LCOE = [net_cost + Σ other_cost_t/(1+r)^t] / Σ gen_t/(1+r)^t
        lcoe = (
            (net_cost + discounted_other_cost_sum) / discounted_gen_sum
            if discounted_gen_sum > 0
            else 0.0
        )

        year_1_saving = annual_savings_series[0] if annual_savings_series else 0.0
        year_1_gen = annual_generation_series[0] if annual_generation_series else 0.0

        # value/unit = saving_1 / gen_1
        value_per_unit = year_1_saving / year_1_gen if year_1_gen > 0 else 0.0
        spread = value_per_unit - lcoe

        # EMI only for k <= 3 and paid route
        eligible_for_loan = (system_kw <= 3.0) and (not is_free_route) and (net_cost > 0)
        emi = (
            cls.calculate_emi(net_cost, scheme_loan_rate, cls.LOAN_TENURE_MONTHS)
            if eligible_for_loan
            else 0.0
        )

        # DSCR = (saving_1 / 12) / EMI
        if emi > 0:
            dscr = (year_1_saving / 12.0) / emi
        else:
            dscr = float("inf")

        return FinancialMetrics(
            net_cost=net_cost,
            year_1_saving=year_1_saving,
            year_1_generation=year_1_gen,
            npv=npv_loan,
            npv_if_cash=npv_cash,
            payback_simple_years=payback_simple,
            payback_discounted_years=payback_disc,
            irr=irr_val,
            lcoe=lcoe,
            value_per_unit=value_per_unit,
            spread_per_unit=spread,
            emi_monthly=emi,
            dscr=dscr,
            cash_flows=cash_flows,
        )
