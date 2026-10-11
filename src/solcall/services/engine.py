"""SolCall Layer 3 Math Engine Domain Service.

Orchestrates the complete calculation pipeline for a Delhi household:
1. Tariff billing & fitted calibration multiplier
2. Delhi power subsidy classification (gross) and deduction (net)
3. 25-year solar PV generation with degradation
4. DERC net metering simulation with carry-forward banking
5. Central (PM Surya Ghar) & Delhi State capital subsidies
6. Financial metrics (NPV, Payback, IRR, LCOE, Spread, EMI, DSCR)
7. Final investment verdict (GO, GO_FREE, MARGINAL, NOT_WORTH)
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional, Union
from solcall.domain.value_objects import RouteType
from solcall.domain.tariff import TariffSchedule
from solcall.domain.subsidy import (
    PowerSubsidyCalculator,
    CapitalSubsidyCalculator,
)
from solcall.domain.solar_yield import SolarYieldModel
from solcall.domain.net_metering import (
    NetMeteringSimulator,
    NetMeteringAnnualResult,
)
from solcall.domain.finance import FinancialCalculator, FinancialMetrics
from solcall.domain.verdict import VerdictService, VerdictType, DecisionRationale


@dataclass(frozen=True)
class HouseholdEvaluation:
    """Comprehensive mathematical evaluation result for a household configuration."""
    gross_units_monthly: float
    sanctioned_load_kw: float
    system_size_kw: float
    route: RouteType
    gross_price: float
    central_subsidy: float
    delhi_subsidy: float
    net_cost: float
    bill_now_monthly: float
    bill_with_monthly: float
    surplus_payout_y1: float
    incentive_y1: float
    saving_y1: float
    value_per_unit: float
    cost_per_unit: float
    spread_per_unit: float
    payback_simple_y: Optional[float]
    payback_disc_y: Optional[float]
    npv: float
    npv_if_cash: float
    irr: Optional[float]
    emi_monthly: float
    dscr: float
    verdict: VerdictType
    verdict_reason: str
    net_metering_y1: NetMeteringAnnualResult
    financials: FinancialMetrics


class SolarMathEngine:
    """Core mathematical engine service executing Layer 3 business rules."""

    def __init__(
        self,
        tariff: Optional[TariffSchedule] = None,
        yield_model: Optional[SolarYieldModel] = None,
        surplus_rate: float = 3.50,  # conservative ₹3.5/kWh default
        scheme_loan_rate: float = 0.06,  # repo 5.50% + 0.50% = 6.00%
        cash_opportunity_rate: float = 0.0675,  # 6.75%
    ) -> None:
        self.tariff = tariff or TariffSchedule()
        self.power_subsidy_calc = PowerSubsidyCalculator(tariff=self.tariff)
        self.yield_model = yield_model or SolarYieldModel()
        self.surplus_rate = surplus_rate
        self.scheme_loan_rate = scheme_loan_rate
        self.cash_opportunity_rate = cash_opportunity_rate
        self.net_metering_sim = NetMeteringSimulator(
            subsidy_calc=self.power_subsidy_calc,
            surplus_rate=self.surplus_rate,
        )

    def evaluate_household(
        self,
        consumption: Union[float, List[float]],
        sanctioned_load_kw: float,
        system_size_kw: float,
        gross_price: Optional[float] = None,
        route: RouteType = RouteType.STANDARD,
        surplus_rate: Optional[float] = None,
        scheme_loan_rate: Optional[float] = None,
        cash_opportunity_rate: Optional[float] = None,
    ) -> HouseholdEvaluation:
        """Run complete mathematical evaluation for a household configuration."""
        # Normalize monthly consumption
        if isinstance(consumption, (int, float)):
            monthly_consumption = [float(consumption)] * 12
        else:
            if len(consumption) != 12:
                raise ValueError("Consumption list must have exactly 12 monthly values.")
            monthly_consumption = [float(c) for c in consumption]

        avg_gross_units = sum(monthly_consumption) / 12.0
        effective_surplus_rate = surplus_rate if surplus_rate is not None else self.surplus_rate
        loan_rate = scheme_loan_rate if scheme_loan_rate is not None else self.scheme_loan_rate
        cash_rate = cash_opportunity_rate if cash_opportunity_rate is not None else self.cash_opportunity_rate

        # Determine gross capital cost if not provided
        if gross_price is None:
            gross_price = CapitalSubsidyCalculator.benchmark_cost(system_size_kw)

        is_free_route = (route == RouteType.FREE)

        # 1. Capital subsidies and net cost
        central_sub = CapitalSubsidyCalculator.central_subsidy(system_size_kw)
        delhi_sub = CapitalSubsidyCalculator.delhi_subsidy(system_size_kw, gross_price)
        net_cost = CapitalSubsidyCalculator.net_cost(system_size_kw, gross_price, is_free_route=is_free_route)

        # 2. Simulate 25 years of net-metering and generation
        simulator = (
            self.net_metering_sim
            if effective_surplus_rate == self.surplus_rate
            else NetMeteringSimulator(subsidy_calc=self.power_subsidy_calc, surplus_rate=effective_surplus_rate)
        )

        annual_savings_25: List[float] = []
        annual_gen_25: List[float] = []
        year_1_result: Optional[NetMeteringAnnualResult] = None

        for year in range(1, FinancialCalculator.LIFE_YEARS + 1):
            gen_monthly = self.yield_model.monthly_generation(system_size_kw, year=year)
            annual_gen = sum(gen_monthly)
            annual_gen_25.append(annual_gen)

            sim_result = simulator.simulate_year(
                monthly_consumption=monthly_consumption,
                monthly_generation=gen_monthly,
                sanctioned_load_kw=sanctioned_load_kw,
            )

            if year == 1:
                year_1_result = sim_result

            annual_savings_25.append(sim_result.total_savings)

        assert year_1_result is not None

        # 3. Financial analysis
        financials = FinancialCalculator.analyze_lifecycle(
            system_kw=system_size_kw,
            net_cost=net_cost,
            annual_savings_series=annual_savings_25,
            annual_generation_series=annual_gen_25,
            scheme_loan_rate=loan_rate,
            cash_opportunity_rate=cash_rate,
            is_free_route=is_free_route,
        )

        # 4. Investment verdict
        decision: DecisionRationale = VerdictService.evaluate(
            metrics=financials,
            is_free_route=is_free_route,
        )

        return HouseholdEvaluation(
            gross_units_monthly=avg_gross_units,
            sanctioned_load_kw=sanctioned_load_kw,
            system_size_kw=system_size_kw,
            route=route,
            gross_price=gross_price,
            central_subsidy=central_sub,
            delhi_subsidy=delhi_sub,
            net_cost=net_cost,
            bill_now_monthly=year_1_result.baseline_annual_bill / 12.0,
            bill_with_monthly=year_1_result.with_solar_annual_bill / 12.0,
            surplus_payout_y1=year_1_result.surplus_payout,
            incentive_y1=year_1_result.under200_incentive,
            saving_y1=financials.year_1_saving,
            value_per_unit=financials.value_per_unit,
            cost_per_unit=financials.lcoe,
            spread_per_unit=financials.spread_per_unit,
            payback_simple_y=financials.payback_simple_years,
            payback_disc_y=financials.payback_discounted_years,
            npv=financials.npv,
            npv_if_cash=financials.npv_if_cash,
            irr=financials.irr,
            emi_monthly=financials.emi_monthly,
            dscr=financials.dscr,
            verdict=decision.verdict,
            verdict_reason=decision.reason,
            net_metering_y1=year_1_result,
            financials=financials,
        )
