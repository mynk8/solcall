"""
§4.3 — Delhi solar output scraper (Global Solar Atlas).

Source: https://api.globalsolaratlas.info/data/lta?loc=LAT,LON
Method: GET JSON per point → extract PVOUT_csi (annual and monthly).
Model : engine_value = min(annual); monthly_share = monthly/Σmonthly (central).
Run once; cache. Attribute "World Bank Group / Solargis".
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from src.domain.exceptions import FetchError, ParseError
from src.domain.models import DelhiSolarYield, SolarPoint
from src.domain.ports import SolarYieldScraper as Port
from src.infrastructure.http import client as http

logger = logging.getLogger(__name__)

_API_TEMPLATE = "https://api.globalsolaratlas.info/data/lta?loc={lat},{lon}"

# Five measurement points specified in the spec (§4.3)
_POINTS: list[tuple[str, float, float]] = [
    ("Central",     28.6139, 77.2090),
    ("Narela",      28.85,   77.09),
    ("Dwarka",      28.59,   77.05),
    ("Mayur Vihar", 28.61,   77.29),
    ("Saket",       28.52,   77.21),
]


class LiveSolarYieldScraper(Port):
    """Calls the Global Solar Atlas API for each point."""

    def scrape(self) -> DelhiSolarYield:
        points: list[SolarPoint] = []
        all_raw: dict[str, object] = {}

        for name, lat, lon in _POINTS:
            url = _API_TEMPLATE.format(lat=lat, lon=lon)
            raw = http.get(url)
            data = json.loads(raw)
            all_raw[name] = data
            sp = _extract_point(name, lat, lon, data)
            points.append(sp)

        return _build_yield(tuple(points))

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


class OfflineSolarYieldScraper(Port):
    """Reads cached JSON fixtures (one file per point or a combined file)."""

    def __init__(self, fixture_dir: Path) -> None:
        self._dir = fixture_dir

    def scrape(self) -> DelhiSolarYield:
        combined_path = self._dir / "solar_yield_raw.json"
        if combined_path.exists():
            all_raw = json.loads(combined_path.read_bytes())
            points: list[SolarPoint] = []
            for name, lat, lon in _POINTS:
                data = all_raw[name]
                points.append(_extract_point(name, lat, lon, data))
            return _build_yield(tuple(points))

        # Fallback: individual files named <point_name>.json
        points = []
        for name, lat, lon in _POINTS:
            path = self._dir / f"{name.lower().replace(' ', '_')}.json"
            if not path.exists():
                raise FetchError(f"Fixture file not found: {path}")
            data = json.loads(path.read_bytes())
            points.append(_extract_point(name, lat, lon, data))
        return _build_yield(tuple(points))

    def save_raw(self, raw: bytes, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        return dest


# ======================================================================
# Internal helpers
# ======================================================================

def _deep_find(obj: object, key: str) -> object | None:
    """Recursively search a nested dict/list for *key*."""
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            result = _deep_find(v, key)
            if result is not None:
                return result
    elif isinstance(obj, list):
        for item in obj:
            result = _deep_find(item, key)
            if result is not None:
                return result
    return None


def _extract_point(
    name: str, lat: float, lon: float, data: dict,
) -> SolarPoint:
    """Pull PVOUT_csi from Global Solar Atlas response structure."""
    annual_val = _find_annual(data)
    monthly_vals = _find_monthly(data)

    if annual_val is None and monthly_vals is not None:
        annual_val = sum(monthly_vals)
    elif annual_val is None:
        raise ParseError(
            f"Key 'PVOUT_csi' (annual) not found in Global Solar Atlas response for {name}"
        )

    if monthly_vals is None:
        raise ParseError(
            f"Monthly PVOUT_csi values not found for {name}"
        )

    return SolarPoint(
        name=name,
        lat=lat,
        lon=lon,
        annual_kwh_per_kwp=round(annual_val, 2),
        monthly_kwh_per_kwp=monthly_vals,
    )


def _find_monthly(data: dict) -> tuple[float, ...] | None:
    """Search the entire response for a list of 12 floats under PVOUT_csi."""
    def _search(obj: object) -> list[float] | None:
        if isinstance(obj, list) and len(obj) == 12:
            try:
                return [float(v) for v in obj]
            except (TypeError, ValueError):
                pass
        if isinstance(obj, dict):
            # Check if PVOUT_csi is directly a list here
            if "PVOUT_csi" in obj and isinstance(obj["PVOUT_csi"], list):
                try:
                    vals = [float(v) for v in obj["PVOUT_csi"]]
                    if len(vals) == 12:
                        return vals
                except (TypeError, ValueError):
                    pass
            for v in obj.values():
                result = _search(v)
                if result is not None:
                    return result
        elif isinstance(obj, list):
            for item in obj:
                result = _search(item)
                if result is not None:
                    return result
        return None

    found = _search(data)
    return tuple(found) if found else None


def _find_annual(data: dict) -> float | None:
    """Search for a scalar PVOUT_csi value (annual total)."""
    def _search(obj: object) -> float | None:
        if isinstance(obj, dict):
            if "PVOUT_csi" in obj and isinstance(obj["PVOUT_csi"], (int, float)):
                return float(obj["PVOUT_csi"])
            for v in obj.values():
                result = _search(v)
                if result is not None:
                    return result
        elif isinstance(obj, list):
            for item in obj:
                result = _search(item)
                if result is not None:
                    return result
        return None

    return _search(data)


def _build_yield(points: tuple[SolarPoint, ...]) -> DelhiSolarYield:
    """Aggregate individual points into the composite yield model."""
    if not points:
        raise ParseError("No solar yield data points")

    annuals = [p.annual_kwh_per_kwp for p in points]
    engine_value = round(min(annuals), 1)
    spread_pct = round((max(annuals) - min(annuals)) / min(annuals) * 100, 1)

    # Monthly share from the central point (first in our list)
    central = points[0]
    monthly_total = sum(central.monthly_kwh_per_kwp)
    monthly_share = tuple(
        round(m / monthly_total, 6)
        for m in central.monthly_kwh_per_kwp
    )

    return DelhiSolarYield(
        points=points,
        engine_value=engine_value,
        spread_pct=spread_pct,
        monthly_share=monthly_share,
    )
