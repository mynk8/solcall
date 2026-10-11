"""Delhi Solar Yield and Generation Profile Model.

Encapsulates:
- Global Solar Atlas minimum annual yield (1,466 kWh/kWp/year)
- Extra losses (5% for Delhi dust, smog, and ambient haze)
- Monthly solar output distribution (reordered April..March for fiscal cycle)
- Annual PV module degradation (0.5% per year)
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Tuple, List

# Raw monthly generation (kWh/kWp) for Delhi Central point (Jan..Dec) from Global Solar Atlas
CENTRAL_MONTHLY_KWH_PER_KWP: Tuple[float, ...] = (
    100.22,  # Jan
    121.14,  # Feb
    150.47,  # Mar
    146.88,  # Apr
    137.95,  # May
    118.80,  # Jun
    105.93,  # Jul
    114.05,  # Aug
    125.37,  # Sep
    131.91,  # Oct
    108.72,  # Nov
    104.53,  # Dec
)

# 5 Delhi geographic coordinates annual yield (kWh/kWp)
GSA_FIVE_POINTS_ANNUAL: Tuple[float, ...] = (
    1465.97,  # Central
    1492.74,  # Narela
    1468.47,  # Dwarka
    1471.14,  # Mayur Vihar
    1473.11,  # Saket
)


@dataclass(frozen=True)
class SolarYieldModel:
    """Calculates monthly and annual solar power generation for Delhi rooftop systems."""

    engine_annual_yield: float = 1466.0  # min over 5 Delhi points (T2 World Bank)
    extra_losses: float = 0.05           # 5% dust and haze derating factor
    degradation_rate: float = 0.005      # 0.5% yearly module degradation

    @property
    def net_annual_specific_yield(self) -> float:
        """annual = engine_value × (1 − extra_losses) -> ~1392.7 kWh/kWp/year."""
        return self.engine_annual_yield * (1.0 - self.extra_losses)

    @property
    def normalized_shares_jan_dec(self) -> List[float]:
        """Normalized generation shares for Jan..Dec summing to 1.0."""
        total = sum(CENTRAL_MONTHLY_KWH_PER_KWP)
        return [m / total for m in CENTRAL_MONTHLY_KWH_PER_KWP]

    @property
    def normalized_shares_apr_mar(self) -> List[float]:
        """Normalized generation shares reordered April..March for the net metering fiscal year."""
        jan_dec = self.normalized_shares_jan_dec
        # Calendar indices: Apr(3)..Dec(11) + Jan(0)..Mar(2)
        return jan_dec[3:12] + jan_dec[0:3]

    def monthly_generation(self, system_kw: float, year: int = 1) -> List[float]:
        """Calculate generation per month (April..March) for a given year (1-indexed).

        g_m(k, year) = k × annual × share_m × (1 − 0.005)^(year − 1)
        """
        if system_kw <= 0:
            return [0.0] * 12
        annual_specific = self.net_annual_specific_yield
        degradation_factor = (1.0 - self.degradation_rate) ** (max(1, year) - 1)
        annual_gen = system_kw * annual_specific * degradation_factor
        apr_mar_shares = self.normalized_shares_apr_mar
        return [annual_gen * share for share in apr_mar_shares]

    def annual_generation(self, system_kw: float, year: int = 1) -> float:
        """Total annual generation in kWh for year t."""
        return sum(self.monthly_generation(system_kw, year))
