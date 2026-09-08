import math, struct

MINIMUM_VOICE_SAMPLE_SECONDS = 55.0


def validate_voice_sample_duration(duration_seconds: float, minimum_seconds: float = MINIMUM_VOICE_SAMPLE_SECONDS):
    if duration_seconds < minimum_seconds:
        raise ValueError(f"Audio sample must be at least {minimum_seconds} seconds long.")
    return duration_seconds


def analyze_audio(raw: bytes, filename: str):
    # Safe baseline adapter. Replace with your trained detector in model/adapter.py.
    # This intentionally does NOT claim to detect deepfakes from bytes alone.
    size = len(raw)
    quality = max(20, min(100, int(40 + math.log10(max(size, 10)) * 12)))
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
            "conversation_risk": 0
        },
        "explanation": [
            "Audio was accepted and fingerprinted.",
            "Connect a trained XLS-R/WavLM/AASIST or equivalent detector for real deepfake inference.",
            "Do not use this baseline as a production fraud verdict."
        ]
    }
