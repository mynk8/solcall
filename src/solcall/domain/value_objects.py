"""Domain Value Objects for SolCall.

Immutable value objects capturing physical units, currency, regulatory tiers,
and tariff structures under Domain-Driven Design principles.
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ConfidenceTier(str, Enum):
    """Provenance confidence tier as defined in AGENT_SPEC.md §2."""
    T1 = "T1"  # Government / regulator / DISCOM / RBI
    T2 = "T2"  # World Bank / Solargis / scientific standard
    T3 = "T3"  # Vendor page / market quote (indicative only)


class RouteType(str, Enum):
    """Consumer application path."""
    STANDARD = "standard"
    FREE = "free"


class PriceRungType(str, Enum):
    """Reference price ladder rungs (§5)."""
    BENCHMARK = "benchmark"
    MARKET_LOW = "market_low"
    MARKET_MEDIAN = "market_median"
    MARKET_HIGH = "market_high"
    TPDDL_HIST = "tpddl_hist"


@dataclass(frozen=True)
class EnergyUnits:
    """Electrical energy consumption or generation in kilowatt-hours (kWh)."""
    kwh: float

    def __post_init__(self) -> None:
        if self.kwh < 0:
            raise ValueError(f"EnergyUnits cannot be negative: {self.kwh}")

    def __add__(self, other: EnergyUnits) -> EnergyUnits:
        return EnergyUnits(self.kwh + other.kwh)

    def __sub__(self, other: EnergyUnits) -> EnergyUnits:
        return EnergyUnits(max(0.0, self.kwh - other.kwh))


@dataclass(frozen=True)
class PowerCapacity:
    """Sanctioned electrical load or solar PV capacity in kilowatts (kW/kWp)."""
    kw: float

    def __post_init__(self) -> None:
        if self.kw <= 0:
            raise ValueError(f"PowerCapacity must be strictly positive: {self.kw}")


@dataclass(frozen=True)
class Money:
    """Currency representation in Indian Rupees (INR)."""
    amount: float

    def round_to(self, decimals: int = 2) -> Money:
        return Money(round(self.amount, decimals))

    def __add__(self, other: Money) -> Money:
        return Money(self.amount + other.amount)

    def __sub__(self, other: Money) -> Money:
        return Money(self.amount - other.amount)

    def __mul__(self, scalar: float) -> Money:
        return Money(self.amount * scalar)


@dataclass(frozen=True)
class EnergySlab:
    """DERC Domestic consumption energy slab."""
    min_units: float  # inclusive lower bound (e.g., 0)
    max_units: Optional[float]  # inclusive upper bound, None if unbounded
    rate_per_kwh: float  # INR per unit

    def units_in_slab(self, total_units: float) -> float:
        """Calculate number of units falling precisely into this slab bracket."""
        if total_units <= self.min_units:
            return 0.0
        effective_max = self.max_units if self.max_units is not None else float("inf")
        applicable_span = min(total_units, effective_max) - self.min_units
        return max(0.0, applicable_span)


@dataclass(frozen=True)
class FixedChargeBand:
    """Sanctioned load fixed charge band."""
    min_kw: float  # exclusive or inclusive depending on band
    max_kw: Optional[float]  # inclusive upper bound, None if unbounded
    rate_per_kw_month: float  # INR per kW per month


@dataclass(frozen=True)
class CalibrationPoint:
    """Empirical calibration benchmark from government worked examples."""
    units_kwh: float
    load_kw: float
    actual_bill_inr: float
