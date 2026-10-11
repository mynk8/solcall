"""
Domain-layer scraper ports (interfaces).

Each port defines what a scraper *does* without specifying *how*.
The infrastructure layer provides concrete implementations that
speak HTTP or read fixture files.
"""

from __future__ import annotations

import abc
from pathlib import Path
from typing import Optional

from src.domain.models import (
    ApplicationsByDivision,
    DelhiSolarYield,
    InstallerPriceScrapeResult,
    MoneyRates,
    SurchargeHistory,
)


class ApplicationsScraper(abc.ABC):
    """Port: fetch applications-by-division data (§4.1)."""

    @abc.abstractmethod
    def scrape(self) -> ApplicationsByDivision:
        """Return the current snapshot."""

    @abc.abstractmethod
    def save_raw(self, raw: bytes, dest: Path) -> Path:
        """Persist the raw CSV to *dest* and return the path."""


class MoneyRatesScraper(abc.ABC):
    """Port: fetch RBI money rates (§4.2)."""

    @abc.abstractmethod
    def scrape(self) -> MoneyRates: ...

    @abc.abstractmethod
    def save_raw(self, raw: bytes, dest: Path) -> Path: ...


class SolarYieldScraper(abc.ABC):
    """Port: fetch Delhi solar output from Global Solar Atlas (§4.3)."""

    @abc.abstractmethod
    def scrape(self) -> DelhiSolarYield: ...

    @abc.abstractmethod
    def save_raw(self, raw: bytes, dest: Path) -> Path: ...


class SurchargeHistoryScraper(abc.ABC):
    """Port: fetch BRPL surcharge history (§4.4)."""

    @abc.abstractmethod
    def scrape(self) -> SurchargeHistory: ...

    @abc.abstractmethod
    def save_raw(self, raw: bytes, dest: Path) -> Path: ...


class InstallerPriceScraper(abc.ABC):
    """Port: scrape installer price candidates from a single URL (§4.5)."""

    @abc.abstractmethod
    def scrape(self, url: str) -> InstallerPriceScrapeResult: ...

    @abc.abstractmethod
    def save_raw(self, raw: bytes, dest: Path) -> Path: ...
