import asyncio
import importlib.util
import json
import os
import time
from pathlib import Path

import numpy as np

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
    status,
)

from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from database import SessionLocal

from fastapi import WebSocket, WebSocketDisconnect
from jose import JWTError, jwt


# ============================================================
# AUTHENTICATION LOADER
# ============================================================
#
# Your project contains both:
#
#   app/security.py
#
# and
#
#   app/security/
#
# which can cause:
#
#   ModuleNotFoundError:
#   No module named 'app.security.authentication';
#   'app.security' is not a package
#
# So authentication.py is loaded directly from its file path.
# ============================================================

def load_authentication_module():
    module_path = (
        Path(__file__).resolve().parents[1]
        / "security"
        / "authentication.py"
    )

    if not module_path.exists():
        raise ImportError(
            f"Authentication module not found at: {module_path}"
        )

    spec = importlib.util.spec_from_file_location(
        "voxguard_authentication_calls",
        module_path,
    )

    if spec is None or spec.loader is None:
        raise ImportError(
            f"Unable to load authentication module from {module_path}"
        )

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    return module


authentication = load_authentication_module()
get_user_for_token = authentication.get_user_for_token


# ============================================================
# PROJECT IMPORTS
# ============================================================

try:
    from app.ai.audio import (
        decode_audio_bytes,
        resample_audio,
    )
except ImportError:
    try:
        from app.ai.audio_utils import (
            decode_audio_bytes,
            resample_audio,
        )
    except ImportError:
        decode_audio_bytes = None
        resample_audio = None

try:
    from app.ai.audio_utils import (
        decode_float32,
        decode_pcm16,
        resample as resample_stream_audio,
    )
except ImportError:
    decode_float32 = None
    decode_pcm16 = None
    resample_stream_audio = None


try:
    from app.services.voice import (
        MINIMUM_VOICE_SAMPLE_SECONDS,
        validate_audio_duration,
        validate_authentication_sample,
    )
except ImportError:
    # Safe fallback values
    MINIMUM_VOICE_SAMPLE_SECONDS = 5.0

    def validate_audio_duration(audio, minimum_seconds=5.0):
        if audio is None:
            raise ValueError("Audio data is empty.")

        duration = len(audio) / 16000.0

        if duration < minimum_seconds:
            raise ValueError(
                f"Audio must be at least {minimum_seconds:.0f} seconds long."
            )

        return duration

    def validate_authentication_sample(audio):
        duration = len(audio) / 16000.0

        if duration < 55.0:
            raise ValueError(
                "Authentication voice sample must be at least 55 seconds."
            )

        return duration


# ============================================================
# AI COMPONENTS
# ============================================================

try:
    from app.services.deepfake_detector import detector
except ImportError:
    try:
        from app.ai.detector import detector
    except ImportError:
        detector = None


try:
    from app.ai.speaker_verifier import speaker_verifier
except ImportError:
    speaker_verifier = None


try:
    from app.ai.transcriber import transcriber
except ImportError:
    transcriber = None


try:
    from app.ai.scam_detector import analyze_scam
except ImportError:
    try:
        from app.ai.scam import analyze_scam
    except ImportError:

        def analyze_scam(transcript):
            return {
                "scam_risk": 0.0,
                "risk_level": "LOW",
                "matched_keywords": [],
            }


try:
    from app.ai.risk_engine import (
        RiskInputs,
        risk_engine,
    )
except ImportError:
    RiskInputs = None
    risk_engine = None


# ============================================================
# DATABASE
# ============================================================

try:
    from database import SessionLocal
except ImportError:
    try:
        from database import SessionLocal
    except ImportError:
        SessionLocal = None


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/calls",
    tags=["Calls"],
)


# ============================================================
# CONSTANTS
# ============================================================

SAMPLE_RATE = 16000

MAX_UPLOAD_MB = 25

# Normal voice analysis:
# minimum 5 seconds
LIVE_MIN_SECONDS = 5

# Live analysis window:
DEFAULT_STREAM_WINDOW = 5

# IMPORTANT:
# Analyze a new window every 5 seconds.
DEFAULT_STREAM_STRIDE = 5

# Authentication/reference voice:
AUTHENTICATION_MIN_SECONDS = 55

# Maximum reference audio used for authentication.
AUTHENTICATION_MAX_SECONDS = 60

MAX_CONCURRENT_LIVE_ANALYSES = 3


# ============================================================
# REQUEST MODELS
# ============================================================

class LiveStreamConfig(BaseModel):
    window: int = Field(
        default=DEFAULT_STREAM_WINDOW,
        ge=5,
        le=30,
    )

    stride: int = Field(
        default=DEFAULT_STREAM_STRIDE,
        ge=5,
        le=30,
    )


