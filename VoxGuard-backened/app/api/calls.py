import json
import os
import time

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

# IMPORTANT:
# Use app.ai consistently. Do not use the old top-level "ai" package.
from app.ai.audio_utils import (
    decode_container_audio,
    decode_float32,
    decode_pcm16,
    normalize,
    resample,
    TARGET_SR,
)

from app.ai.deepfake_detector import detector
from app.ai.speaker_verifier import speaker_verifier
from app.ai.scam_detector import analyze_scam
from app.ai.risk_engine import risk_engine, RiskInputs
from app.ai.transcriber import transcriber

from app.db import SessionLocal
from app.security.authentication import get_user_for_token
from app.services.voice import (
    validate_analysis_audio_duration,
    validate_authentication_voice_duration,
)

router = APIRouter(tags=["calls"])

MAX_UPLOAD_MB = 25

# Live analysis settings
LIVE_MIN_SECONDS = 5
DEFAULT_STREAM_WINDOW = 5
DEFAULT_STREAM_STRIDE = 2


class AnalyzeRequest(BaseModel):
    caller_number: str | None = Field(default=None, max_length=32)
    transaction_amount: float = Field(default=0, ge=0)
    new_beneficiary: bool = False
    user_confirmed: bool = False
    language: str | None = Field(default=None, max_length=16)
    device_risk: float = Field(default=0, ge=0, le=100)


def transaction_context_risk(
    amount: float,
    new_beneficiary: bool,
    user_confirmed: bool,
):
    score = 0

    if amount >= 10000:
        score += 20

    if amount >= 50000:
        score += 25

    if amount >= 200000:
        score += 20

    if new_beneficiary:
        score += 25

    if not user_confirmed:
        score += 15

    return min(100, score)


def caller_context_risk(number):
    if not number:
        return 35

    cleaned = number.strip()

    if cleaned.startswith("+91"):
        return 15

    return 30


def analyze_audio(
    audio,
    caller_number=None,
    transaction_amount=0,
    new_beneficiary=False,
    user_confirmed=False,
    language=None,
    device_risk=0,
    include_transcript=True,
    validate_duration=False,
):
    """
    Analyze an already-decoded 16 kHz mono audio numpy array.

    validate_duration=True:
        Used for uploaded audio analysis.

    validate_duration=False:
        Used for live streaming windows.

    IMPORTANT:
        Uploaded/live analysis requires only 5 seconds.
        Authentication/enrollment uses a separate 55-second
        validation inside /speaker/enroll.
    """

    audio = normalize(audio)

    if len(audio) < TARGET_SR * LIVE_MIN_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"At least {LIVE_MIN_SECONDS} seconds of audio is required.",
        )

    duration = len(audio) / TARGET_SR

    # IMPORTANT:
    # Normal audio analysis requires only 5 seconds.
    # The 55-second requirement is ONLY for authentication /
    # speaker enrollment and is handled separately below.
    if validate_duration:
        try:
            validate_analysis_audio_duration(duration)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )

    # -------------------------
    # AASIST deepfake detection
    # -------------------------
    try:
        deepfake = detector.predict(audio)
    except Exception as exc:
        deepfake = {
            "available": False,
            "spoof_probability": None,
            "genuine_probability": None,
            "deepfake_risk": 0,
            "error": str(exc),
        }

    # -------------------------
    # ECAPA speaker verification
    # -------------------------
    try:
        speaker = speaker_verifier.verify(audio)
    except Exception as exc:
        speaker = {
            "available": False,
            "status": "error",
            "similarity": None,
            "speaker_risk": 0,
            "error": str(exc),
        }

    # -------------------------
    # Speech-to-text
    # -------------------------
    if include_transcript:
        try:
            transcript = transcriber.transcribe(audio, language)
        except Exception as exc:
            transcript = {
                "available": False,
                "text": "",
                "language": None,
                "error": str(exc),
            }
    else:
        transcript = {
            "available": False,
            "text": "",
            "language": None,
        }

    # -------------------------
    # Scam-language detection
    # -------------------------
    try:
        scam = analyze_scam(transcript.get("text", ""))
    except Exception as exc:
        scam = {
            "scam_risk": 0,
            "action": "LOW",
            "detected_vectors": [],
            "urgency_indicators": [],
            "credential_requests": [],
            "normalized_transcript": "",
            "error": str(exc),
        }

    # -------------------------
    # Contextual risk
    # -------------------------
    tx_risk = transaction_context_risk(
        transaction_amount,
        new_beneficiary,
        user_confirmed,
    )

    caller_risk = caller_context_risk(caller_number)

    # -------------------------
    # Combined risk engine
    # -------------------------
    risk = risk_engine.calculate(
        RiskInputs(
            deepfake_risk=deepfake.get("deepfake_risk") or 0,
            speaker_risk=speaker.get("speaker_risk") or 0,
            scam_risk=scam.get("scam_risk") or 0,
            caller_risk=caller_risk,
            device_risk=device_risk,
            transaction_risk=tx_risk,
        )
    )

    return {
        "timestamp": time.time(),
        "duration_seconds": round(duration, 2),

        "deepfake": deepfake,
        "speaker": speaker,
        "transcript": transcript,
        "scam": scam,

        "context": {
            "caller_risk": caller_risk,
            "device_risk": device_risk,
            "transaction_risk": tx_risk,
        },

        "risk": risk,
    }


