"""India-specific transcript fraud detection with explainable signals."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class FraudVector:
    key: str
    label: str
    description: str
    patterns: tuple[str, ...]
    weight: float


FRAUD_VECTORS: Final[tuple[FraudVector, ...]] = (
    FraudVector(
        "digital_arrest",
        "Digital arrest / law-enforcement impersonation",
        "Impersonation of CBI, ED, cyber police, or parcel and narcotics cases.",
        (
            r"digital\s*arrest|video\s*arrest|ghar\s*me\s*hi\s*nazarband",
            r"cbi|सीबीआई|ed\b|ईडी|cyber\s*police|साइबर\s*पुलिस|police\s*verification",
            r"illegal\s*parcel|नशीली|narcotic|parcel\s*me\s*drugs|फर्जी\s*केस",
            r"thana|थाना|giraftar|गिरफ्तार|pakad|पकड़|arrest",
        ),
        34.0,
    ),
    FraudVector(
        "upi_reverse_collect",
        "UPI reverse collect / remote-access scam",
        "A caller asks the victim to scan a QR to receive money, share a PIN, or install remote-access software.",
        (
            r"qr\s*(code|scan)|क्यूआर|scan\s*karke\s*paisa",
            r"upi\s*(pin|पिन)|pin\s*(bata|share|दें)|collect\s*request|request\s*approve",
            r"anydesk|teamviewer|remote\s*(access|desktop)|एनीडेस्क|टीमव्यूअर",
            r"receive\s*(money|payment)|पैसा\s*(lene|लेने|मिलने).*scan",
        ),
        30.0,
    ),
    FraudVector(
        "fake_kyc_utility",
        "Fake KYC / utility disconnection",
        "Threats to disconnect electricity, SIM, PAN-Aadhaar, or other services unless KYC is completed urgently.",
        (
            r"kyc|केवाईसी|re.?kyc|क्?वायसी",
            r"electricity|बिजली|light|connection\s*(cut| बंद)|मीटर",
            r"pan\s*aadhaar|pan.?aadhaar|पैन.?आधार|expiry|expire|समाप्त",
            r"sim\s*(block| बंद)|number\s*(block|बंद)|mobile\s*disconnect",
        ),
        24.0,
    ),
    FraudVector(
        "family_emergency_kidnap_clone",
        "Family emergency / kidnap voice clone",
        "A distressed family member or impersonator demands immediate UPI bail or ransom.",
        (
            r"accident|हादसा|hospital|अस्पताल|emergency|इमरजेंसी",
            r"kidnap|अपहरण|police\s*station|थाने\s*में|bail|जमानत",
            r"beta|बेटा|beti|बेटी|mummy|मम्मी|papa|पापा|bhai|भाई",
            r"immediate|turant|तुरंत|abhi|अभी|jaldi|जल्दी|upi\s*(karo|करो)|ransom|फिरौती",
        ),
        32.0,
    ),
)

# Romanized Hindi and common regional spellings are folded before matching.
_TRANSLITERATION: Final[dict[str, str]] = {
    "paisa": "money", "paise": "money", "rupiya": "money", "rupaye": "money",
    "dhan": "money", "dhanwa": "money", "ka paisa": "money",
    "thana": "police", "thanwa": "police", "daroga": "police", "sipahi": "police",
    "pakad": "arrest", "giraftar": "arrest", "dhar": "arrest", "uthawa": "arrest",
    "abhi": "immediate", "turant": "immediate", "jaldi": "immediate",
    "bhej": "send", "bhijwa": "send", "jama": "deposit",
}


def normalize_transcript(text: str) -> str:
    """Normalize Unicode, punctuation, and frequent Hindi/Indic colloquialisms."""
    normalized = unicodedata.normalize("NFKC", text).casefold()
    normalized = re.sub(r"[\u200b\u200c\u200d]", "", normalized)
    normalized = re.sub(r"[^\w\s₹-]", " ", normalized, flags=re.UNICODE)
    for source, target in sorted(_TRANSLITERATION.items(), key=lambda item: -len(item[0])):
        normalized = re.sub(rf"\b{re.escape(source)}\b", target, normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def classify_transcript(transcript: str) -> dict[str, object]:
    """Return an explainable, bounded risk score for a transcript."""
    normalized = normalize_transcript(transcript)
    vectors: list[dict[str, object]] = []
    total = 0.0
    for vector in FRAUD_VECTORS:
        matches = [pattern for pattern in vector.patterns if re.search(pattern, normalized, re.IGNORECASE)]
        if matches:
            contribution = min(vector.weight, vector.weight * (0.55 + 0.15 * len(matches)))
            total += contribution
            vectors.append({
                "key": vector.key,
                "label": vector.label,
                "description": vector.description,
                "confidence": round(min(1.0, 0.45 + 0.12 * len(matches)), 2),
                "matched_signals": matches,
                "score": round(contribution, 2),
            })
    score = round(min(100.0, total), 2)
    level = "critical" if score >= 70 else "high" if score >= 45 else "caution" if score >= 20 else "low"
    return {
        "score": score,
        "level": level,
        "vectors": vectors,
        "normalized_transcript": normalized,
        "recommended_action": "Stop the call, do not share a PIN or install software, and verify independently." if score >= 20 else "Continue with care and verify caller identity independently.",
        "disclaimer": "This is a risk signal, not proof of caller identity or criminal intent.",
    }
