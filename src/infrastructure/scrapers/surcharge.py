"""
§4.4 — BRPL surcharge history scraper.

Source: https://www.bsesdelhi.com/web/brpl/fuel-power-purchase-adjustment-charges
Method: GET HTML → parse every <tr> → extract % from title, date range from text.
Model : sorted series of (from, to, pct); latest; min/max over last 24 months;
        rows without % listed as needs_pdf.
"""

from __future__ import annotations

import logging
import re
from datetime import date, timedelta
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional

from src.domain.exceptions import ParseError
from src.domain.models import (
    SurchargeEntry,
    SurchargeHistory,
    UnparsedSurchargeRow,
)
from src.domain.ports import SurchargeHistoryScraper as Port
from src.infrastructure.http import client as http

logger = logging.getLogger(__name__)

_URL = "https://www.bsesdelhi.com/web/brpl/fuel-power-purchase-adjustment-charges"


class LiveSurchargeHistoryScraper(Port):
    """Fetches the BRPL FPPAS page and parses the surcharge table."""

    def __init__(self, url: str = _URL) -> None:
        self._url = url

    def scrape(self) -> SurchargeHistory:
        raw = http.get(self._url)
        return _parse(raw)

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


class OfflineSurchargeHistoryScraper(Port):
    """Reads a saved HTML fixture."""

    def __init__(self, fixture_path: Path) -> None:
        self._path = fixture_path

    def scrape(self) -> SurchargeHistory:
        raw = self._path.read_bytes()
        return _parse(raw)

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


# ======================================================================
# HTML → table rows
# ======================================================================

class _TableParser(HTMLParser):
    """
    Extract all <tr> rows from the HTML.
    For each row, collect:
      - cell texts (from <td>/<th>)
      - the first <a href="..."> link
    """

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[tuple[list[str], Optional[str]]] = []  # (cells, first_link)
        self._in_tr = False
        self._in_cell = False
        self._current_cells: list[str] = []
        self._current_text = ""
        self._current_link: Optional[str] = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        tag = tag.lower()
        if tag == "tr":
            self._in_tr = True
            self._current_cells = []
            self._current_link = None
        elif tag in ("td", "th") and self._in_tr:
            self._in_cell = True
            self._current_text = ""
        elif tag == "a" and self._in_tr and self._current_link is None:
            for attr_name, attr_val in attrs:
                if attr_name.lower() == "href" and attr_val:
                    self._current_link = attr_val
                    break

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in ("td", "th") and self._in_cell:
            self._in_cell = False
            self._current_cells.append(self._current_text.strip())
        elif tag == "tr" and self._in_tr:
            self._in_tr = False
            if self._current_cells:
                self.rows.append((list(self._current_cells), self._current_link))

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._current_text += data


# ======================================================================
# Row → domain model
# ======================================================================

_PCT_RE = re.compile(r"(\d{1,2}\.\d{1,2})\s*%")

# Date formats found in BRPL tables: DD.MM.YYYY, DD/MM/YYYY
_DATE_SEP_RE = re.compile(
    r"(\d{2})[./](\d{2})[./](\d{4})"
)

_PERIOD_RE = re.compile(
    r"(\d{2}[./]\d{2}[./]\d{4})\s*(?:to|-|–)\s*(\d{2}[./]\d{2}[./]\d{4})",
    re.IGNORECASE,
)

_ONWARDS_RE = re.compile(
    r"(\d{2}[./]\d{2}[./]\d{4})\s*onwards",
    re.IGNORECASE,
)


def _parse_date(s: str) -> date:
    m = _DATE_SEP_RE.search(s)
    if not m:
        raise ParseError(f"Cannot parse date: {s!r}")
    day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return date(year, month, day)


def _parse(raw: bytes) -> SurchargeHistory:
    html_text = raw.decode("utf-8", errors="replace")
    parser = _TableParser()
    parser.feed(html_text)

    entries: list[SurchargeEntry] = []
    needs_pdf: list[UnparsedSurchargeRow] = []

    for cells, first_link in parser.rows:
        if not cells:
            continue

        # Row title = longest cell text
        title = max(cells, key=len)

        # Try to extract percentage
        pct_match = _PCT_RE.search(title)
        if not pct_match:
            # Check all cells for a percentage
            for cell in cells:
                pct_match = _PCT_RE.search(cell)
                if pct_match:
                    break

        if not pct_match:
            # Only record as needs_pdf if the row has meaningful content
            if len(title) > 10:
                needs_pdf.append(UnparsedSurchargeRow(
                    title=title,
                    pdf_url=first_link,
                ))
            continue

        pct = float(pct_match.group(1))

        # Try to extract date range from the title or all cells combined
        all_text = " ".join(cells)
        from_date: Optional[date] = None
        to_date: Optional[date] = None

        period_match = _PERIOD_RE.search(all_text)
        if period_match:
            from_date = _parse_date(period_match.group(1))
            to_date = _parse_date(period_match.group(2))
        else:
            onwards_match = _ONWARDS_RE.search(all_text)
            if onwards_match:
                from_date = _parse_date(onwards_match.group(1))
                to_date = None
            else:
                # Try to find any date at all
                date_matches = _DATE_SEP_RE.findall(all_text)
                if date_matches:
                    dates = []
                    for dm in date_matches:
                        try:
                            dates.append(date(int(dm[2]), int(dm[1]), int(dm[0])))
                        except ValueError:
                            pass
                    if len(dates) >= 2:
                        dates.sort()
                        from_date = dates[0]
                        to_date = dates[-1]
                    elif len(dates) == 1:
                        from_date = dates[0]

        if from_date is None:
            needs_pdf.append(UnparsedSurchargeRow(
                title=title,
                pdf_url=first_link,
            ))
            continue

        entries.append(SurchargeEntry(
            from_date=from_date,
            to_date=to_date,
            pct=pct,
            title=title,
            pdf_url=first_link,
        ))

    if not entries:
        raise ParseError("No surcharge entries with percentages found in BRPL page")

    # Sort by from_date
    entries.sort(key=lambda e: e.from_date)
    latest = entries[-1]

    # Min/max over last 24 months
    cutoff = date.today() - timedelta(days=730)
    recent = [e for e in entries if e.from_date >= cutoff]
    min_24m = min(e.pct for e in recent) if recent else None
    max_24m = max(e.pct for e in recent) if recent else None

    return SurchargeHistory(
        entries=tuple(entries),
        latest=latest,
        min_24m_pct=min_24m,
        max_24m_pct=max_24m,
        needs_pdf=tuple(needs_pdf),
    )