# ============================================================
# Uploaded audio analysis
# ============================================================

@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    caller_number: str | None = Query(default=None, max_length=32),
    transaction_amount: float = Query(default=0, ge=0),
    new_beneficiary: bool = False,
    user_confirmed: bool = False,
    language: str | None = Query(default=None, max_length=16),
    device_risk: float = Query(default=0, ge=0, le=100),
):
    data = await file.read()

    if not data:
        raise HTTPException(
            status_code=400,
            detail="Audio file is empty.",
        )

    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Audio upload exceeds {MAX_UPLOAD_MB} MB.",
        )

    try:
        audio, sr = await run_in_threadpool(
            decode_container_audio,
            data,
        )

        audio = resample(
            audio,
            sr,
            TARGET_SR,
        )

        return await run_in_threadpool(
            analyze_audio,
            audio,
            caller_number,
            transaction_amount,
            new_beneficiary,
            user_confirmed,
            language,
            device_risk,
            True,
            True,
        )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Audio analysis failed: {exc}",
        )


# ============================================================
# Speaker enrollment
# ============================================================

@router.post("/speaker/enroll")
async def enroll_speaker(
    file: UploadFile = File(...),
):
    data = await file.read()

    if not data:
        raise HTTPException(
            status_code=400,
            detail="Audio file is empty.",
        )

    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Audio upload exceeds {MAX_UPLOAD_MB} MB.",
        )

    try:
        audio, sr = await run_in_threadpool(
            decode_container_audio,
            data,
        )

        audio = resample(
            audio,
            sr,
            TARGET_SR,
        )

        # ----------------------------------------------------
        # AUTHENTICATION / SPEAKER ENROLLMENT = 55 SECONDS
        # ----------------------------------------------------
        duration = len(audio) / TARGET_SR

        try:
            validate_authentication_voice_duration(duration)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=str(exc),
            )

        # Use up to 60 seconds for the authentication baseline.
        return await run_in_threadpool(
            speaker_verifier.enroll,
            audio[: TARGET_SR * 60],
        )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Speaker enrollment failed: {exc}",
        )


@router.delete("/speaker/enroll")
def clear_speaker():
    return speaker_verifier.clear()


# ============================================================
# LIVE WEBSOCKET STREAM
# ============================================================

