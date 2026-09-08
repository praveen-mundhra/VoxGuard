import asyncio
import json
import time
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from ai.audio_utils import decode_container_audio, decode_float32, decode_pcm16, normalize, resample, TARGET_SR
from ai.deepfake_detector import detector
from ai.speaker_verifier import speaker_verifier
from ai.scam_detector import analyze_scam
from ai.risk_engine import risk_engine, RiskInputs
from ai.transcriber import transcriber
from app.services.voice import validate_voice_sample_duration
from database import SessionLocal
from security.authentication import get_user_for_token

router = APIRouter(tags=["calls"])
MAX_UPLOAD_MB = 25

class AnalyzeRequest(BaseModel):
    caller_number: str | None = Field(default=None, max_length=32)
    transaction_amount: float = Field(default=0, ge=0)
    new_beneficiary: bool = False
    user_confirmed: bool = False
    language: str | None = Field(default=None, max_length=16)
    device_risk: float = Field(default=0, ge=0, le=100)


def transaction_context_risk(amount, new_beneficiary, user_confirmed):
    score = 0
    if amount >= 10000: score += 20
    if amount >= 50000: score += 25
    if amount >= 200000: score += 20
    if new_beneficiary: score += 25
    if not user_confirmed: score += 15
    return min(100, score)


def caller_context_risk(number):
    if not number: return 35
    cleaned = number.strip()
    return 15 if cleaned.startswith("+91") else 30


def analyze_audio(audio, caller_number=None, transaction_amount=0, new_beneficiary=False, user_confirmed=False, language=None, device_risk=0, include_transcript=True):
    audio = normalize(audio)
    if len(audio) < TARGET_SR * 2:
        raise HTTPException(status_code=400, detail="At least 2 seconds of audio is required.")
    duration = len(audio) / TARGET_SR
    validate_voice_sample_duration(duration)
    deepfake = detector.predict(audio)
    speaker = speaker_verifier.verify(audio)
    transcript = transcriber.transcribe(audio, language) if include_transcript else {"available": False, "text": "", "language": None}
    scam = analyze_scam(transcript.get("text", ""))
    tx_risk = transaction_context_risk(transaction_amount, new_beneficiary, user_confirmed)
    caller_risk = caller_context_risk(caller_number)
    risk = risk_engine.calculate(RiskInputs(
        deepfake_risk=deepfake.get("deepfake_risk") or 0,
        speaker_risk=speaker.get("speaker_risk") or 0,
        scam_risk=scam.get("scam_risk") or 0,
        caller_risk=caller_risk,
        device_risk=device_risk,
        transaction_risk=tx_risk,
    ))
    return {
        "timestamp": time.time(), "duration_seconds": round(duration, 2),
        "deepfake": deepfake, "speaker": speaker, "transcript": transcript, "scam": scam,
        "context": {"caller_risk": caller_risk, "device_risk": device_risk, "transaction_risk": tx_risk},
        "risk": risk,
    }

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
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Audio upload exceeds {MAX_UPLOAD_MB} MB.")
    try:
        audio, sr = await run_in_threadpool(decode_container_audio, data)
        audio = resample(audio, sr)
        return await run_in_threadpool(analyze_audio, audio, caller_number, transaction_amount, new_beneficiary, user_confirmed, language, device_risk, True)
    except HTTPException: raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Audio analysis failed: {exc}")

@router.post("/speaker/enroll")
async def enroll_speaker(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Audio upload exceeds {MAX_UPLOAD_MB} MB.")
    try:
        audio, sr = await run_in_threadpool(decode_container_audio, data)
        audio = resample(audio, sr)
        if len(audio) < TARGET_SR * 10:
            raise HTTPException(status_code=400, detail="Use at least 10 seconds of clear reference speech.")
        return await run_in_threadpool(speaker_verifier.enroll, audio[:TARGET_SR * 60])
    except HTTPException: raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Speaker enrollment failed: {exc}")

@router.delete("/speaker/enroll")
def clear_speaker():
    return speaker_verifier.clear()

@router.websocket("/stream")
async def stream(websocket: WebSocket):
    token = websocket.query_params.get("token")
    db = SessionLocal()
    try:
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        get_user_for_token(token, db)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    finally:
        db.close()
    await websocket.accept()
    sample_rate, encoding, channels = 48000, "float32", 1
    buffer = np.zeros(0, dtype=np.float32)
    window_seconds = int(__import__("os").getenv("VOXGUARD_STREAM_WINDOW", "4"))
    stride_seconds = int(__import__("os").getenv("VOXGUARD_STREAM_STRIDE", "1"))
    caller_number = None
    transaction_amount = 0.0
    new_beneficiary = False
    user_confirmed = False
    language = None
    device_risk = 0.0
    last_transcript_at = 0.0
    busy = False
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            if message.get("text") is not None:
                try: control = json.loads(message["text"])
                except json.JSONDecodeError: continue
                sample_rate = int(control.get("sample_rate", sample_rate))
                if sample_rate < 8000 or sample_rate > 96000: sample_rate = 48000
                encoding = str(control.get("format", encoding)).lower()
                channels = max(1, min(8, int(control.get("channels", channels))))
                caller_number = control.get("caller_number", caller_number)
                transaction_amount = max(0.0, float(control.get("transaction_amount", transaction_amount)))
                new_beneficiary = bool(control.get("new_beneficiary", new_beneficiary))
                user_confirmed = bool(control.get("user_confirmed", user_confirmed))
                language = control.get("language", language)
                device_risk = max(0.0, min(100.0, float(control.get("device_risk", device_risk))))
                continue
            data = message.get("bytes")
            if not data: continue
            chunk = decode_pcm16(data) if encoding == "pcm16" else decode_float32(data)
            if channels > 1:
                usable = len(chunk) - (len(chunk) % channels)
                if usable == 0: continue
                chunk = chunk[:usable].reshape(-1, channels).mean(axis=1)
            chunk = resample(chunk, sample_rate, TARGET_SR)
            buffer = np.concatenate([buffer, chunk])
            window, stride = TARGET_SR * window_seconds, TARGET_SR * stride_seconds
            while len(buffer) >= window and not busy:
                current = buffer[:window]
                buffer = buffer[stride:]
                include_transcript = time.time() - last_transcript_at >= 3
                busy = True
                try:
                    result = await run_in_threadpool(analyze_audio, current, caller_number, transaction_amount, new_beneficiary, user_confirmed, language, device_risk, include_transcript)
                    if result["transcript"].get("text"): last_transcript_at = time.time()
                    await websocket.send_json(result)
                finally:
                    busy = False
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try: await websocket.send_json({"error": str(exc)})
        except Exception: pass
