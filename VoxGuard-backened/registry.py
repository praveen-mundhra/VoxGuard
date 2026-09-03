"""Async Indian telecom registry verification adapters.

Production deployments should replace the mock adapters with approved TRAI/DoT
integrations and keep credentials, retention, and audit policy outside this module.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import re
from typing import Any


@dataclass(frozen=True)
class RegistryMatch:
    registry: str
    matched: bool
    reason: str
    confidence: float


class TelecomRegistryService:
    """Non-persistent async facade for TRAI, Chakshu, and CEIR checks."""

    async def check_trai_1909(self, phone_number: str) -> RegistryMatch:
        normalized = self._normalize_phone(phone_number)
        matched = normalized.endswith("0000")
        return RegistryMatch("TRAI_1909", matched, "Mock spam cluster match" if matched else "No mock match", 0.92 if matched else 0.64)

    async def check_sanchar_saathi_chakshu(self, phone_number: str) -> RegistryMatch:
        normalized = self._normalize_phone(phone_number)
        matched = normalized.endswith("1111")
        return RegistryMatch("DOT_SANCHAR_SAATHI_CHAKSHU", matched, "Mock Chakshu cluster match" if matched else "No mock match", 0.9 if matched else 0.62)

    async def validate_ceir_device(self, imei: str | None = None, device_id: str | None = None) -> dict[str, Any]:
        candidate = (imei or device_id or "").strip()
        valid_format = bool(re.fullmatch(r"\d{15}", candidate)) if imei else bool(candidate)
        blacklisted = candidate.endswith("999")
        return {
            "registry": "CEIR",
            "valid_format": valid_format,
            "blacklisted": blacklisted,
            "status": "blocked" if blacklisted else "valid" if valid_format else "invalid",
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "identifier_fingerprint": hashlib.sha256(candidate.encode()).hexdigest()[:16] if candidate else None,
        }

    async def verify_number(self, phone_number: str) -> dict[str, Any]:
        matches = [await self.check_trai_1909(phone_number), await self.check_sanchar_saathi_chakshu(phone_number)]
        return {
            "phone_number": self._mask_phone(phone_number),
            "checks": [match.__dict__ for match in matches],
            "flagged": any(match.matched for match in matches),
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "retention": "Transient verification only; raw number is not persisted by this service.",
        }

    @staticmethod
    def _normalize_phone(phone_number: str) -> str:
        return re.sub(r"\D", "", phone_number)[-10:]

    @staticmethod
    def _mask_phone(phone_number: str) -> str:
        digits = re.sub(r"\D", "", phone_number)
        return f"******{digits[-4:]}" if len(digits) >= 4 else "unavailable"
