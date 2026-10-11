"""Delhi Domestic Electricity Tariff Model.

Implements the slab-based energy tariff, sanctioned load fixed charge bands,
empirical bill calibration multiplier m, and pre-subsidy billing formulas
specified in AGENT_SPEC.md §3 and §5.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Tuple
from solcall.domain.value_objects import EnergySlab, FixedChargeBand, CalibrationPoint


# Standard DERC domestic energy slabs (AGENT_SPEC.md §3)
DEFAULT_ENERGY_SLABS: Tuple[EnergySlab, ...] = (
    EnergySlab(min_units=0.0, max_units=200.0, rate_per_kwh=3.00),
    EnergySlab(min_units=200.0, max_units=400.0, rate_per_kwh=4.50),
    EnergySlab(min_units=400.0, max_units=800.0, rate_per_kwh=6.50),
    EnergySlab(min_units=800.0, max_units=1200.0, rate_per_kwh=7.00),
    EnergySlab(min_units=1200.0, max_units=None, rate_per_kwh=8.00),
)

# Standard DERC domestic fixed charge bands per kW per month
DEFAULT_FIXED_CHARGE_BANDS: Tuple[FixedChargeBand, ...] = (
    FixedChargeBand(min_kw=0.0, max_kw=2.0, rate_per_kw_month=20.0),
    FixedChargeBand(min_kw=2.0, max_kw=5.0, rate_per_kw_month=50.0),
    FixedChargeBand(min_kw=5.0, max_kw=15.0, rate_per_kw_month=100.0),
    FixedChargeBand(min_kw=15.0, max_kw=25.0, rate_per_kw_month=200.0),
    FixedChargeBand(min_kw=25.0, max_kw=None, rate_per_kw_month=250.0),
)

# Government calibration points from Delhi Solar Policy 2023 2nd amendment
DEFAULT_CALIBRATION_POINTS: Tuple[CalibrationPoint, ...] = (
    CalibrationPoint(units_kwh=400.0, load_kw=3.0, actual_bill_inr=2272.0),
    CalibrationPoint(units_kwh=100.0, load_kw=3.0, actual_bill_inr=613.0),
)


@dataclass(frozen=True)
class TariffSchedule:
    """Delhi Domestic Electricity Tariff Schedule with calibration multiplier."""

    slabs: Tuple[EnergySlab, ...] = DEFAULT_ENERGY_SLABS
    fixed_bands: Tuple[FixedChargeBand, ...] = DEFAULT_FIXED_CHARGE_BANDS
    calibration_points: Tuple[CalibrationPoint, ...] = DEFAULT_CALIBRATION_POINTS

    def calculate_energy_charge(self, units: float) -> float:
        """E(u) = Σ slab_rate × units falling in that slab."""
        if units <= 0:
            return 0.0
        total_energy_charge = 0.0
        for slab in self.slabs:
            units_in_slab = slab.units_in_slab(units)
            total_energy_charge += units_in_slab * slab.rate_per_kwh
        return total_energy_charge

    def calculate_fixed_charge_rate(self, load_kw: float) -> float:
        """Find the applicable fixed charge rate (₹/kW/month) for a given load."""
        for band in self.fixed_bands:
            if band.min_kw < load_kw <= (band.max_kw if band.max_kw is not None else float("inf")):
                return band.rate_per_kw_month
            # Special case for load <= 2 kW (including 0 to 2)
            if band.min_kw == 0.0 and load_kw <= (band.max_kw if band.max_kw is not None else 2.0):
                return band.rate_per_kw_month
        return 50.0  # fallback standard

    def calculate_fixed_charge(self, load_kw: float) -> float:
        """F(L) = band_rate(L) × L (L = sanctioned load, kW)."""
        rate = self.calculate_fixed_charge_rate(load_kw)
        return rate * load_kw

    def calculate_base_bill(self, units: float, load_kw: float) -> float:
        """Base pre-multiplier bill: E(u) + F(L)."""
        return self.calculate_energy_charge(units) + self.calculate_fixed_charge(load_kw)

    def calibration_multipliers(self) -> List[float]:
        """Compute the empirical multiplier m for each calibration point."""
        multipliers: List[float] = []
        for pt in self.calibration_points:
            base = self.calculate_base_bill(pt.units_kwh, pt.load_kw)
            multipliers.append(pt.actual_bill_inr / base)
        return multipliers

    @property
    def fitted_multiplier(self) -> float:
        """m = mean over calibration points of bill / (E(u) + F(L)) -> ~1.3696.

        Absorbs PPAC (Power Purchase Adjustment Cost), pension surcharge, and electricity tax.
        """
        mults = self.calibration_multipliers()
        return sum(mults) / len(mults)

    def calculate_bill(self, units: float, load_kw: float) -> float:
        """Bill(u, L) = m × (E(u) + F(L)).

        Pre-subsidy total electricity bill in INR.
        """
        base = self.calculate_base_bill(units, load_kw)
        return self.fitted_multiplier * base