@router.websocket("/stream")
async def stream(websocket: WebSocket):
    """
    Live microphone analysis endpoint.

    Frontend connects to:

        ws://localhost:8000/api/stream?token=YOUR_TOKEN

    or in production:

        wss://YOUR_DOMAIN/api/stream?token=YOUR_TOKEN
    """

    token = websocket.query_params.get("token")

    # -------------------------
    # Authenticate websocket
    # -------------------------

    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
        )
        return

    db = SessionLocal()

    try:
        get_user_for_token(token, db)

    except HTTPException:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
        )
        return

    except Exception:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
        )
        return

    finally:
        db.close()

    await websocket.accept()

    # -------------------------
    # Stream configuration
    # -------------------------

    sample_rate = 48000
    encoding = "float32"
    channels = 1

    buffer = np.zeros(
        0,
        dtype=np.float32,
    )

    window_seconds = int(
        os.getenv(
            "VOXGUARD_STREAM_WINDOW",
            str(DEFAULT_STREAM_WINDOW),
        )
    )

    stride_seconds = int(
        os.getenv(
            "VOXGUARD_STREAM_STRIDE",
            str(DEFAULT_STREAM_STRIDE),
        )
    )

    # Keep settings safe
    window_seconds = max(5, min(10, window_seconds))
    stride_seconds = max(1, min(window_seconds, stride_seconds))

    caller_number = None
    transaction_amount = 0.0
    new_beneficiary = False
    user_confirmed = False
    language = None
    device_risk = 0.0

    last_transcript_at = 0.0
    processing = False

    try:
        # Tell frontend that connection/authentication succeeded
        await websocket.send_json(
            {
                "type": "connected",
                "message": "Live analysis connected.",
                "sample_rate": TARGET_SR,
                "window_seconds": window_seconds,
                "stride_seconds": stride_seconds,
            }
        )

        while True:
            message = await websocket.receive()

            # Browser disconnected
            if message.get("type") == "websocket.disconnect":
                break

            # -------------------------
            # Control JSON message
            # -------------------------

            if message.get("text") is not None:

                try:
                    control = json.loads(
                        message["text"]
                    )

                except json.JSONDecodeError:
                    continue

                try:
                    sample_rate = int(
                        control.get(
                            "sample_rate",
                            sample_rate,
                        )
                    )
                except (TypeError, ValueError):
                    sample_rate = 48000

                if sample_rate < 8000 or sample_rate > 96000:
                    sample_rate = 48000

                encoding = str(
                    control.get(
                        "format",
                        encoding,
                    )
                ).lower()

                try:
                    channels = int(
                        control.get(
                            "channels",
                            channels,
                        )
                    )
                except (TypeError, ValueError):
                    channels = 1

                channels = max(
                    1,
                    min(8, channels),
                )

                caller_number = control.get(
                    "caller_number",
                    caller_number,
                )

                try:
                    transaction_amount = max(
                        0.0,
                        float(
                            control.get(
                                "transaction_amount",
                                transaction_amount,
                            )
                        ),
                    )
                except (TypeError, ValueError):
                    transaction_amount = 0.0

                new_beneficiary = bool(
                    control.get(
                        "new_beneficiary",
                        new_beneficiary,
                    )
                )

                user_confirmed = bool(
                    control.get(
                        "user_confirmed",
                        user_confirmed,
                    )
                )

                language = control.get(
                    "language",
                    language,
                )

                try:
                    device_risk = max(
                        0.0,
                        min(
                            100.0,
                            float(
                                control.get(
                                    "device_risk",
                                    device_risk,
                                )
                            ),
                        ),
                    )
                except (TypeError, ValueError):
                    device_risk = 0.0

                continue

            # -------------------------
            # Binary audio data
            # -------------------------

            data = message.get("bytes")

            if not data:
                continue

            try:
                if encoding == "pcm16":
                    chunk = decode_pcm16(data)
                else:
                    chunk = decode_float32(data)

            except Exception as exc:
                await websocket.send_json(
                    {
                        "error": f"Audio decoding failed: {exc}",
                    }
                )
                continue

            if len(chunk) == 0:
                continue

            # -------------------------
            # Convert stereo/multichannel
            # to mono
            # -------------------------

            if channels > 1:

                usable = len(chunk) - (
                    len(chunk) % channels
                )

                if usable == 0:
                    continue

                chunk = (
                    chunk[:usable]
                    .reshape(-1, channels)
                    .mean(axis=1)
                )

            # -------------------------
            # Resample to 16 kHz
            # -------------------------

            try:
                chunk = resample(
                    chunk,
                    sample_rate,
                    TARGET_SR,
                )

            except Exception as exc:
                await websocket.send_json(
                    {
                        "error": f"Audio resampling failed: {exc}",
                    }
                )
                continue

            # Prevent unbounded buffer growth
            if len(buffer) > TARGET_SR * 30:
                buffer = buffer[-TARGET_SR * 15 :]

            buffer = np.concatenate(
                [
                    buffer,
                    chunk,
                ]
            )

            window_size = (
                TARGET_SR * window_seconds
            )

            stride_size = (
                TARGET_SR * stride_seconds
            )

            # -------------------------
            # Analyze every window
            # -------------------------

            while (
                len(buffer) >= window_size
                and not processing
            ):

                current = buffer[:window_size]

                # Slide the buffer
                buffer = buffer[stride_size:]

                # Transcription does not need to run
                # for every single window.
                include_transcript = (
                    time.time() - last_transcript_at >= 3
                )

                processing = True

                try:

                    result = await run_in_threadpool(
                        analyze_audio,
                        current,
                        caller_number,
                        transaction_amount,
                        new_beneficiary,
                        user_confirmed,
                        language,
                        device_risk,
                        include_transcript,
                        False,  # IMPORTANT: no 55-sec validation
                    )

                    if result.get(
                        "transcript",
                        {}
                    ).get("text"):

                        last_transcript_at = time.time()

                    await websocket.send_json(
                        {
                            "type": "analysis",
                            **result,
                        }
                    )

                except HTTPException as exc:

                    await websocket.send_json(
                        {
                            "error": exc.detail,
                        }
                    )

                except Exception as exc:

                    await websocket.send_json(
                        {
                            "error": f"Live analysis failed: {exc}",
                        }
                    )

                finally:
                    processing = False

    except WebSocketDisconnect:
        pass

    except Exception as exc:

        try:
            await websocket.send_json(
                {
                    "error": str(exc),
                }
            )
        except Exception:
            pass