# ============================================================
# GENERAL HELPERS
# ============================================================

def clamp_score(value):
    """
    Convert a value into a safe 0-100 percentage.
    """

    try:
        value = float(value)
    except (TypeError, ValueError):
        return 0.0

    if np.isnan(value) or np.isinf(value):
        return 0.0

    return round(max(0.0, min(100.0, value)), 2)


def risk_level_from_score(score):
    """
    Convert risk score into a display classification.
    """

    if score is None:
        return "INCONCLUSIVE"

    score = clamp_score(score)

    if score < 10:
        return "GENUINE"

    if score >= 70:
        return "HIGH"

    if score >= 40:
        return "MEDIUM"

    return "LOW"


def recommendations_for_risk(score):
    """
    Dynamic recommendations for the current risk level.
    """

    score = clamp_score(score)

    if score >= 70:
        return [
            {
                "title": "Stop sensitive action",
                "description": (
                    "Pause before sharing money, OTPs, PINs, "
                    "passwords or other credentials."
                ),
                "priority": "HIGH",
            },
            {
                "title": "Verify independently",
                "description": (
                    "Call the person back using a trusted number "
                    "or another known communication channel."
                ),
                "priority": "HIGH",
            },
            {
                "title": "Use secondary verification",
                "description": (
                    "Use MFA, callback verification or another "
                    "independent authentication factor."
                ),
                "priority": "HIGH",
            },
            {
                "title": "Report or escalate",
                "description": (
                    "Report suspicious activity to the relevant "
                    "security or fraud-response team."
                ),
                "priority": "HIGH",
            },
        ]

    if score >= 40:
        return [
            {
                "title": "Verify caller identity",
                "description": (
                    "Confirm the caller through a trusted "
                    "independent communication channel."
                ),
                "priority": "MEDIUM",
            },
            {
                "title": "Avoid sensitive information",
                "description": (
                    "Do not share OTPs, PINs, passwords or "
                    "financial information until verified."
                ),
                "priority": "MEDIUM",
            },
            {
                "title": "Increase monitoring",
                "description": (
                    "Continue the conversation cautiously and "
                    "monitor for additional suspicious signals."
                ),
                "priority": "MEDIUM",
            },
        ]

    return [
        {
            "title": "Continue with caution",
            "description": (
                "No strong impersonation signal has been detected "
                "in the current audio window."
            ),
            "priority": "LOW",
        },
        {
            "title": "Use normal verification",
            "description": (
                "Continue using your normal identity-verification "
                "process for sensitive requests."
            ),
            "priority": "LOW",
        },
    ]


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


# ============================================================
# AUDIO HELPERS
# ============================================================

def normalize_audio(audio):
    """
    Convert audio into float32 mono audio at 16 kHz.
    """

    if audio is None:
        raise ValueError("Audio data is empty.")

    audio = np.asarray(audio)

    if audio.ndim > 1:
        audio = np.mean(audio, axis=1)

    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)

    max_abs = np.max(np.abs(audio)) if len(audio) else 0

    if max_abs > 1.0:
        audio = audio / max_abs

    return audio.astype(np.float32)


def decode_uploaded_audio(data):
    """
    Decode uploaded audio using the project's audio utility.
    """

    if decode_audio_bytes is None:
        raise RuntimeError(
            "decode_audio_bytes could not be imported. "
            "Check app/services/audio.py or audio_utils.py."
        )

    audio = decode_audio_bytes(data)

    audio = normalize_audio(audio)

    return audio


def prepare_stream_audio(
    data,
    audio_format="pcm16",
    source_sample_rate=SAMPLE_RATE,
):
    """
    Decode a raw WebSocket audio packet and convert it to 16 kHz mono.
    """

    if not data:
        return np.array([], dtype=np.float32)

    if audio_format == "float32":
        if decode_float32 is None:
            raise RuntimeError("float32 WebSocket audio decoding is unavailable.")
        audio = decode_float32(data)
    elif audio_format in ("pcm16", "int16"):
        if decode_pcm16 is None:
            raise RuntimeError("PCM16 WebSocket audio decoding is unavailable.")
        audio = decode_pcm16(data)
    else:
        raise ValueError(f"Unsupported WebSocket audio format: {audio_format}")

    audio = normalize_audio(audio)

    if source_sample_rate != SAMPLE_RATE:
        if resample_stream_audio is None:
            raise RuntimeError("WebSocket audio resampling is unavailable.")
        audio = resample_stream_audio(
            audio,
            source_sample_rate,
            SAMPLE_RATE,
        )

    return audio


# ============================================================
# DEEPFAKE ANALYSIS
# ============================================================

