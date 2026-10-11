"""
Domain value objects for scraper results.

Each value object is an immutable dataclass representing the structured output
of a scraper. These belong to the domain layer — no I/O, no HTTP, no file
paths. Scrapers in the infrastructure layer produce these; the application
layer consumes them.
"""

from __future__ import annotations

import dataclasses as dc
from datetime import date, datetime
from typing import Optional


# ---------------------------------------------------------------------------
# §4.1  Applications by division
# ---------------------------------------------------------------------------

@dc.dataclass(frozen=True)
class DivisionRecord:
    """One division's application count within a DISCOM."""
    discom: str
    division: str
    applications: int
    share_in_discom: float      # applications / discom_total
    rank_in_discom: int


@dc.dataclass(frozen=True)
class DiscomTotal:
    """Aggregate for a single DISCOM."""
    discom: str
    total: int
    divisions: tuple[DivisionRecord, ...]


@dc.dataclass(frozen=True)
class ApplicationsByDivision:
    """Complete snapshot of applications across all DISCOMs."""
    as_on: datetime
    discoms: tuple[DiscomTotal, ...]
    grand_total: int
    # change_since_previous is populated by the application layer when a
    # previous snapshot is available; None on first run.
    change_since_previous: Optional[dict[str, int]] = None


# ---------------------------------------------------------------------------
# §4.2  Money rates
# ---------------------------------------------------------------------------

@dc.dataclass(frozen=True)
class MoneyRates:
    """RBI-derived interest rates relevant to the solar scheme."""
    as_of: date
    repo_rate_pct: float
    term_deposit_low_pct: float
    term_deposit_high_pct: float
    # Derived
    scheme_loan_rate_pct: float   # repo + 0.50
    cash_opportunity_rate_pct: float  # top of deposit range


# ---------------------------------------------------------------------------
# §4.3  Delhi solar output (Global Solar Atlas)
# ---------------------------------------------------------------------------

@dc.dataclass(frozen=True)
class SolarPoint:
    """PV output for a single geographic point."""
    name: str
    lat: float
    lon: float
    annual_kwh_per_kwp: float
    monthly_kwh_per_kwp: tuple[float, ...]  # 12 values, Jan–Dec


@dc.dataclass(frozen=True)
class DelhiSolarYield:
    """Aggregated solar yield across Delhi measurement points."""
    points: tuple[SolarPoint, ...]
    engine_value: float          # min(annual over points)
    spread_pct: float            # (max-min)/min * 100
    monthly_share: tuple[float, ...]  # 12 shares summing to 1.0 (central point)
    attribution: str = "World Bank Group / Solargis"


# ---------------------------------------------------------------------------
# §4.4  Surcharge history (BRPL)
# ---------------------------------------------------------------------------

@dc.dataclass(frozen=True)
class SurchargeEntry:
    """One BRPL PPAC/FPPAS row that has a parseable percentage."""
    from_date: date
    to_date: Optional[date]      # None if "onwards"
    pct: float
    title: str
    pdf_url: Optional[str] = None


@dc.dataclass(frozen=True)
class UnparsedSurchargeRow:
    """A row from the BRPL surcharge table where % could not be parsed."""
    title: str
    pdf_url: Optional[str] = None


@dc.dataclass(frozen=True)
class SurchargeHistory:
    """Full surcharge history for BRPL."""
    entries: tuple[SurchargeEntry, ...]         # sorted by from_date
    latest: SurchargeEntry
    min_24m_pct: Optional[float]
    max_24m_pct: Optional[float]
    needs_pdf: tuple[UnparsedSurchargeRow, ...]


# ---------------------------------------------------------------------------
# §4.5  Installer price candidates
# ---------------------------------------------------------------------------

@dc.dataclass(frozen=True)
class PriceCandidate:
    """A single (size_kw, price_inr) pair scraped from an installer page."""
    size_kw: int
    price_inr: int
    source_url: str
    page_date: Optional[date] = None
    stale_delhi_subsidy: bool = False


@dc.dataclass(frozen=True)
class InstallerPriceScrapeResult:
    """All price candidates scraped from one URL."""
    url: str
    candidates: tuple[PriceCandidate, ...]
    stale_delhi_subsidy: bool = False
    raw_text_snippet: Optional[str] = None
