import os, re

SCAM_PATTERNS = {
    "otp": r"\b(otp|one time password|verification code)\b",
    "payment": r"\b(pay|transfer|upi|bank|send money|refund fee|deposit)\b",
    "urgency": r"\b(urgent|immediately|right now|within \d+ minutes|last chance)\b",
    "impersonation": r"\b(police|cbi|bank manager|income tax|courier|customer care|son|daughter)\b",
    "remote": r"\b(anydesk|teamviewer|remote access|screen share)\b",
}

def security_chat(message: str, language: str, conversation_id: str | None):
    text = message.lower()
    flags = [name for name, pattern in SCAM_PATTERNS.items() if re.search(pattern, text)]
    score = min(95, 15 * len(flags))
    if "otp" in flags or "remote" in flags:
        score += 25
    if score >= 80:
        verdict = "critical"
        reply = "This looks highly suspicious. Do not share OTPs, passwords, remote-access codes, or money. Hang up and verify the caller using a trusted number."
    elif score >= 50:
        verdict = "high"
        reply = "I detected scam-like signals. Pause before acting and independently verify the person, organisation, link, or payment request."
    elif score >= 25:
        verdict = "medium"
        reply = "There are some suspicious signals. Avoid rushing and verify important claims through an independent channel."
    else:
        verdict = "low"
        reply = "I don't see a strong scam signal in this message. Continue normal security precautions."

    return {
        "reply": reply,
        "language": language,
        "conversation_id": conversation_id,
        "risk": {"score": min(score, 100), "verdict": verdict, "flags": flags},
        "quick_actions": ["Analyze a voice", "Check a link", "Check an email", "Check a transaction", "I think I've been scammed"],
    }
