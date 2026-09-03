"""DPDP-conscious incident payloads and victim action card helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def build_incident_payload(
    *,
    transcript_analysis: dict[str, Any],
    caller_number: str | None = None,
    call_started_at: str | None = None,
    victim_consent: bool = False,
    active_debit: bool = False,
) -> dict[str, Any]:
    """Build a submission-ready shape without retaining raw audio or biometrics."""
    if not victim_consent:
        raise ValueError("Explicit victim consent is required before generating an incident payload.")
    now = datetime.now(timezone.utc).isoformat()
    return {
        "incident_id": f"VG-IN-{uuid4().hex[:12].upper()}",
        "jurisdiction": "IN",
        "reported_at": now,
        "call_started_at": call_started_at,
        "caller_number": caller_number,
        "fraud_assessment": transcript_analysis,
        "active_financial_debit": active_debit,
        "submission_targets": ["cybercrime.gov.in", "DoT Chakshu"],
        "evidence": {"raw_audio_retained": False, "biometric_retained": False, "transcript_shared": True},
        "consent": {"explicit": True, "purpose": "fraud reporting", "recorded_at": now},
    }


def build_incident_card(*, incident_id: str, active_debit: bool, risk_level: str, caller_number: str | None = None) -> dict[str, Any]:
    return {
        "incident_id": incident_id,
        "title": "Active financial fraud risk" if active_debit else "Suspected fraud call",
        "risk_level": risk_level,
        "caller_number": caller_number,
        "primary_action": {"label": "Dial 1930", "tel": "tel:1930", "purpose": "Report active financial debit to the Indian Cyber Crime Helpline"},
        "secondary_action": {"label": "Report on cybercrime.gov.in", "url": "https://cybercrime.gov.in"},
    }


def build_family_sos(*, guardian_contact: str, call_details: dict[str, Any], language: str = "hi") -> dict[str, Any]:
    """Return a dispatch payload; an SMS/WhatsApp provider sends it in production."""
    return {
        "channel": "sms_whatsapp",
        "recipient": guardian_contact,
        "language": language if language in {"hi", "ta", "bn"} else "hi",
        "message": "VoxGuard SOS: Please check this call immediately. Do not share OTP/UPI PIN or install remote-access apps.",
        "call_details": call_details,
        "provider_dispatch_required": True,
    }
