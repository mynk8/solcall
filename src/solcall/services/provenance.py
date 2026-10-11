"""Provenance and Rule Metadata Domain Service.

Generates `out/provenance.json` tracking every rule, its source URL,
confidence tier (T1/T2/T3), fitted calibration multiplier m,
and the formal inventory of VERIFY and ASSUMPTION items (§2, §3, §6).
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict, List
from solcall.domain.tariff import TariffSchedule


class ProvenanceService:
    """Maintains data lineage, source citations, and calibration provenance."""

    SOURCES_REGISTRY: Dict[str, Dict[str, str]] = {
        "TARIFF": {
            "name": "Delhi domestic tariff schedule FY2020-21",
            "url": "https://tatapower-ddl.com/Editor_UploadedDocuments/Content/Tariff_Schedule_2020-21.pdf",
            "tier": "T1",
        },
        "AMEND2": {
            "name": "Delhi Solar Energy Policy 2023, 2nd amendment (17 Sep 2026)",
            "url": "https://solar.delhi.gov.in/public/assets/solar/delhi_solar_energy_policy_2023_second_amendment.pdf",
            "tier": "T1",
        },
        "STATE_SUB": {
            "name": "Delhi state subsidy portal",
            "url": "https://solar.delhi.gov.in/page/state-subsidy",
            "tier": "T1",
        },
        "PMSG": {
            "name": "PM Surya Ghar guidelines, residential CFA, capex mode",
            "url": "https://solar.delhi.gov.in/public/assets/solar/PMSG_Guidelines_for_Residential_CFA_Capex_Mode.pdf",
            "tier": "T1",
        },
        "NETMETER": {
            "name": "DERC Net Metering Regulations 2014",
            "url": "https://solar.delhi.gov.in/public/assets/solar/1.%20Renewable-Energy-Net-Metering-Regulations2014.pdf",
            "tier": "T1",
        },
        "PPAC_FAQ": {
            "name": "TPDDL PPAC FAQ",
            "url": "https://tatapower-ddl.com/Editor_UploadedDocuments/Content/PPAC_FAQs.pdf",
            "tier": "T1",
        },
        "TPDDL_HIST": {
            "name": "TPDDL residential scheme historical empaneled rates",
            "url": "https://tatapower-ddl.com/applysolarportal/Solar%20Subsidy%20Scheme-Residential%20Customers.pdf",
            "tier": "T1",
        },
        "APPS": {
            "name": "Delhi Solar Portal applications by division",
            "url": "https://solar.delhi.gov.in/applications/division-wise/download",
            "tier": "T1",
        },
        "BRPL_SURCH": {
            "name": "BRPL PPAC / FPPAS page",
            "url": "https://www.bsesdelhi.com/web/brpl/fuel-power-purchase-adjustment-charges",
            "tier": "T1",
        },
        "RBI": {
            "name": "RBI homepage Current Rates",
            "url": "https://www.rbi.org.in",
            "tier": "T1",
        },
        "GSA": {
            "name": "Global Solar Atlas point API (World Bank / Solargis)",
            "url": "https://api.globalsolaratlas.info/data/lta?loc=LAT,LON",
            "tier": "T2",
        },
        "MKT_SS": {
            "name": "SolarSquare Delhi price page (updated 8 Oct 2026)",
            "url": "https://solarsquare.in/blog/solar-panel-price-in-delhi/",
            "tier": "T3",
        },
        "MKT_HG": {
            "name": "Heaven Green Energy Delhi cost page (updated 7 Aug 2026)",
            "url": "https://www.heavengreenenergy.com/blog/solar-cost-delhi",
            "tier": "T3",
        },
        "NM_VENDOR": {
            "name": "Vendor summary of Delhi net metering",
            "url": "https://bridgewaypower.in/blog/net-metering-delhi-2026-how-to-apply",
            "tier": "T3",
        },
    }

    @classmethod
    def generate_provenance(
        cls,
        rules_path: Path,
        tariff: TariffSchedule,
    ) -> Dict[str, Any]:
        """Compile complete provenance record."""
        rules: Dict[str, Any] = {}
        if rules_path.exists():
            with open(rules_path, "r", encoding="utf-8") as f:
                rules = json.load(f)

        verify_items: List[str] = []
        assumption_items: List[str] = []

        rules_with_lineage: Dict[str, Any] = {}
        for key, r_data in rules.items():
            source_id = r_data.get("source", "")
            source_meta = cls.SOURCES_REGISTRY.get(source_id, {})
            url = source_meta.get("url", "")
            tier = r_data.get("tier", source_meta.get("tier", "T1"))

            if r_data.get("verify", False):
                verify_items.append(key)
            if "ASSUMPTION" in r_data.get("note", "") or "ASSUMPTION" in source_id:
                assumption_items.append(key)

            rules_with_lineage[key] = {
                "value": r_data.get("value"),
                "unit": r_data.get("unit"),
                "source_id": source_id,
                "source_name": source_meta.get("name", source_id),
                "url": url,
                "tier": tier,
                "as_of": r_data.get("as_of"),
                "verify": r_data.get("verify", False),
                "note": r_data.get("note"),
            }

        calib_mults = tariff.calibration_multipliers()

        return {
            "fitted_multiplier_m": tariff.fitted_multiplier,
            "calibration_multipliers": calib_mults,
            "multiplier_spread": max(calib_mults) - min(calib_mults),
            "sources": cls.SOURCES_REGISTRY,
            "rules": rules_with_lineage,
            "verify_inventory": sorted(set(verify_items)),
            "assumption_inventory": sorted(set(assumption_items)),
        }
