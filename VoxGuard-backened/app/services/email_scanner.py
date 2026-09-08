import re

PATTERNS = [
    ("otp_request", r"\b(otp|verification code|one[- ]time password)\b"),
    ("credential_request", r"\b(password|login|sign in|verify your account)\b"),
    ("payment_request", r"\b(pay|payment|invoice|upi|bank transfer|refund)\b"),
    ("urgency", r"\b(urgent|immediately|within \d+ hours|account will be closed)\b"),
    ("attachment", r"\b(attachment|attached file|document)\b"),
    ("reward", r"\b(lottery|prize|winner|gift card|reward)\b"),
]

def scan_email(subject, sender, body):
    text = f"{subject} {sender} {body}".lower()
    flags = [name for name, pat in PATTERNS if re.search(pat, text)]
    score = min(100, len(flags) * 18)
    if "otp_request" in flags or "credential_request" in flags:
        score += 15
    score = min(score, 100)
    verdict = "critical" if score >= 80 else "high" if score >= 60 else "medium" if score >= 40 else "low"
    return {"score": score, "verdict": verdict, "flags": flags,
            "recommendation": "Do not click links or share credentials until the sender is independently verified." if score >= 40 else "No strong scam signal detected."}
