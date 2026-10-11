"""Delhi Solar Reference Price Ladder Domain Service.

Constructs price rungs per system size k in {1, 2, 3, 4, 5, 10} kW:
- Benchmark rung: MNRE / PMSG benchmark cost
- Market rungs: Market Low, Median, High (per size, sizes are never pooled)
- History rung: TPDDL historical empaneled rates
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional
import statistics
from solcall.domain.subsidy import CapitalSubsidyCalculator
from solcall.domain.value_objects import ConfidenceTier


@dataclass(frozen=True)
class PriceObservation:
    """An approved price observation for a specific system size."""
    size_kw: float
    price_low: float
    price_high: float
    source: str
    tier: ConfidenceTier
    as_of: str
    gst_included: Optional[bool]
    dcr_certified: Optional[bool]
    notes: str


@dataclass(frozen=True)
class PriceRung:
    """A single rung on the reference price ladder."""
    rung_name: str
    total_price: float
    price_per_kw: float
    tier: ConfidenceTier
    source: str
    n_observations: int
    as_of: str
    gst_included: Optional[bool]
    dcr_certified: Optional[bool]
    notes: str


@dataclass(frozen=True)
class SizePriceLadder:
    """Complete price ladder for a single system size."""
    size_kw: float
    benchmark: PriceRung
    market_low: Optional[PriceRung]
    market_median: Optional[PriceRung]
    market_high: Optional[PriceRung]
    tpddl_history: PriceRung
    central_subsidy: float
    delhi_subsidy_benchmark: float
    net_cost_benchmark: float


# Approved observations from AGENT_SPEC.md §3
DEFAULT_PRICE_OBSERVATIONS: List[PriceObservation] = [
    PriceObservation(
        size_kw=2.0,
        price_low=195_000.0,
        price_high=195_000.0,
        source="MKT_SS",
        tier=ConfidenceTier.T3,
        as_of="2026-10-08",
        gst_included=None,
        dcr_certified=True,
        notes="SolarSquare Delhi page; stale Delhi subsidy shown",
    ),
    PriceObservation(
        size_kw=3.0,
        price_low=240_000.0,
        price_high=240_000.0,
        source="MKT_SS",
        tier=ConfidenceTier.T3,
        as_of="2026-10-08",
        gst_included=None,
        dcr_certified=True,
        notes="SolarSquare Delhi page; stale Delhi subsidy shown",
    ),
    PriceObservation(
        size_kw=3.0,
        price_low=198_000.0,
        price_high=233_000.0,
        source="MKT_HG",
        tier=ConfidenceTier.T3,
        as_of="2026-08-07",
        gst_included=None,
        dcr_certified=None,
        notes="Heaven Green Energy quote range",
    ),
    PriceObservation(
        size_kw=4.0,
        price_low=273_000.0,
        price_high=273_000.0,
        source="MKT_SS",
        tier=ConfidenceTier.T3,
        as_of="2026-10-08",
        gst_included=None,
        dcr_certified=True,
        notes="SolarSquare Delhi page; stale Delhi subsidy shown",
    ),
    PriceObservation(
        size_kw=5.0,
        price_low=330_000.0,
        price_high=330_000.0,
        source="MKT_SS",
        tier=ConfidenceTier.T3,
        as_of="2026-10-08",
        gst_included=None,
        dcr_certified=True,
        notes="SolarSquare Delhi page; stale Delhi subsidy shown",
    ),
    PriceObservation(
        size_kw=5.0,
        price_low=258_000.0,
        price_high=303_000.0,
        source="MKT_HG",
        tier=ConfidenceTier.T3,
        as_of="2026-08-07",
        gst_included=None,
        dcr_certified=None,
        notes="Heaven Green Energy quote range",
    ),
    PriceObservation(
        size_kw=10.0,
        price_low=593_000.0,
        price_high=593_000.0,
        source="MKT_SS",
        tier=ConfidenceTier.T3,
        as_of="2026-10-08",
        gst_included=None,
        dcr_certified=True,
        notes="SolarSquare Delhi page; stale Delhi subsidy shown",
    ),
    PriceObservation(
        size_kw=10.0,
        price_low=403_000.0,
        price_high=488_000.0,
        source="MKT_HG",
        tier=ConfidenceTier.T3,
        as_of="2026-08-07",
        gst_included=None,
        dcr_certified=None,
        notes="Heaven Green Energy quote range",
    ),
]


class ReferenceLadderService:
    """Constructs the reference price ladder per system size."""

    SUPPORTED_SIZES: List[float] = [1.0, 2.0, 3.0, 4.0, 5.0, 10.0]

    @staticmethod
    def get_tpddl_historical_rate(size_kw: float) -> float:
        """TPDDL historical empaneled rates (excl. GST):

        1-3 kW: ₹39,000/kW
        3.1-10 kW: ₹37,500/kW
        """
        if size_kw <= 3.0:
            return 39_000.0
        return 37_500.0

    @classmethod
    def build_ladder_for_size(
        cls,
        size_kw: float,
        observations: Optional[List[PriceObservation]] = None,
    ) -> SizePriceLadder:
        """Build the full rung ladder for a single system size (§5). Sizes are never pooled."""
        obs_list = observations if observations is not None else DEFAULT_PRICE_OBSERVATIONS
        matching_obs = [o for o in obs_list if o.size_kw == size_kw]

        # 1. Benchmark rung
        benchmark_total = CapitalSubsidyCalculator.benchmark_cost(size_kw)
        benchmark_rung = PriceRung(
            rung_name="benchmark",
            total_price=benchmark_total,
            price_per_kw=benchmark_total / size_kw,
            tier=ConfidenceTier.T1,
            source="PMSG",
            n_observations=1,
            as_of="2026-09-17",
            gst_included=True,
            dcr_certified=True,
            notes="PM Surya Ghar benchmark cost",
        )

        # 2. Market rungs
        market_low: Optional[PriceRung] = None
        market_median: Optional[PriceRung] = None
        market_high: Optional[PriceRung] = None

        if matching_obs:
            n_obs = len(matching_obs)
            min_low_per_kw = min(o.price_low / size_kw for o in matching_obs)
            max_high_per_kw = max(o.price_high / size_kw for o in matching_obs)
            midpoints_per_kw = [(o.price_low + o.price_high) / (2.0 * size_kw) for o in matching_obs]
            median_per_kw = statistics.median(midpoints_per_kw)

            dates_str = ", ".join(sorted(set(o.as_of for o in matching_obs)))
            gst_flags_str = ", ".join(f"{o.source}:gst={o.gst_included}" for o in matching_obs)

            market_low = PriceRung(
                rung_name="market_low",
                total_price=min_low_per_kw * size_kw,
                price_per_kw=min_low_per_kw,
                tier=ConfidenceTier.T3,
                source="Market Observation",
                n_observations=n_obs,
                as_of=dates_str,
                gst_included=None,
                dcr_certified=None,
                notes=f"n={n_obs}; flags: {gst_flags_str}",
            )
            market_median = PriceRung(
                rung_name="market_median",
                total_price=median_per_kw * size_kw,
                price_per_kw=median_per_kw,
                tier=ConfidenceTier.T3,
                source="Market Observation",
                n_observations=n_obs,
                as_of=dates_str,
                gst_included=None,
                dcr_certified=None,
                notes=f"Median of midpoints; n={n_obs}",
            )
            market_high = PriceRung(
                rung_name="market_high",
                total_price=max_high_per_kw * size_kw,
                price_per_kw=max_high_per_kw,
                tier=ConfidenceTier.T3,
                source="Market Observation",
                n_observations=n_obs,
                as_of=dates_str,
                gst_included=None,
                dcr_certified=None,
                notes=f"n={n_obs}; flags: {gst_flags_str}",
            )

        # 3. History rung
        hist_rate = cls.get_tpddl_historical_rate(size_kw)
        tpddl_history_rung = PriceRung(
            rung_name="tpddl_history",
            total_price=hist_rate * size_kw,
            price_per_kw=hist_rate,
            tier=ConfidenceTier.T1,
            source="TPDDL_HIST",
            n_observations=1,
            as_of="Historical",
            gst_included=False,
            dcr_certified=True,
            notes="TPDDL historical empaneled residential scheme (excl. GST)",
        )

        central_sub = CapitalSubsidyCalculator.central_subsidy(size_kw)
        delhi_sub = CapitalSubsidyCalculator.delhi_subsidy(size_kw, benchmark_total)
        net_cost = CapitalSubsidyCalculator.net_cost(size_kw, benchmark_total)

        return SizePriceLadder(
            size_kw=size_kw,
            benchmark=benchmark_rung,
            market_low=market_low,
            market_median=market_median,
            market_high=market_high,
            tpddl_history=tpddl_history_rung,
            central_subsidy=central_sub,
            delhi_subsidy_benchmark=delhi_sub,
            net_cost_benchmark=net_cost,
        )

    @classmethod
    def build_all_ladders(
        cls, observations: Optional[List[PriceObservation]] = None
    ) -> Dict[float, SizePriceLadder]:
        """Build ladder for all supported standard sizes in Delhi."""
        return {
            size: cls.build_ladder_for_size(size, observations)
            for size in cls.SUPPORTED_SIZES
        }
