import re


SCAM_PATTERNS = {

    "digital_arrest": [
        "digital arrest",
        "cyber police",
        "cbi",
        "enforcement directorate",
        "ed officer",
        "you are under arrest",
        "illegal parcel",
        "money laundering"
    ],

    "upi_scam": [
        "upi pin",
        "upi collect",
        "scan qr",
        "qr code",
        "remote access",
        "anydesk",
        "teamviewer",
        "screen sharing"
    ],

    "kyc_scam": [
        "kyc update",
        "kyc verification",
        "pan card",
        "aadhaar",
        "electricity disconnected",
        "sim blocked",
        "bank account blocked"
    ],

    "family_emergency": [
        "accident",
        "hospital",
        "kidnap",
        "ransom",
        "police station",
        "bail",
        "urgent money",
        "send money immediately"
    ]
}


class ScamDetector:

    def analyze(self, transcript):

        transcript = transcript.lower()

        detected = []

        for category, patterns in SCAM_PATTERNS.items():

            matches = []

            for pattern in patterns:

                if re.search(
                    r"\b" + re.escape(pattern) + r"\b",
                    transcript
                ):
                    matches.append(pattern)

            if matches:

                detected.append({
                    "category": category,
                    "matches": matches
                })

        risk = min(
            100,
            len(detected) * 25 +
            sum(
                len(x["matches"])
                for x in detected
            ) * 5
        )

        return {
            "scam_risk": risk,
            "detected_patterns": detected
        }