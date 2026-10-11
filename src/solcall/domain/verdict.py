"""Verdict Decision Engine for SolCall.

Evaluates household solar feasibility based on:
1. First-year savings threshold
2. Route classification (Free vs Standard)
3. Three-way investment hurdles: spread ≥ ₹1/unit, discounted payback ≤ 7 years, DSCR ≥ 1.2
4. Long-term net present value (NPV > 0 for MARGINAL)
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional
from solcall.domain.finance import FinancialMetrics


class VerdictType(str, Enum):
    """Consumer solar investment verdict (§5)."""
    GO = "GO"
    GO_FREE = "GO_FREE"
    MARGINAL = "MARGINAL"
    NOT_WORTH = "NOT_WORTH"


@dataclass(frozen=True)
class DecisionRationale:
    """Detailed justification for the issued verdict."""
    verdict: VerdictType
    reason: str
    spread_ok: bool
    payback_ok: bool
    dscr_ok: bool
    positive_npv: bool


class VerdictService:
    """Evaluates financial metrics against regulatory and economic thresholds."""

    SPREAD_THRESHOLD_INR: float = 1.00       # Spread must be at least ₹1.00/kWh
    PAYBACK_THRESHOLD_YEARS: float = 7.00   # Discounted payback within 7 years
    DSCR_THRESHOLD: float = 1.20             # Debt service coverage ratio at least 1.2

    @classmethod
    def evaluate(
        cls,
        metrics: FinancialMetrics,
        is_free_route: bool = False,
    ) -> DecisionRationale:
        """Evaluate solar investment verdict according to AGENT_SPEC.md §5."""
        # 1. saving_1 <= 0 -> NOT_WORTH
        if metrics.year_1_saving <= 0.0:
            return DecisionRationale(
                verdict=VerdictType.NOT_WORTH,
                reason="Year 1 net savings are zero or negative. Solar offers no economic benefit.",
                spread_ok=False,
                payback_ok=False,
                dscr_ok=False,
                positive_npv=metrics.npv > 0,
            )

        # 2. free route -> GO_FREE
        if is_free_route:
            return DecisionRationale(
                verdict=VerdictType.GO_FREE,
                reason="Qualifies for Delhi Free Solar Scheme with zero upfront cost.",
                spread_ok=True,
                payback_ok=True,
                dscr_ok=True,
                positive_npv=True,
            )

        # Condition checks for GO
        spread_ok = metrics.spread_per_unit >= cls.SPREAD_THRESHOLD_INR

        payback_ok = (
            metrics.payback_discounted_years is not None
            and metrics.payback_discounted_years <= cls.PAYBACK_THRESHOLD_YEARS
        )

        has_loan = metrics.emi_monthly > 0
        dscr_ok = (not has_loan) or (metrics.dscr >= cls.DSCR_THRESHOLD)

        # 3. spread >= 1 AND disc. payback <= 7 AND (DSCR >= 1.2 or no loan) -> GO
        if spread_ok and payback_ok and dscr_ok:
            return DecisionRationale(
                verdict=VerdictType.GO,
                reason="Strong economic case: Spread >= ₹1/unit, discounted payback <= 7 years, and healthy EMI coverage.",
                spread_ok=spread_ok,
                payback_ok=payback_ok,
                dscr_ok=dscr_ok,
                positive_npv=metrics.npv > 0,
            )

        # 4. NPV > 0 -> MARGINAL
        if metrics.npv > 0:
            return DecisionRationale(
                verdict=VerdictType.MARGINAL,
                reason="Positive 25-year NPV, but payback or spread falls below conservative hurdle rates.",
                spread_ok=spread_ok,
                payback_ok=payback_ok,
                dscr_ok=dscr_ok,
                positive_npv=True,
            )

        # 5. else -> NOT_WORTH
        return DecisionRationale(
            verdict=VerdictType.NOT_WORTH,
            reason="Investment does not break even over 25 years or yields negative NPV.",
            spread_ok=spread_ok,
            payback_ok=payback_ok,
            dscr_ok=dscr_ok,
            positive_npv=False,
        )