def run_deepfake_detection(audio):
    """
    Run AASIST/deepfake detector.
    """

    if detector is None:
        return {
            "available": False,
            "deepfake_risk": None,
            "spoof_probability": None,
            "genuine_probability": None,
            "label": "UNAVAILABLE",
        }

    result = detector.predict(audio)

    if result is None:
        return {
            "available": False,
            "deepfake_risk": None,
            "spoof_probability": None,
            "genuine_probability": None,
            "label": "UNAVAILABLE",
        }

    if isinstance(result, dict):
        output = dict(result)
    else:
        output = {
            "score": safe_float(result),
        }

    if output.get("available") is False:
        output.setdefault("label", "UNAVAILABLE")
        return output

    # Normalize common score names.
    if "spoof_probability" in output:
        if output["spoof_probability"] is None:
            output["available"] = False
            output.setdefault("label", "UNAVAILABLE")
            return output
        spoof = clamp_score(
            safe_float(output["spoof_probability"]) * 100
            if safe_float(output["spoof_probability"]) <= 1
            else safe_float(output["spoof_probability"])
        )

    elif "deepfake_risk" in output:
        if output["deepfake_risk"] is None:
            output["available"] = False
            output.setdefault("label", "UNAVAILABLE")
            return output
        spoof = clamp_score(output["deepfake_risk"])

    elif "score" in output:
        if output["score"] is None:
            output["available"] = False
            output.setdefault("label", "UNAVAILABLE")
            return output
        raw = safe_float(output["score"])

        spoof = clamp_score(
            raw * 100 if raw <= 1 else raw
        )

    else:
        output.update({
            "available": False,
            "deepfake_risk": None,
            "spoof_probability": None,
            "genuine_probability": None,
            "label": "UNAVAILABLE",
        })
        return output

    genuine = clamp_score(100.0 - spoof)

    output["spoof_probability"] = spoof / 100.0
    output["genuine_probability"] = genuine / 100.0
    output["deepfake_risk"] = spoof
    output["available"] = True

    if spoof < 10:
        output["label"] = "GENUINE"
    elif spoof >= 70:
        output["label"] = "SPOOF"
    elif spoof >= 40:
        output["label"] = "SUSPICIOUS"
    else:
        output["label"] = "GENUINE"

    return output


# ============================================================
# SPEAKER VERIFICATION
# ============================================================

def run_speaker_verification(audio):
    """
    Run ECAPA-TDNN speaker verification.
    """

    if speaker_verifier is None:
        return {
            "available": False,
            "similarity": None,
            "speaker_risk": None,
            "verified": False,
            "status": "unavailable",
        }

    try:
        result = speaker_verifier.verify(audio)

    except TypeError:
        try:
            result = speaker_verifier.predict(audio)
        except Exception:
            result = None

    if result is None:
        return {
            "available": False,
            "similarity": None,
            "speaker_risk": None,
            "verified": False,
            "status": "unavailable",
        }

    if isinstance(result, dict):
        output = dict(result)
    else:
        output = {
            "similarity": safe_float(result),
        }

    if output.get("available") is False or output.get("status") in {
        "not_enrolled",
        "unavailable",
        "unconfigured",
    }:
        output.setdefault("available", output.get("status") != "unavailable")
        output.setdefault("similarity", None)
        output.setdefault("speaker_risk", None)
        output["verified"] = False
        return output

    if output.get("similarity") is None and output.get("score") is None:
        output.update({
            "available": False,
            "similarity": None,
            "speaker_risk": None,
            "verified": False,
            "status": "unavailable",
        })
        return output

    similarity = safe_float(
        output.get(
            "similarity",
            output.get("score", 0.0),
        )
    )

    if similarity <= 1:
        similarity *= 100

    similarity = clamp_score(similarity)

    speaker_risk = output.get("speaker_risk")
    if speaker_risk is None:
        speaker_risk = 100.0 - similarity
    speaker_risk = clamp_score(speaker_risk)

    output["similarity"] = similarity / 100.0
    output["speaker_risk"] = speaker_risk
    output["verified"] = similarity >= 70
    output["available"] = True

    return output


# ============================================================
# TRANSCRIPTION
# ============================================================

def run_transcription(audio):
    """
    Run Faster-Whisper transcription.
    """

    if transcriber is None:
        return {
            "text": "",
            "language": None,
        }

    try:
        result = transcriber.transcribe(audio)
    except TypeError:
        result = transcriber.predict(audio)

    if result is None:
        return {
            "text": "",
            "language": None,
        }

    if isinstance(result, dict):
        return result

    return {
        "text": str(result),
        "language": None,
    }


# ============================================================
# SCAM ANALYSIS
# ============================================================

