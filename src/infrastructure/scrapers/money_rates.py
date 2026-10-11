"""
§4.2 — RBI money-rates scraper.

Source: https://www.rbi.org.in
Method: GET HTML → strip tags → regex for repo rate and term deposit range.
Model : scheme_loan_rate = repo + 0.50;  cash_opportunity_rate = top of deposit range.
"""

from __future__ import annotations

import html
import logging
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

from src.domain.exceptions import ParseError
from src.domain.models import MoneyRates
from src.domain.ports import MoneyRatesScraper as Port
from src.infrastructure.http import client as http

logger = logging.getLogger(__name__)

_URL = "https://www.rbi.org.in"


class LiveMoneyRatesScraper(Port):
    """Fetches the RBI homepage and extracts policy rates."""

    def __init__(self, url: str = _URL) -> None:
        self._url = url

    def scrape(self) -> MoneyRates:
        raw = http.get(self._url)
        return _parse(raw)

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


class OfflineMoneyRatesScraper(Port):
    """Reads a saved HTML fixture."""

    def __init__(self, fixture_path: Path) -> None:
        self._path = fixture_path

    def scrape(self) -> MoneyRates:
        raw = self._path.read_bytes()
        return _parse(raw)

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


# ======================================================================
# Internal parsing logic
# ======================================================================

class _TagStripper(HTMLParser):
    """Strip all HTML tags and return plain text."""

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


# Regex patterns ----------------------------------------------------------
# The RBI homepage has varied layouts; these are broad enough to match.
_REPO_RE = re.compile(
    r"Policy\s+Repo\s+Rate\s*[:\s]*(\d+\.\d+)\s*%",
    re.IGNORECASE,
)

# Term Deposit Rate > 1 Year … x% - y%  or  x% to y%
_TERM_DEP_RE = re.compile(
    r"Term\s+Deposit\s+Rate\s*[^%]*?>"
    r"\s*1\s*Year\s*[^%]*?"
    r"(\d+\.\d+)\s*%\s*[-–to]+\s*(\d+\.\d+)\s*%",
    re.IGNORECASE | re.DOTALL,
)

# Fallback: sometimes the layout differs.
_TERM_DEP_ALT_RE = re.compile(
    r"Term\s+Deposit.*?1\s*Year.*?(\d+\.\d+)\s*%\s*[-–to]+\s*(\d+\.\d+)\s*%",
    re.IGNORECASE | re.DOTALL,
)


def _parse(raw: bytes) -> MoneyRates:
    """Parse the RBI homepage HTML into ``MoneyRates``."""
    plain = _strip_tags(raw)

    # --- Repo rate ---------------------------------------------------
    m_repo = _REPO_RE.search(plain)
    if not m_repo:
        raise ParseError("Could not find 'Policy Repo Rate' on RBI page")
    repo = float(m_repo.group(1))

    # --- Term deposit ------------------------------------------------
    m_td = _TERM_DEP_RE.search(plain) or _TERM_DEP_ALT_RE.search(plain)
    if not m_td:
        raise ParseError("Could not find 'Term Deposit Rate > 1 Year' on RBI page")
    td_low = float(m_td.group(1))
    td_high = float(m_td.group(2))
    if td_low > td_high:
        td_low, td_high = td_high, td_low

    return MoneyRates(
        as_of=date.today(),
        repo_rate_pct=repo,
        term_deposit_low_pct=td_low,
        term_deposit_high_pct=td_high,
        scheme_loan_rate_pct=round(repo + 0.50, 2),
        cash_opportunity_rate_pct=td_high,
    )
