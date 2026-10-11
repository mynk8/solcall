"""
§4.5 — Installer price scraper (candidates only).

Source: URLs listed in data/installer_pages.json (MKT_SS, MKT_HG to start).
Method: GET HTML → strip tags → regex for  <kW> … ₹/Rs/INR <amount> [lakh].
Flag stale_delhi_subsidy if page mentions a ₹30,000 Delhi/state subsidy.
Approval is a separate step (approve.py); this module only scrapes candidates.
"""

from __future__ import annotations

import logging
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional

from src.domain.exceptions import ParseError
from src.domain.models import InstallerPriceScrapeResult, PriceCandidate
from src.domain.ports import InstallerPriceScraper as Port
from src.infrastructure.http import client as http

logger = logging.getLogger(__name__)


class LiveInstallerPriceScraper(Port):
    """Fetches a single installer page and extracts price candidates."""

    def scrape(self, url: str) -> InstallerPriceScrapeResult:
        raw = http.get(url)
        return _parse(raw, url)

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


class OfflineInstallerPriceScraper(Port):
    """Reads a saved HTML fixture."""

    def __init__(self, fixture_dir: Path) -> None:
        self._dir = fixture_dir

    def scrape(self, url: str) -> InstallerPriceScrapeResult:
        # Derive a filename from the URL
        import hashlib
        safe_name = hashlib.md5(url.encode()).hexdigest()[:12] + ".html"
        path = self._dir / safe_name
        if not path.exists():
            # Try finding any .html file in the dir as a fallback
            htmls = list(self._dir.glob("*.html"))
            if not htmls:
                raise ParseError(f"No fixture found for {url} in {self._dir}")
            path = htmls[0]
        raw = path.read_bytes()
        return _parse(raw, url)

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


# ======================================================================
# Internal parsing logic
# ======================================================================

class _TagStripper(HTMLParser):
    """Strip all HTML tags → plain text."""

    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def get_text(self) -> str:
        return " ".join(self._parts)


def _strip_tags(raw: bytes) -> str:
    text = raw.decode("utf-8", errors="replace")
    stripper = _TagStripper()
    stripper.feed(text)
    return stripper.get_text()


# --- Price extraction regex -------------------------------------------
#
# Pattern: <kW> ... ₹/Rs/INR <amount> [lakh/lac/L]
#
# We match size and price in the same neighbourhood of text.

_SIZE_PRICE_RE = re.compile(
    r"(\d{1,2})\s*kW"                         # group 1: size in kW
    r"[^₹\n]{0,150}?"                         # up to 150 chars between size and price
    r"(?:₹|Rs\.?|INR)\s*"                      # currency prefix
    r"([\d,]+(?:\.\d+)?)"                      # group 2: amount
    r"\s*(lakh|lac|L)?"                         # group 3: optional lakh multiplier
    , re.IGNORECASE,
)

# Reverse direction: price then size
_PRICE_SIZE_RE = re.compile(
    r"(?:₹|Rs\.?|INR)\s*"
    r"([\d,]+(?:\.\d+)?)"                      # group 1: amount
    r"\s*(lakh|lac|L)?"                         # group 2: lakh
    r"[^₹\n]{0,100}?"
    r"(\d{1,2})\s*kW"                          # group 3: size
    , re.IGNORECASE,
)

# Date pattern: Updated: DD Mon YYYY or Updated on DD/MM/YYYY etc.
_PAGE_DATE_RE = re.compile(
    r"(?:Updated|Last\s+Updated|Modified)\s*(?:on|:)?\s*"
    r"(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*,?\s*(\d{4})",
    re.IGNORECASE,
)

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Stale subsidy detection: page mentions Delhi/state subsidy of ₹30,000
_STALE_SUBSIDY_RE = re.compile(
    r"(?:Delhi|state)\s+subsidy[^₹]{0,60}₹\s*30[,.]?000",
    re.IGNORECASE,
)

# Valid price range: ₹10,000 – ₹20,00,000 (10K – 20L)
_MIN_PRICE = 10_000
_MAX_PRICE = 20_00_000


def _parse_amount(raw_amount: str, lakh_suffix: Optional[str]) -> int:
    """Convert a scraped amount string to an integer in rupees."""
    cleaned = raw_amount.replace(",", "")
    value = float(cleaned)
    if lakh_suffix:
        value *= 100_000
    return int(round(value))


def _extract_page_date(text: str) -> Optional[date]:
    m = _PAGE_DATE_RE.search(text)
    if not m:
        return None
    day = int(m.group(1))
    month = _MONTH_MAP.get(m.group(2).lower()[:3])
    year = int(m.group(3))
    if month is None:
        return None
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _parse(raw: bytes, url: str) -> InstallerPriceScrapeResult:
    """Parse installer page HTML into price candidates."""
    text = _strip_tags(raw)

    page_date = _extract_page_date(text)
    stale = bool(_STALE_SUBSIDY_RE.search(text))

    candidates: list[PriceCandidate] = []
    seen: set[tuple[int, int]] = set()

    # Forward pattern: size then price
    for m in _SIZE_PRICE_RE.finditer(text):
        size_kw = int(m.group(1))
        price_inr = _parse_amount(m.group(2), m.group(3))
        if _MIN_PRICE <= price_inr <= _MAX_PRICE and (size_kw, price_inr) not in seen:
            seen.add((size_kw, price_inr))
            candidates.append(PriceCandidate(
                size_kw=size_kw,
                price_inr=price_inr,
                source_url=url,
                page_date=page_date,
                stale_delhi_subsidy=stale,
            ))

    # Reverse pattern: price then size
    for m in _PRICE_SIZE_RE.finditer(text):
        price_inr = _parse_amount(m.group(1), m.group(2))
        size_kw = int(m.group(3))
        if _MIN_PRICE <= price_inr <= _MAX_PRICE and (size_kw, price_inr) not in seen:
            seen.add((size_kw, price_inr))
            candidates.append(PriceCandidate(
                size_kw=size_kw,
                price_inr=price_inr,
                source_url=url,
                page_date=page_date,
                stale_delhi_subsidy=stale,
            ))

    # Sort by size, then price
    candidates.sort(key=lambda c: (c.size_kw, c.price_inr))

    # Keep a short snippet of the raw text for provenance
    snippet = text[:500].strip() if text else None

    return InstallerPriceScrapeResult(
        url=url,
        candidates=tuple(candidates),
        stale_delhi_subsidy=stale,
        raw_text_snippet=snippet,
    )
