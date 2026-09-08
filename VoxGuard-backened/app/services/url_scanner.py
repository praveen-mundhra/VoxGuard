from urllib.parse import urlparse
import re

SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly"}
BRANDS = ["google", "microsoft", "sbi", "hdfc", "icici", "paytm", "phonepe", "amazon", "flipkart"]

def scan_url(url: str):
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    p = urlparse(url)
    host = (p.hostname or "").lower()
    flags = []
    score = 0
    if p.scheme != "https":
        score += 20; flags.append("no_https")
    if host in SHORTENERS:
        score += 20; flags.append("shortened_url")
    if "@" in url:
        score += 25; flags.append("credential_style_url")
    if len(url) > 180:
        score += 10; flags.append("unusually_long_url")
    if host.count(".") >= 3:
        score += 10; flags.append("deep_subdomain")
    for brand in BRANDS:
        if brand in host and not host.endswith(brand + ".com"):
            score += 25; flags.append(f"possible_{brand}_impersonation")
            break
    score = min(score, 100)
    verdict = "critical" if score >= 80 else "high" if score >= 60 else "medium" if score >= 40 else "low"
    return {"url": url, "domain": host, "score": score, "verdict": verdict, "flags": flags,
            "note": "This is a heuristic scanner. Add a reputation/threat-intelligence provider for production."}