def run_scam_analysis(transcript):
    """
    Run NLP/scam analysis.
    """

    text = ""

    if isinstance(transcript, dict):
        text = transcript.get(
            "text",
            transcript.get("transcript", ""),
        )
    else:
        text = str(transcript or "")

    if not text.strip():
        return {
            "available": False,
            "scam_risk": None,
            "risk_level": "INCONCLUSIVE",
            "matched_keywords": [],
        }

    try:
        result = analyze_scam(text)

    except TypeError:
        result = analyze_scam(
            transcript
        )

    if result is None:
        return {
            "scam_risk": 0.0,
            "risk_level": "LOW",
            "matched_keywords": [],
        }

    if isinstance(result, dict):
        output = dict(result)
    else:
        output = {
            "scam_risk": safe_float(result),
        }

    raw_scam_risk = output.get(
        "scam_risk",
        output.get("risk"),
    )
    if raw_scam_risk is None:
        output.update({
            "available": False,
            "scam_risk": None,
            "risk_level": "INCONCLUSIVE",
        })
        return output

    scam = safe_float(raw_scam_risk)

    if scam <= 1:
        scam *= 100

    scam = clamp_score(scam)

    output["scam_risk"] = scam
    output["available"] = True

    if scam >= 70:
        output["risk_level"] = "HIGH"
    elif scam >= 40:
        output["risk_level"] = "MEDIUM"
    else:
        output["risk_level"] = "LOW"

    return output


# ============================================================
# RISK ENGINE
# ============================================================

def calculate_risk(
    deepfake,
    speaker,
    scam,
):
    """
    Combine only available detector signals into an impersonation risk.
    """

    candidates = {
        "deepfake_risk": (
            deepfake.get("deepfake_risk"),
            0.30,
            deepfake.get("available") is not False,
        ),
        "speaker_risk": (
            speaker.get("speaker_risk"),
            0.20,
            speaker.get("available") is not False
            and speaker.get("status") not in {
                "not_enrolled",
                "unavailable",
                "unconfigured",
            },
        ),
        "scam_risk": (
            scam.get("scam_risk"),
            0.20,
            scam.get("available") is not False,
        ),
    }
    components = {}
    active_weight = 0.0

    for name, (value, weight, available) in candidates.items():
        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            continue

        if not available or not np.isfinite(numeric_value):
            continue

        components[name] = clamp_score(numeric_value)
        active_weight += weight

    if not components:
        return {
            "risk_score": None,
            "risk_level": "INCONCLUSIVE",
            "action": "CHECK_ANALYSIS_AVAILABILITY",
            "available_signals": [],
            "components": {},
        }

    deepfake_risk = components.get("deepfake_risk", 0.0)
    speaker_risk = components.get("speaker_risk", 0.0)
    scam_risk = components.get("scam_risk", 0.0)

    # If the project's dedicated risk engine exists,
    # use it first.
    if risk_engine is not None and RiskInputs is not None:

        try:
            inputs = RiskInputs(
                deepfake_risk=deepfake_risk,
                speaker_risk=speaker_risk,
                scam_risk=scam_risk,
            )

            result = risk_engine.calculate(inputs)

            if isinstance(result, dict):
                output = dict(result)

                raw_score = output.get(
                    "risk_score",
                    output.get("score"),
                )
                score = clamp_score(raw_score / active_weight)

                output["risk_score"] = score
                output["risk_level"] = risk_level_from_score(
                    score
                )
                output["action"] = (
                    "STOP_AND_VERIFY"
                    if score >= 70
                    else "VERIFY"
                    if score >= 40
                    else "MONITOR"
                )
                output["recommendations"] = recommendations_for_risk(
                    score
                )
                output["components"] = components
                output["available_signals"] = list(components)

                return output

        except Exception as exc:
            print(
                f"[RISK ENGINE] Falling back to local calculation: {exc}"
            )

    # Safe fallback weighted calculation.
    #
    # Deepfake and speaker verification are given more
    # weight because this is an impersonation detector.
    score = clamp_score(
        (
            deepfake_risk * 0.30
            + speaker_risk * 0.20
            + scam_risk * 0.20
        )
        / active_weight
    )

    level = risk_level_from_score(score)

    action = (
        "STOP_AND_VERIFY"
        if score >= 70
        else "VERIFY"
        if score >= 40
        else "MONITOR"
    )

    return {
        "risk_score": score,
        "risk_level": level,
        "action": action,
        "components": components,
        "available_signals": list(components),
        "recommendations": recommendations_for_risk(score),
    }


# ============================================================
# SIGNAL GENERATION
# ============================================================

