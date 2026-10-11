"""
§4.1 — Applications by division scraper.

Source: https://solar.delhi.gov.in/applications/division-wise/download
Method: GET CSV → parse → validate checksums → build domain model.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from src.domain.exceptions import ParseError, ValidationError
from src.domain.models import (
    ApplicationsByDivision,
    DiscomTotal,
    DivisionRecord,
)
from src.domain.ports import ApplicationsScraper as Port
from src.infrastructure.http import client as http

logger = logging.getLogger(__name__)

_URL = "https://solar.delhi.gov.in/applications/division-wise/download"
_KNOWN_DISCOMS = {"BRPL", "BYPL", "TPDDL"}


class LiveApplicationsScraper(Port):
    """Fetches the CSV from the Delhi Solar Portal and parses it."""

    def __init__(self, url: str = _URL) -> None:
        self._url = url

    # ------------------------------------------------------------------
    # Port implementation
    # ------------------------------------------------------------------

    def scrape(self) -> ApplicationsByDivision:
        raw = http.get(self._url)
        return _parse(raw)

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


class OfflineApplicationsScraper(Port):
    """Reads a fixture file instead of hitting the network."""

    def __init__(self, fixture_path: Path) -> None:
        self._path = fixture_path

    def scrape(self) -> ApplicationsByDivision:
        raw = self._path.read_bytes()
        return _parse(raw)

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


# ======================================================================
# Internal parsing logic
# ======================================================================

def _parse(raw: bytes) -> ApplicationsByDivision:
    """Parse the Delhi solar portal CSV into ``ApplicationsByDivision``."""
    text = raw.decode("utf-8-sig").strip()
    lines = text.splitlines()

    if len(lines) < 3:
        raise ParseError(f"CSV too short ({len(lines)} lines)")

    # --- as-on date -------------------------------------------------
    as_on = _extract_as_on(lines)

    # --- walk lines, grouping by DISCOM ----------------------------
    discoms: list[DiscomTotal] = []
    current_discom: Optional[str] = None
    current_rows: list[tuple[str, int]] = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check for a DISCOM header line
        upper = line.upper().strip().strip(",").strip('"').strip()
        if upper in _KNOWN_DISCOMS:
            # Commit previous group if any
            if current_discom and current_rows:
                discoms.append(_build_discom(current_discom, current_rows))
                current_rows = []
            current_discom = upper
            continue

        # Check for "DISCOM Total" line
        total_match = _is_discom_total_line(line)
        if total_match is not None:
            if current_discom and current_rows:
                dt = _build_discom(current_discom, current_rows)
                _validate_discom_total(dt, total_match)
                discoms.append(dt)
                current_rows = []
                current_discom = None
            continue

        # Check for grand total
        grand = _is_grand_total_line(line)
        if grand is not None:
            # Commit any dangling group
            if current_discom and current_rows:
                discoms.append(_build_discom(current_discom, current_rows))
                current_rows = []
            _validate_grand_total(discoms, grand)
            return ApplicationsByDivision(
                as_on=as_on,
                discoms=tuple(discoms),
                grand_total=grand,
            )

        # Try to parse as a data row: S.No, Division, Applications
        # Tolerate an extra leading DISCOM column.
        row = _parse_data_row(line)
        if row is not None:
            current_rows.append(row)

    # If we got here the file didn't have a Grand Total line — build
    # anyway but warn.
    if current_discom and current_rows:
        discoms.append(_build_discom(current_discom, current_rows))

    if not discoms:
        raise ParseError("No DISCOM data found in CSV")

    grand = sum(d.total for d in discoms)
    logger.warning("No Grand Total line found; computed %d", grand)
    return ApplicationsByDivision(
        as_on=as_on,
        discoms=tuple(discoms),
        grand_total=grand,
    )


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

_AS_ON_RE = re.compile(
    r'"?As\s+on"?\s*,\s*"?(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})"?',
    re.IGNORECASE,
)


def _extract_as_on(lines: list[str]) -> datetime:
    for line in lines[:5]:
        m = _AS_ON_RE.search(line)
        if m:
            return datetime.strptime(m.group(1), "%d-%m-%Y %H:%M")
    raise ParseError("Could not find 'As on' date in the first 5 lines")


def _parse_data_row(line: str) -> Optional[tuple[str, int]]:
    """Return (division_name, count) or None."""
    reader = csv.reader(io.StringIO(line))
    for cells in reader:
        cells = [c.strip() for c in cells if c.strip()]
        if len(cells) < 2:
            return None
        # The last cell should be the count; the second-to-last the name.
        try:
            count = int(cells[-1].replace(",", ""))
        except ValueError:
            return None
        name = cells[-2].strip().strip('"')
        # Skip header rows
        if name.upper() in ("DIVISION", "APPLICATIONS", "S.NO", "S.NO."):
            return None
        # Skip if name looks like a DISCOM total
        if "total" in name.lower():
            return None
        return (name, count)
    return None


_TOTAL_RE = re.compile(
    r'(?:,\s*)?"(BRPL|BYPL|TPDDL)\s+Total"\s*,\s*(\d[\d,]*)',
    re.IGNORECASE,
)

_PLAIN_TOTAL_RE = re.compile(
    r'(BRPL|BYPL|TPDDL)\s+Total[",\s]+(\d[\d,]*)',
    re.IGNORECASE,
)


def _is_discom_total_line(line: str) -> Optional[int]:
    """If this line is a DISCOM total, return the total count."""
    m = _TOTAL_RE.search(line) or _PLAIN_TOTAL_RE.search(line)
    if m:
        return int(m.group(2).replace(",", ""))
    return None


_GRAND_RE = re.compile(
    r'Grand\s+Total[",\s]+(\d[\d,]*)',
    re.IGNORECASE,
)


def _is_grand_total_line(line: str) -> Optional[int]:
    m = _GRAND_RE.search(line)
    if m:
        return int(m.group(1).replace(",", ""))
    return None


def _build_discom(name: str, rows: list[tuple[str, int]]) -> DiscomTotal:
    total = sum(count for _, count in rows)
    sorted_rows = sorted(rows, key=lambda r: r[1], reverse=True)

    divisions: list[DivisionRecord] = []
    for rank, (div_name, count) in enumerate(sorted_rows, start=1):
        divisions.append(DivisionRecord(
            discom=name,
            division=div_name,
            applications=count,
            share_in_discom=round(count / total, 6) if total else 0.0,
            rank_in_discom=rank,
        ))
    return DiscomTotal(discom=name, total=total, divisions=tuple(divisions))


def _validate_discom_total(dt: DiscomTotal, expected: int) -> None:
    if dt.total != expected:
        raise ValidationError(
            f"{dt.discom}: computed total {dt.total} ≠ stated total {expected}"
        )


def _validate_grand_total(discoms: list[DiscomTotal], expected: int) -> None:
    computed = sum(d.total for d in discoms)
    if computed != expected:
        raise ValidationError(
            f"Grand total: computed {computed} ≠ stated {expected}"
        )
