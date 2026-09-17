import math


# ============================================================
# AUTHENTICATION / VOICE BASELINE
# ============================================================
# This value is ONLY for authentication / speaker enrollment.
AUTHENTICATION_MINIMUM_SECONDS = 55.0


def validate_authentication_voice_duration(
    duration_seconds: float,
    minimum_seconds: float = AUTHENTICATION_MINIMUM_SECONDS,
):
    """
    Validate the voice sample used for authentication / enrollment.

    Authentication voice samples must be at least 55 seconds long.
    """
    if duration_seconds < minimum_seconds:
        raise ValueError(
            f"Authentication voice sample must be at least "
            f"{minimum_seconds:.0f} seconds long."
        )

    return duration_seconds


# ============================================================
# NORMAL AUDIO ANALYSIS
# ============================================================
# Normal uploaded/live analysis only needs 5 seconds.
ANALYSIS_MINIMUM_SECONDS = 5.0


def validate_analysis_audio_duration(
    duration_seconds: float,
    minimum_seconds: float = ANALYSIS_MINIMUM_SECONDS,
):
    """
    Validate audio used for deepfake/scam/risk analysis.

    Normal analysis requires only 5 seconds.
    """
    if duration_seconds < minimum_seconds:
        raise ValueError(
            f"Audio analysis requires at least "
            f"{minimum_seconds:.0f} seconds of audio."
        )

    return duration_seconds


# ============================================================
# EXISTING AUDIO ANALYSIS FALLBACK
# ============================================================

def analyze_audio(raw: bytes, filename: str):
    """
    Safe baseline adapter.

    Replace this with your trained detector pipeline when required.
    """

    size = len(raw)

    quality = max(
        20,
        min(
            100,
            int(40 + math.log10(max(size, 10)) * 12)
        )
    )

    voice_score = 50

    if filename.lower().endswith((".mp3", ".m4a", ".ogg")):
        quality -= 5

    return {
        "filename": filename,
        "risk_score": 50,
        "verdict": "medium",
        "confidence": 40,
        "quality": quality,
        "signals": {
            "voice_authenticity": voice_score,
            "speaker_identity": 50,
            "scam_intent": 0,
            "caller_reputation": 50,
            "financial_risk": 0,
            "conversation_risk": 0,
        },
        "explanation": [
            "Audio was accepted and fingerprinted.",
            "Connect a trained AASIST/WavLM/XLS-R or equivalent detector for real deepfake inference.",
            "Do not use this baseline as a production fraud verdict.",
        ],
    }