def build_signals(
    deepfake,
    speaker,
    scam,
):
    """
    Convert model outputs into frontend-friendly percentages.
    """

    spoof_probability = deepfake.get("spoof_probability")
    genuine_probability = deepfake.get("genuine_probability")
    deepfake_available = (
        deepfake.get("available") is not False
        and spoof_probability is not None
        and genuine_probability is not None
    )
    spoof = (
        clamp_score(safe_float(spoof_probability) * 100)
        if deepfake_available
        else None
    )
    genuine = (
        clamp_score(safe_float(genuine_probability) * 100)
        if deepfake_available
        else None
    )

    speaker_available = (
        speaker.get("available") is not False
        and speaker.get("status") not in {
            "not_enrolled",
            "unavailable",
            "unconfigured",
        }
        and speaker.get("similarity") is not None
    )
    similarity = (
        clamp_score(safe_float(speaker["similarity"]) * 100)
        if speaker_available
        else None
    )

    scam_risk_value = scam.get("scam_risk")
    scam_available = (
        scam.get("available") is not False
        and scam_risk_value is not None
    )
    scam_risk = (
        clamp_score(scam_risk_value)
        if scam_available
        else None
    )

    return {
        "acoustic": genuine,
        "spectral": clamp_score(100 - spoof) if spoof is not None else None,
        "prosody": (
            clamp_score(deepfake["prosody_consistency"])
            if deepfake_available
            and deepfake.get("prosody_consistency") is not None
            else None
        ),
        "speaker": similarity,
        "scam": (
            clamp_score(100 - scam_risk)
            if scam_risk is not None
            else None
        ),
    }


# ============================================================
# COMPLETE AUDIO ANALYSIS
# ============================================================

def analyze_audio(
    audio,
    duration_seconds=None,
    progress_callback=None,
):
    """
    Complete AI analysis pipeline.

    AASIST
    ECAPA-TDNN
    Faster-Whisper
    Scam NLP
    Risk Engine
    """

    started = time.perf_counter()

    audio = normalize_audio(audio)

    if duration_seconds is None:
        duration_seconds = len(audio) / SAMPLE_RATE

    duration_seconds = round(
        float(duration_seconds),
        2,
    )

    # --------------------------------------------------------
    # AASIST
    # --------------------------------------------------------

    print("[LIVE AI] Starting live audio analysis.")

    def report_progress(stage):
        if progress_callback is not None:
            progress_callback(stage)

    report_progress("deepfake")
    deepfake = run_deepfake_detection(audio)

    # --------------------------------------------------------
    # ECAPA-TDNN
    # --------------------------------------------------------

    report_progress("speaker")
    speaker = run_speaker_verification(audio)

    # --------------------------------------------------------
    # Faster-Whisper
    # --------------------------------------------------------

    report_progress("transcription")
    transcript = run_transcription(audio)

    # --------------------------------------------------------
    # Scam detection
    # --------------------------------------------------------

    report_progress("scam")
    scam = run_scam_analysis(
        transcript
    )
    report_progress("risk")

    # --------------------------------------------------------
    # Risk Engine
    # --------------------------------------------------------

    risk = calculate_risk(
        deepfake,
        speaker,
        scam,
    )

    raw_risk_score = risk.get("risk_score")
    risk_score = (
        clamp_score(raw_risk_score)
        if raw_risk_score is not None
        else None
    )

    risk_level = risk_level_from_score(
        risk_score
    )

    risk["risk_score"] = risk_score
    risk["risk_level"] = risk_level

    # --------------------------------------------------------
    # Signals
    # --------------------------------------------------------

    signals = build_signals(
        deepfake,
        speaker,
        scam,
    )

    # --------------------------------------------------------
    # Recommendations
    # --------------------------------------------------------

    recommendations = (
        recommendations_for_risk(risk_score)
        if risk_score is not None
        else [{
            "title": "Analysis inconclusive",
            "description": (
                "No live detector returned a usable signal. "
                "Check model availability and try again."
            ),
            "priority": "MEDIUM",
        }]
    )

    # --------------------------------------------------------
    # Telemetry
    # --------------------------------------------------------

    processing_time = round(
        time.perf_counter() - started,
        2,
    )

    telemetry = {
        "processing_time_seconds": processing_time,
        "sample_rate": SAMPLE_RATE,
        "window_seconds": duration_seconds,
    }

    # --------------------------------------------------------
    # FINAL RESULT
    # --------------------------------------------------------

    result = {
        "type": "analysis",

        "timestamp": time.time(),

        "duration_seconds": duration_seconds,

        "deepfake": deepfake,

        "speaker": speaker,

        "transcript": transcript,

        "scam": scam,

        "context": {
            "source": "live_voice"
            if duration_seconds <= 10
            else "audio_upload",
        },

        "risk": risk,

        # Explicit frontend-friendly risk percentage.
        "risk_percent": risk_score,

        "signals": signals,

        "telemetry": telemetry,

        "recommended_actions": recommendations,

        "live_status": {
            "risk_score": risk_score,
            "risk_percent": risk_score,
            "risk_level": risk_level,
            "action": risk.get(
                "action",
                "MONITOR",
            ),
            "recommendations": recommendations,
        },
    }

    return result


