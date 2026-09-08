WEIGHTS = {
    "voice_authenticity": 0.18,
    "speaker_identity": 0.12,
    "scam_intent": 0.22,
    "caller_reputation": 0.12,
    "financial_risk": 0.18,
    "conversation_risk": 0.18,
}

def clamp(v):
    return max(0.0, min(100.0, float(v)))

def analyze_risk(signals: dict):
    s = {k: clamp(signals.get(k, 0)) for k in WEIGHTS}
    quality = clamp(signals.get("quality", 100))
    score = sum(s[k] * w for k, w in WEIGHTS.items())
    if quality < 40:
        confidence = 35
        score = min(score, 65)
    elif quality < 70:
        confidence = 65
    else:
        confidence = 88

    if score >= 80: verdict = "critical"
    elif score >= 60: verdict = "high"
    elif score >= 40: verdict = "medium"
    else: verdict = "low"

    reasons = []
    labels = {
        "voice_authenticity": "synthetic-voice indicators",
        "speaker_identity": "speaker identity mismatch",
        "scam_intent": "scam intent",
        "caller_reputation": "caller reputation",
        "financial_risk": "financial risk",
        "conversation_risk": "social-engineering pressure",
    }
    for k, v in sorted(s.items(), key=lambda x: x[1], reverse=True):
        if v >= 65:
            reasons.append(labels[k])

    action = {
        "critical": "STOP. Do not share OTPs, passwords or money. Verify through a trusted channel.",
        "high": "Pause the interaction and independently verify the person, link or transaction.",
        "medium": "Proceed carefully and verify important claims before taking action.",
        "low": "No major risk signal detected, but continue normal security hygiene.",
    }[verdict]

    return {
        "score": round(score),
        "verdict": verdict,
        "confidence": confidence,
        "signals": {k: round(v) for k, v in s.items()},
        "reasons": reasons,
        "recommended_action": action,
        "quality": round(quality),
    }
