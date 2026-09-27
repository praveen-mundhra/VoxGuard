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
    from app.services.audio import (
        decode_audio_bytes,
        resample_audio,
    )
except ImportError:
    try:
        from app.services.audio_utils import (
            decode_audio_bytes,
            resample_audio,
        )
    except ImportError:
        decode_audio_bytes = None
        resample_audio = None


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
        from app.services.detector import detector
    except ImportError:
        detector = None


try:
    from app.services.speaker_verifier import speaker_verifier
except ImportError:
    speaker_verifier = None


try:
    from app.services.transcriber import transcriber
except ImportError:
    transcriber = None


try:
    from app.services.scam_detector import analyze_scam
except ImportError:
    try:
        from app.services.scam import analyze_scam
    except ImportError:

        def analyze_scam(transcript):
            return {
                "scam_risk": 0.0,
                "risk_level": "LOW",
                "matched_keywords": [],
            }


try:
    from app.services.risk_engine import (
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
        from app.database import SessionLocal
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
    Convert risk score into LOW / MEDIUM / HIGH.
    """

    score = clamp_score(score)

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


def prepare_stream_audio(data):
    """
    Decode a WebSocket audio packet.

    Supports raw PCM-like numpy data through the project
    audio utility where available.
    """

    if not data:
        return np.array([], dtype=np.float32)

    # First try project decoder.
    if decode_audio_bytes is not None:
        try:
            audio = decode_audio_bytes(data)
            audio = normalize_audio(audio)
            return audio
        except Exception:
            pass

    # Fallback: interpret bytes as int16 PCM.
    try:
        pcm = np.frombuffer(data, dtype=np.int16)

        if len(pcm) == 0:
            return np.array([], dtype=np.float32)

        audio = pcm.astype(np.float32) / 32768.0

        return normalize_audio(audio)

    except Exception as exc:
        raise ValueError(
            f"Unable to decode incoming audio: {exc}"
        )


# ============================================================
# DEEPFAKE ANALYSIS
# ============================================================

def run_deepfake_detection(audio):
    """
    Run AASIST/deepfake detector.
    """

    if detector is None:
        return {
            "deepfake_risk": 0.0,
            "spoof_probability": 0.0,
            "genuine_probability": 1.0,
            "label": "UNKNOWN",
        }

    result = detector.predict(audio)

    if result is None:
        return {
            "deepfake_risk": 0.0,
            "spoof_probability": 0.0,
            "genuine_probability": 1.0,
            "label": "UNKNOWN",
        }

    if isinstance(result, dict):
        output = dict(result)
    else:
        output = {
            "score": safe_float(result),
        }

    # Normalize common score names.
    if "spoof_probability" in output:
        spoof = clamp_score(
            safe_float(output["spoof_probability"]) * 100
            if safe_float(output["spoof_probability"]) <= 1
            else safe_float(output["spoof_probability"])
        )

    elif "deepfake_risk" in output:
        spoof = clamp_score(output["deepfake_risk"])

    elif "score" in output:
        raw = safe_float(output["score"])

        spoof = clamp_score(
            raw * 100 if raw <= 1 else raw
        )

    else:
        spoof = 0.0

    genuine = clamp_score(100.0 - spoof)

    output["spoof_probability"] = spoof / 100.0
    output["genuine_probability"] = genuine / 100.0
    output["deepfake_risk"] = spoof

    if spoof >= 70:
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
            "similarity": 0.0,
            "speaker_risk": 0.0,
            "verified": False,
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
            "similarity": 0.0,
            "speaker_risk": 0.0,
            "verified": False,
        }

    if isinstance(result, dict):
        output = dict(result)
    else:
        output = {
            "similarity": safe_float(result),
        }

    similarity = safe_float(
        output.get(
            "similarity",
            output.get("score", 0.0),
        )
    )

    if similarity <= 1:
        similarity *= 100

    similarity = clamp_score(similarity)

    speaker_risk = clamp_score(100.0 - similarity)

    output["similarity"] = similarity / 100.0
    output["speaker_risk"] = speaker_risk
    output["verified"] = similarity >= 70

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

    scam = safe_float(
        output.get(
            "scam_risk",
            output.get("risk", 0.0),
        )
    )

    if scam <= 1:
        scam *= 100

    scam = clamp_score(scam)

    output["scam_risk"] = scam

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
    Combine the AI signals into a single impersonation risk.
    """

    deepfake_risk = clamp_score(
        deepfake.get(
            "deepfake_risk",
            safe_float(
                deepfake.get("spoof_probability", 0)
            ) * 100,
        )
    )

    speaker_risk = clamp_score(
        speaker.get(
            "speaker_risk",
            100
            - (
                safe_float(
                    speaker.get("similarity", 0)
                ) * 100
            ),
        )
    )

    scam_risk = clamp_score(
        scam.get("scam_risk", 0)
    )

    # If the project's dedicated risk engine exists,
    # use it first.
    if risk_engine is not None and RiskInputs is not None:

        try:
            inputs = RiskInputs(
                deepfake_risk=deepfake_risk,
                speaker_risk=speaker_risk,
                scam_risk=scam_risk,
            )

            result = risk_engine(inputs)

            if isinstance(result, dict):
                output = dict(result)

                score = clamp_score(
                    output.get(
                        "risk_score",
                        output.get("score", 0),
                    )
                )

                output["risk_score"] = score
                output["risk_level"] = risk_level_from_score(
                    score
                )

                return output

        except Exception as exc:
            print(
                f"[RISK ENGINE] Falling back to local calculation: {exc}"
            )

    # Safe fallback weighted calculation.
    #
    # Deepfake and speaker verification are given more
    # weight because this is an impersonation detector.
    score = (
        deepfake_risk * 0.50
        + speaker_risk * 0.30
        + scam_risk * 0.20
    )

    score = clamp_score(score)

    level = risk_level_from_score(score)

    action = {
        "HIGH": "STOP_AND_VERIFY",
        "MEDIUM": "VERIFY",
        "LOW": "MONITOR",
    }[level]

    return {
        "risk_score": score,
        "risk_level": level,
        "action": action,
        "deepfake_risk": deepfake_risk,
        "speaker_risk": speaker_risk,
        "scam_risk": scam_risk,
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

    spoof = clamp_score(
        safe_float(
            deepfake.get(
                "spoof_probability",
                0,
            )
        ) * 100
    )

    genuine = clamp_score(
        safe_float(
            deepfake.get(
                "genuine_probability",
                1,
            )
        ) * 100
    )

    similarity = clamp_score(
        safe_float(
            speaker.get(
                "similarity",
                0,
            )
        ) * 100
    )

    speaker_risk = clamp_score(
        speaker.get(
            "speaker_risk",
            100 - similarity,
        )
    )

    scam_risk = clamp_score(
        scam.get(
            "scam_risk",
            0,
        )
    )

    return {
        "acoustic": genuine,
        "spectral": clamp_score(100 - spoof),
        "prosody": clamp_score(
            deepfake.get(
                "prosody_consistency",
                genuine,
            )
        ),
        "speaker": similarity
        if similarity > 0
        else clamp_score(100 - speaker_risk),
        "scam": clamp_score(100 - scam_risk),
    }


# ============================================================
# COMPLETE AUDIO ANALYSIS
# ============================================================

def analyze_audio(
    audio,
    duration_seconds=None,
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

    print(
        "[LIVE AI] Starting AASIST + ECAPA + Whisper + "
        "Scam + Risk Engine"
    )

    deepfake = run_deepfake_detection(audio)

    # --------------------------------------------------------
    # ECAPA-TDNN
    # --------------------------------------------------------

    speaker = run_speaker_verification(audio)

    # --------------------------------------------------------
    # Faster-Whisper
    # --------------------------------------------------------

    transcript = run_transcription(audio)

    # --------------------------------------------------------
    # Scam detection
    # --------------------------------------------------------

    scam = run_scam_analysis(
        transcript
    )

    # --------------------------------------------------------
    # Risk Engine
    # --------------------------------------------------------

    risk = calculate_risk(
        deepfake,
        speaker,
        scam,
    )

    risk_score = clamp_score(
        risk.get(
            "risk_score",
            0,
        )
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

    recommendations = recommendations_for_risk(
        risk_score
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
    Authenticate a WebSocket connection.

    Token can be supplied as:

        /api/stream?token=<JWT>

    or:

        Authorization: Bearer <JWT>

    Supports both synchronous and asynchronous
    get_user_for_token implementations.
    """

    token = websocket.query_params.get("token")

    if not token:
        authorization = websocket.headers.get(
            "authorization"
        )

        if authorization:
            authorization = authorization.strip()

            if authorization.lower().startswith("bearer "):
                token = authorization[7:].strip()

    if not token:
        print(
            "[AUTH] WebSocket rejected: "
            "no access token supplied."
        )
        return None

    try:
        # ----------------------------------------------------
        # Remove accidental surrounding quotes.
        # ----------------------------------------------------

        token = token.strip().strip('"').strip("'")

        # ----------------------------------------------------
        # Authenticate.
        #
        # get_user_for_token may be sync or async depending
        # on your authentication.py implementation.
        # ----------------------------------------------------

        result = get_user_for_token(token)

        if asyncio.iscoroutine(result):
            result = await result

        # ----------------------------------------------------
        # Authentication failed.
        # ----------------------------------------------------

        if result is None:
            print(
                "[AUTH] WebSocket rejected: "
                "invalid or expired token."
            )
            return None

        print(
            "[AUTH] WebSocket authenticated successfully."
        )

        return result

    except Exception as exc:

        print(
            f"[AUTH] WebSocket authentication error: {exc}"
        )

        return None

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

@router.websocket("/stream")
async def live_audio_stream(
    websocket: WebSocket,
    window: int = Query(
        DEFAULT_STREAM_WINDOW,
        ge=5,
        le=30,
    ),
    stride: int = Query(
        DEFAULT_STREAM_STRIDE,
        ge=5,
        le=30,
    ),
):

    # ========================================================
    # ACCEPT CONNECTION FIRST
    # ========================================================

    await websocket.accept()

    print(
        "[LIVE] WebSocket connection accepted."
    )

    # ========================================================
    # AUTHENTICATE
    # ========================================================

    user = await authenticate_websocket(
        websocket
    )

    if user is None:

        try:
            await websocket.send_json(
                {
                    "type": "analysis_error",
                    "error": (
                        "Authentication failed. "
                        "Please log in again."
                    ),
                    "code": "AUTHENTICATION_FAILED",
                }
            )

            await websocket.close(
                code=1008
            )

        except Exception:
            pass

        return

    print(
        "[LIVE] User authenticated. "
        "Starting live analysis."
    )

    # --------------------------------------------------------
    # State
    # --------------------------------------------------------

    audio_buffer = np.array(
        [],
        dtype=np.float32,
    )

    total_audio_seconds = 0.0

    window_index = 0

    analysis_tasks = set()

    send_lock = asyncio.Lock()

    connection_open = True

    semaphore = asyncio.Semaphore(
        MAX_CONCURRENT_LIVE_ANALYSES
    )

    # --------------------------------------------------------
    # Safe WebSocket sender
    # --------------------------------------------------------

    async def safe_send(payload):
        """
        Send JSON only while connection is still open.

        Prevents:

            Cannot call "send" once a close message
            has been sent
        """

        nonlocal connection_open

        if not connection_open:
            return False

        try:
            async with send_lock:

                if not connection_open:
                    return False

                await websocket.send_json(
                    payload
                )

                return True

        except (
            WebSocketDisconnect,
            RuntimeError,
            ConnectionError,
        ):
            connection_open = False
            return False

        except Exception as exc:
            print(
                f"[LIVE SEND] ERROR: {exc}"
            )

            connection_open = False
            return False

    # --------------------------------------------------------
    # Live AI worker
    # --------------------------------------------------------

    async def analyze_live_window(
        audio_window,
        current_index,
        current_start,
        current_end,
    ):
        """
        Analyze one 5-second window.

        This function runs independently from the
        WebSocket receiving loop.
        """

        async with semaphore:

            started = time.perf_counter()

            print(
                f"[LIVE AI] Analyzing window "
                f"#{current_index}"
            )

            print(
                f"[LIVE AI] "
                f"{current_start:.0f}s → "
                f"{current_end:.0f}s"
            )

            # ------------------------------------------------
            # Inform frontend that this window is being
            # analyzed.
            # ------------------------------------------------

            await safe_send(
                {
                    "type": "analysis_started",
                    "analysis_index": current_index,
                    "window_index": current_index,
                    "window_start_seconds": (
                        current_start
                    ),
                    "window_end_seconds": (
                        current_end
                    ),
                    "window_seconds": (
                        current_end - current_start
                    ),
                    "status": "analyzing",
                }
            )

            try:

                # --------------------------------------------
                # Run heavy AI outside event loop.
                # --------------------------------------------

                result = await run_in_threadpool(
                    analyze_audio,
                    audio_window,
                    current_end - current_start,
                )

                # --------------------------------------------
                # Normalize risk score.
                # --------------------------------------------

                risk = result.get(
                    "risk",
                    {},
                )

                risk_score = clamp_score(
                    risk.get(
                        "risk_score",
                        result.get(
                            "risk_percent",
                            0,
                        ),
                    )
                )

                risk_level = risk_level_from_score(
                    risk_score
                )

                # --------------------------------------------
                # Force explicit risk values.
                #
                # This is important because the frontend
                # directly reads risk_percent.
                # --------------------------------------------

                if not isinstance(
                    result.get("risk"),
                    dict,
                ):
                    result["risk"] = {}

                result["risk"]["risk_score"] = (
                    risk_score
                )

                result["risk"]["risk_level"] = (
                    risk_level
                )

                result["risk_percent"] = (
                    risk_score
                )

                result["risk_level"] = (
                    risk_level
                )

                # --------------------------------------------
                # Recommendations
                # --------------------------------------------

                recommendations = result.get(
                    "recommended_actions"
                )

                if not recommendations:
                    recommendations = (
                        recommendations_for_risk(
                            risk_score
                        )
                    )

                    result[
                        "recommended_actions"
                    ] = recommendations

                # --------------------------------------------
                # Live status
                # --------------------------------------------

                if not isinstance(
                    result.get("live_status"),
                    dict,
                ):
                    result["live_status"] = {}

                result["live_status"][
                    "risk_score"
                ] = risk_score

                result["live_status"][
                    "risk_percent"
                ] = risk_score

                result["live_status"][
                    "risk_level"
                ] = risk_level

                result["live_status"][
                    "recommendations"
                ] = recommendations

                # --------------------------------------------
                # Processing time
                # --------------------------------------------

                processing_time = round(
                    time.perf_counter()
                    - started,
                    2,
                )

                result.setdefault(
                    "telemetry",
                    {},
                )

                result["telemetry"][
                    "live_processing_time_seconds"
                ] = processing_time

                # --------------------------------------------
                # IMPORTANT PAYLOAD
                #
                # Frontend gets risk_percent directly.
                # --------------------------------------------

                payload = {
                    # Keep original analysis fields.
                    **result,

                    # Explicit message type.
                    "type": "analysis",

                    # Also provide result object for
                    # frontends expecting data.result.
                    "result": result,

                    # Direct risk percentage.
                    "risk_percent": risk_score,

                    # Direct level.
                    "risk_level": risk_level,

                    # Window information.
                    "analysis_index": current_index,
                    "window_index": current_index,

                    "window_start_seconds": (
                        current_start
                    ),

                    "window_end_seconds": (
                        current_end
                    ),

                    # Processing information.
                    "processing_time_seconds": (
                        processing_time
                    ),

                    # Status.
                    "status": "completed",
                }

                # --------------------------------------------
                # Terminal logging.
                # --------------------------------------------

                print(
                    f"[LIVE AI] Risk: "
                    f"{risk_score:.2f}% "
                    f"({risk_level})"
                )

                print(
                    f"[LIVE AI] Processing time: "
                    f"{processing_time:.2f}s"
                )

                # --------------------------------------------
                # Send result.
                # --------------------------------------------

                sent = await safe_send(
                    payload
                )

                if sent:
                    print(
                        "[LIVE AI] "
                        "Analysis sent to frontend"
                    )

                else:
                    print(
                        "[LIVE AI] "
                        "Frontend disconnected before "
                        "result could be sent."
                    )

            except asyncio.CancelledError:
                print(
                    f"[LIVE AI] Window "
                    f"#{current_index} cancelled."
                )

                raise

            except Exception as exc:

                print(
                    f"[LIVE AI] ERROR: {exc}"
                )

                await safe_send(
                    {
                        "type": "analysis_error",
                        "analysis_index": current_index,
                        "window_index": current_index,
                        "window_start_seconds": (
                            current_start
                        ),
                        "window_end_seconds": (
                            current_end
                        ),
                        "error": str(exc),
                    }
                )

    # --------------------------------------------------------
    # Initial connection message
    # --------------------------------------------------------

    await safe_send(
        {
            "type": "connected",
            "message": (
                "Live voice analysis connected."
            ),
            "window_seconds": window,
            "stride_seconds": stride,
            "minimum_analysis_seconds": (
                LIVE_MIN_SECONDS
            ),
        }
    )

    # --------------------------------------------------------
    # Receive loop
    # --------------------------------------------------------

    try:

        while connection_open:

            try:

                message = (
                    await websocket.receive()
                )

            except WebSocketDisconnect:
                print(
                    "[LIVE] "
                    "WebSocket disconnected by client."
                )

                connection_open = False
                break

            except RuntimeError as exc:

                print(
                    f"[LIVE] WebSocket receive error: "
                    f"{exc}"
                )

                connection_open = False
                break

            # ------------------------------------------------
            # Client disconnected
            # ------------------------------------------------

            if message.get(
                "type"
            ) == "websocket.disconnect":

                print(
                    "[LIVE] "
                    "WebSocket disconnect message received."
                )

                connection_open = False
                break

            # ------------------------------------------------
            # Binary audio
            # ------------------------------------------------

            audio_bytes = message.get(
                "bytes"
            )

            if audio_bytes is None:

                # --------------------------------------------
                # Text commands
                # --------------------------------------------

                text = message.get(
                    "text"
                )

                if text:

                    try:
                        command = json.loads(
                            text
                        )

                    except Exception:
                        command = {
                            "type": text
                        }

                    command_type = command.get(
                        "type"
                    )

                    if command_type in (
                        "stop",
                        "close",
                        "end",
                    ):

                        print(
                            "[LIVE] "
                            "Stop command received."
                        )

                        await safe_send(
                            {
                                "type": "stopping",
                                "message": (
                                    "Stopping live analysis."
                                ),
                            }
                        )

                        connection_open = False

                        break

                    if command_type == "ping":

                        await safe_send(
                            {
                                "type": "pong",
                                "timestamp": time.time(),
                            }
                        )

                continue

            # ------------------------------------------------
            # Decode incoming audio
            # ------------------------------------------------

            try:

                chunk = prepare_stream_audio(
                    audio_bytes
                )

            except Exception as exc:

                print(
                    f"[LIVE] "
                    f"Audio decode error: {exc}"
                )

                await safe_send(
                    {
                        "type": "analysis_error",
                        "error": (
                            f"Audio decode error: {exc}"
                        ),
                    }
                )

                continue

            if len(chunk) == 0:
                continue

            # ------------------------------------------------
            # Append to buffer
            # ------------------------------------------------

            audio_buffer = np.concatenate(
                (
                    audio_buffer,
                    chunk,
                )
            )

            # ------------------------------------------------
            # Update duration
            # ------------------------------------------------

            total_audio_seconds = (
                len(audio_buffer)
                / SAMPLE_RATE
            )

            # ------------------------------------------------
            # Create windows every 5 seconds.
            #
            # Example:
            #
            # 0 → 5
            # 5 → 10
            # 10 → 15
            # 15 → 20
            #
            # Each window is submitted to a background
            # analysis task.
            # ------------------------------------------------

            window_samples = int(
                window * SAMPLE_RATE
            )

            stride_samples = int(
                stride * SAMPLE_RATE
            )

            while len(audio_buffer) >= window_samples:

                # --------------------------------------------
                # Take exactly one window.
                # --------------------------------------------

                current = (
                    audio_buffer[
                        :window_samples
                    ].copy()
                )

                # --------------------------------------------
                # Window timestamps.
                # --------------------------------------------

                current_start = (
                    window_index * stride
                )

                current_end = (
                    current_start + window
                )

                window_index += 1

                # --------------------------------------------
                # Remove exactly one stride.
                #
                # With window=5 and stride=5 this gives:
                #
                # 0-5
                # 5-10
                # 10-15
                # ...
                # --------------------------------------------

                audio_buffer = (
                    audio_buffer[
                        stride_samples:
                    ]
                )

                # --------------------------------------------
                # Start background AI task.
                #
                # DO NOT await it here.
                # --------------------------------------------

                task = asyncio.create_task(
                    analyze_live_window(
                        current,
                        window_index,
                        current_start,
                        current_end,
                    )
                )

                analysis_tasks.add(
                    task
                )

                # Remove finished task from set.
                task.add_done_callback(
                    analysis_tasks.discard
                )

    except WebSocketDisconnect:

        print(
            "[LIVE] "
            "WebSocket disconnected."
        )

        connection_open = False

    except asyncio.CancelledError:

        print(
            "[LIVE] "
            "Live analysis task cancelled."
        )

        connection_open = False

    except Exception as exc:

        print(
            f"[LIVE] WebSocket error: {exc}"
        )

        connection_open = False

    finally:

        # ----------------------------------------------------
        # Mark connection closed BEFORE cancelling tasks.
        #
        # This prevents background workers from attempting
        # to send to a closed WebSocket.
        # ----------------------------------------------------

        connection_open = False

        # ----------------------------------------------------
        # Cancel unfinished analysis tasks.
        # ----------------------------------------------------

        if analysis_tasks:

            print(
                f"[LIVE] Cancelling "
                f"{len(analysis_tasks)} "
                f"unfinished analysis task(s)."
            )

            for task in list(
                analysis_tasks
            ):
                if not task.done():
                    task.cancel()

            await asyncio.gather(
                *analysis_tasks,
                return_exceptions=True,
            )

        # ----------------------------------------------------
        # Close socket only if required.
        # ----------------------------------------------------

        try:

            if websocket.client_state.name != (
                "DISCONNECTED"
            ):
                await websocket.close()

        except Exception:
            pass

        print(
            "[LIVE] "
            "Live analysis session ended."
        )