# ============================================================
# USER AUTHENTICATION
# ============================================================

# ============================================================
# WEBSOCKET AUTHENTICATION
# ============================================================

async def authenticate_websocket(websocket):
    """
    Authenticate WebSocket using the same database/session
    used by the normal HTTP authentication system.
    """

    token = websocket.query_params.get("token")

    if not token:
        authorization = websocket.headers.get("authorization")

        if authorization:
            authorization = authorization.strip()

            if authorization.lower().startswith("bearer "):
                token = authorization[7:].strip()

    if not token:
        print("[AUTH] WebSocket rejected: no access token supplied.")
        return None

    # Remove accidental quotes
    token = token.strip().strip('"').strip("'")

    db = None

    try:
        # IMPORTANT:
        # get_user_for_token() requires BOTH token and db.
        db = SessionLocal()

        print("[AUTH] WebSocket token received.")
        print(f"[AUTH] Token length: {len(token)}")

        user = get_user_for_token(token, db)

        if user is None:
            print("[AUTH] WebSocket rejected: user not found.")
            return None

        print(
            f"[AUTH] WebSocket authenticated successfully. "
            f"user_id={getattr(user, 'id', None)}"
        )

        return user

    except Exception as exc:
        print(
            f"[AUTH] WebSocket authentication error: "
            f"{type(exc).__name__}: {exc}"
        )

        return None

    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass
# ============================================================
# UPLOAD ANALYSIS ENDPOINT
# ============================================================

