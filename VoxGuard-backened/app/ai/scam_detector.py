import re
import unicodedata

SCAM_VECTORS = {
    "digital_arrest": {"weight": 34, "patterns": ["digital arrest", "cyber police", "cbi", "enforcement directorate", "ed officer", "you are under arrest", "illegal parcel", "money laundering", "police case", "digital giraftari"]},
    "upi_remote_access": {"weight": 30, "patterns": ["upi pin", "upi collect", "scan qr", "qr code", "remote access", "anydesk", "teamviewer", "screen sharing", "share screen", "otp", "one time password"]},
    "kyc_utility": {"weight": 24, "patterns": ["kyc update", "kyc verification", "pan card", "aadhaar", "electricity disconnected", "sim blocked", "bank account blocked", "kyc expire"]},
    "family_emergency": {"weight": 32, "patterns": ["accident", "hospital", "kidnap", "ransom", "police station", "bail", "urgent money", "send money immediately", "don't tell anyone"]},
}

URGENCY = ["immediately", "right now", "urgent", "do it now", "don't disconnect", "within 10 minutes", "last warning"]
SECRETS = ["otp", "pin", "password", "cvv", "mpin", "passcode", "verification code"]


def normalize(text: str):
    text = unicodedata.normalize("NFKC", text or "").lower()
    text = re.sub(r"[\u200b-\u200d\ufeff]", "", text)
    text = re.sub(r"[^a-z0-9\u0900-\u097f\u0980-\u09ff\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def analyze_scam(text: str):
    normalized = normalize(text)
    results, score = [], 0
    for category, cfg in SCAM_VECTORS.items():
        matches = [p for p in cfg["patterns"] if p in normalized]
        if matches:
            results.append({"category": category, "matches": matches, "vector_weight": cfg["weight"]})
            score += cfg["weight"]
    urgency_hits = [p for p in URGENCY if p in normalized]
    secret_hits = [p for p in SECRETS if p in normalized]
    score += min(15, len(urgency_hits) * 5)
    score += min(15, len(secret_hits) * 5)
    score = min(100, score)
    action = "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"
    return {
        "scam_risk": score,
        "action": action,
        "detected_vectors": results,
        "urgency_indicators": urgency_hits,
        "credential_requests": secret_hits,
        "normalized_transcript": normalized,
    }