@router.post("/analyze")
async def analyze_uploaded_audio(
    file: UploadFile = File(...),
):
    """
    Analyze uploaded voice audio.

    Minimum duration:
        5 seconds
    """

    try:

        # ----------------------------------------------------
        # File size
        # ----------------------------------------------------

        contents = await file.read()

        size_mb = len(contents) / (
            1024 * 1024
        )

        if size_mb > MAX_UPLOAD_MB:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"Audio file is too large. "
                    f"Maximum allowed size is "
                    f"{MAX_UPLOAD_MB} MB."
                ),
            )

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="Uploaded audio file is empty.",
            )

        # ----------------------------------------------------
        # Decode
        # ----------------------------------------------------

        try:
            audio = decode_uploaded_audio(
                contents
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Unable to decode audio: {exc}",
            )

        # ----------------------------------------------------
        # Duration validation
        # ----------------------------------------------------

        duration = len(audio) / SAMPLE_RATE

        if duration < LIVE_MIN_SECONDS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Audio must be at least "
                    f"{LIVE_MIN_SECONDS} seconds long."
                ),
            )

        # ----------------------------------------------------
        # Analyze
        # ----------------------------------------------------

        result = await run_in_threadpool(
            analyze_audio,
            audio,
            duration,
        )

        return result

    except HTTPException:
        raise

    except Exception as exc:
        print(
            f"[ANALYZE] ERROR: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# SPEAKER ENROLLMENT
# ============================================================

@router.post("/speaker/enroll")
async def enroll_speaker(
    file: UploadFile = File(...),
):
    """
    Enroll/reference speaker voice.

    Authentication sample must be at least 55 seconds.
    """

    try:

        contents = await file.read()

        size_mb = len(contents) / (
            1024 * 1024
        )

        if size_mb > MAX_UPLOAD_MB:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"Audio file is too large. "
                    f"Maximum allowed size is "
                    f"{MAX_UPLOAD_MB} MB."
                ),
            )

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="Voice sample is empty.",
            )

        # ----------------------------------------------------
        # Decode
        # ----------------------------------------------------

        try:
            audio = decode_uploaded_audio(
                contents
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Unable to decode audio: {exc}",
            )

        # ----------------------------------------------------
        # 55-second authentication requirement
        # ----------------------------------------------------

        duration = len(audio) / SAMPLE_RATE

        if duration < AUTHENTICATION_MIN_SECONDS:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Authentication/reference voice sample "
                    "must be at least 55 seconds long."
                ),
            )

        # Limit processing reference sample.
        max_samples = int(
            AUTHENTICATION_MAX_SECONDS
            * SAMPLE_RATE
        )

        reference_audio = audio[
            :max_samples
        ]

        # ----------------------------------------------------
        # Store/enroll reference voice
        # ----------------------------------------------------

        if speaker_verifier is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Speaker verification service "
                    "is not available."
                ),
            )

        try:
            result = await run_in_threadpool(
                speaker_verifier.enroll,
                reference_audio,
            )

        except AttributeError:
            try:
                result = await run_in_threadpool(
                    speaker_verifier.register,
                    reference_audio,
                )
            except AttributeError:
                result = {
                    "status": "ready",
                    "message": (
                        "Speaker verifier is loaded, "
                        "but no enrollment method was found."
                    ),
                }

        return {
            "success": True,
            "duration_seconds": round(
                duration,
                2,
            ),
            "authentication_minimum_seconds": (
                AUTHENTICATION_MIN_SECONDS
            ),
            "result": result,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(
            f"[SPEAKER ENROLL] ERROR: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# LIVE WEBSOCKET
# ============================================================


# ============================================================
# LIVE WEBSOCKET
# ============================================================

@router.websocket("/stream")
async def live_audio_stream(
    websocket: WebSocket,
):
    """
    Authenticated live voice analysis.

    IMPORTANT:
    This router has prefix="/calls".
    If main.py adds prefix="/api", the endpoint is:
        /api/calls/stream

    Authenticate with the existing authentication module.
    Preserve the existing 5-second audio analysis pipeline.
    """

    # Accept first so authentication failures can be reported
    # as WebSocket close codes instead of an HTTP 403 handshake.
    await websocket.accept()

    print("[LIVE] WebSocket connection accepted.")

    # --------------------------------------------------------
    # Authenticate with the existing login implementation
    # --------------------------------------------------------
    user = await authenticate_websocket(websocket)

    if user is None:
        try:
            await websocket.send_json({
                "type": "analysis_error",
                "code": "AUTHENTICATION_FAILED",
                "error": "Authentication failed. Please log in again.",
            })
        except Exception:
            pass

        try:
            await websocket.close(code=1008)
        except Exception:
            pass

        return

    print(
        "[LIVE] User authenticated. "
        f"user_id={getattr(user, 'id', None)}"
    )

    # --------------------------------------------------------
    # Configuration
    # --------------------------------------------------------
    window = DEFAULT_STREAM_WINDOW
    stride = DEFAULT_STREAM_STRIDE

    audio_buffer = np.array([], dtype=np.float32)
    window_index = 0
    analysis_tasks = set()
    send_lock = asyncio.Lock()
    connection_open = True

    semaphore = asyncio.Semaphore(
        MAX_CONCURRENT_LIVE_ANALYSES
    )

    # --------------------------------------------------------
    # Safe sender
    # --------------------------------------------------------
    async def safe_send(payload):
        nonlocal connection_open

        if not connection_open:
            return False

        try:
            async with send_lock:
                if not connection_open:
                    return False

                await websocket.send_json(payload)
                return True

        except Exception as exc:
            print(f"[LIVE SEND] {type(exc).__name__}: {exc}")
            connection_open = False
            return False

    # --------------------------------------------------------
    # Analyze one audio window
    # --------------------------------------------------------
    async def analyze_live_window(
        audio_window,
        current_index,
        current_start,
        current_end,
    ):
        async with semaphore:
            if not connection_open:
                return

            started = time.perf_counter()

            await safe_send({
                "type": "analysis_started",
                "analysis_index": current_index,
                "window_index": current_index,
                "window_start_seconds": current_start,
                "window_end_seconds": current_end,
                "window_seconds": current_end - current_start,
                "status": "analyzing",
            })

            try:
                loop = asyncio.get_running_loop()

                def report_progress(stage):
                    def schedule_progress():
                        asyncio.create_task(safe_send({
                            "type": "analysis_progress",
                            "analysis_index": current_index,
                            "window_index": current_index,
                            "stage": stage,
                        }))

                    loop.call_soon_threadsafe(schedule_progress)

                result = await run_in_threadpool(
                    analyze_audio,
                    audio_window,
                    current_end - current_start,
                    report_progress,
                )

                risk = result.get("risk") or {}
                raw_risk_score = risk.get(
                    "risk_score",
                    result.get("risk_percent"),
                )
                risk_score = (
                    clamp_score(raw_risk_score)
                    if raw_risk_score is not None
                    else None
                )

                risk_level = risk_level_from_score(risk_score)

                risk["risk_score"] = risk_score
                risk["risk_level"] = risk_level

                result["risk"] = risk
                result["risk_percent"] = risk_score
                result["risk_level"] = risk_level

                recommendations = (
                    result.get("recommended_actions")
                    or (
                        recommendations_for_risk(risk_score)
                        if risk_score is not None
                        else [{
                            "title": "Analysis inconclusive",
                            "description": (
                                "No live detector returned a usable signal. "
                                "Check model availability and try again."
                            ),
                            "priority": "MEDIUM",
                        }]
                    )
                )

                result["recommended_actions"] = recommendations

                live_status = result.get("live_status") or {}
                live_status.update({
                    "risk_score": risk_score,
                    "risk_percent": risk_score,
                    "risk_level": risk_level,
                    "recommendations": recommendations,
                })
                result["live_status"] = live_status

                telemetry = result.get("telemetry") or {}
                telemetry["live_processing_time_seconds"] = round(
                    time.perf_counter() - started,
                    2,
                )
                result["telemetry"] = telemetry

                payload = {
                    **result,
                    "type": "analysis",
                    "result": result,
                    "risk_percent": risk_score,
                    "risk_level": risk_level,
                    "analysis_index": current_index,
                    "window_index": current_index,
                    "window_start_seconds": current_start,
                    "window_end_seconds": current_end,
                    "status": "completed",
                }

                score_label = (
                    f"{risk_score:.2f}%"
                    if risk_score is not None
                    else "no score"
                )
                print(
                    f"[LIVE AI] Window {current_index}: "
                    f"{score_label} ({risk_level})"
                )

                await safe_send(payload)

            except asyncio.CancelledError:
                raise

            except Exception as exc:
                print(f"[LIVE AI] ERROR: {type(exc).__name__}: {exc}")

                await safe_send({
                    "type": "analysis_error",
                    "analysis_index": current_index,
                    "window_index": current_index,
                    "error": str(exc),
                })

    # --------------------------------------------------------
    # Notify frontend
    # --------------------------------------------------------
    await safe_send({
        "type": "connected",
        "message": "Live voice analysis connected.",
        "window_seconds": window,
        "stride_seconds": stride,
        "minimum_analysis_seconds": LIVE_MIN_SECONDS,
    })

    # --------------------------------------------------------
    # Receive audio
    # --------------------------------------------------------
    window_samples = int(window * SAMPLE_RATE)
    stride_samples = int(stride * SAMPLE_RATE)
    stream_format = "pcm16"
    stream_sample_rate = SAMPLE_RATE

    try:
        while connection_open:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            audio_bytes = message.get("bytes")

            # Handle text commands
            if audio_bytes is None:
                text_message = message.get("text")

                if not text_message:
                    continue

                try:
                    command = json.loads(text_message)
                except (json.JSONDecodeError, TypeError):
                    command = {"type": text_message}

                if "format" in command or "sample_rate" in command:
                    requested_format = str(
                        command.get("format", stream_format)
                    ).lower()
                    if requested_format not in ("float32", "pcm16", "int16"):
                        await safe_send({
                            "type": "analysis_error",
                            "error": (
                                "Unsupported audio format. "
                                "Use float32 or pcm16."
                            ),
                        })
                        continue

                    try:
                        requested_sample_rate = int(
                            command.get("sample_rate", stream_sample_rate)
                        )
                    except (TypeError, ValueError):
                        await safe_send({
                            "type": "analysis_error",
                            "error": "Invalid audio sample rate.",
                        })
                        continue

                    if not 8000 <= requested_sample_rate <= 192000:
                        await safe_send({
                            "type": "analysis_error",
                            "error": "Audio sample rate must be between 8000 and 192000 Hz.",
                        })
                        continue

                    stream_format = requested_format
                    stream_sample_rate = requested_sample_rate

                command_type = command.get("type")

                if command_type in ("stop", "close", "end"):
                    await safe_send({
                        "type": "stopping",
                        "message": "Stopping live analysis.",
                    })
                    break

                if command_type == "ping":
                    await safe_send({
                        "type": "pong",
                        "timestamp": time.time(),
                    })

                continue

            # Decode binary audio
            try:
                chunk = prepare_stream_audio(
                    audio_bytes,
                    stream_format,
                    stream_sample_rate,
                )
            except Exception as exc:
                await safe_send({
                    "type": "analysis_error",
                    "error": f"Audio decode error: {exc}",
                })
                continue

            if len(chunk) == 0:
                continue

            audio_buffer = np.concatenate((audio_buffer, chunk))

            # Submit a task for every complete audio window
            while len(audio_buffer) >= window_samples:
                current = audio_buffer[:window_samples].copy()

                current_start = window_index * stride
                current_end = current_start + window
                window_index += 1

                audio_buffer = audio_buffer[stride_samples:]

                task = asyncio.create_task(
                    analyze_live_window(
                        current,
                        window_index,
                        current_start,
                        current_end,
                    )
                )

                analysis_tasks.add(task)
                task.add_done_callback(analysis_tasks.discard)

    except WebSocketDisconnect:
        print("[LIVE] Client disconnected.")

    except asyncio.CancelledError:
        raise

    except Exception as exc:
        print(f"[LIVE] WebSocket error: {type(exc).__name__}: {exc}")

    finally:
        connection_open = False

        for task in list(analysis_tasks):
            if not task.done():
                task.cancel()

        if analysis_tasks:
            await asyncio.gather(
                *analysis_tasks,
                return_exceptions=True,
            )

        try:
            await websocket.close()
        except Exception:
            pass

        print("[LIVE] Live analysis session ended.")
