import base64
import hashlib
import hmac
import html
import json
import os
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool
from starlette.responses import Response


router = APIRouter(prefix="/telephony/twilio", tags=["telephony"])


def decode_mulaw(payload: bytes) -> np.ndarray:
    """Decode G.711 mu-law bytes into normalized float32 PCM samples."""
    encoded = np.frombuffer(payload, dtype=np.uint8)
    value = np.bitwise_xor(encoded, 0xFF).astype(np.int16)
    sign = value & 0x80
    exponent = (value >> 4) & 0x07
    mantissa = value & 0x0F
    pcm = ((mantissa << 3) + 132) << exponent
    pcm = np.where(sign != 0, -pcm, pcm)
    return (pcm / 32768.0).astype(np.float32)


def validate_twilio_signature(url: str, params: dict[str, str], signature: str | None, auth_token: str) -> bool:
    if not signature or not auth_token:
        return False
    value = url + "".join(key + params[key] for key in sorted(params))
    expected = base64.b64encode(hmac.new(auth_token.encode(), value.encode(), hashlib.sha1).digest()).decode()
    return hmac.compare_digest(expected, signature)


async def _form_values(request: Request) -> dict[str, str]:
    form = await request.form()
    return {str(key): str(value) for key, value in form.items()}


@router.post("/voice")
async def incoming_call(request: Request):
    params = await _form_values(request)
    auth_token = os.getenv("VOXGUARD_TWILIO_AUTH_TOKEN", "")
    if auth_token and not validate_twilio_signature(
        str(request.url), params, request.headers.get("X-Twilio-Signature"), auth_token
    ):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")

    stream_base_url = os.getenv("VOXGUARD_TWILIO_STREAM_URL", "")
    forward_to = os.getenv("VOXGUARD_TWILIO_FORWARD_TO", "")
    stream_token = os.getenv("VOXGUARD_TWILIO_STREAM_TOKEN", "")
    if not stream_base_url.startswith("wss://"):
        raise HTTPException(status_code=503, detail="VOXGUARD_TWILIO_STREAM_URL must be a public wss:// URL")

    stream_url = stream_base_url.rstrip("/") + "/media"
    if stream_token:
        stream_url += "?token=" + html.escape(stream_token, quote=True)
    caller = html.escape(params.get("From", ""), quote=True)
    stream_url = html.escape(stream_url, quote=True)

    if forward_to:
        next_action = f'<Dial>{html.escape(forward_to)}</Dial>'
    else:
        next_action = "<Say>VoxGuard is monitoring this call. No destination is configured.</Say><Hangup/>"
    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Response><Start><Stream url="'
        + stream_url
        + '" track="inbound_track"><Parameter name="caller_number" value="'
        + caller
        + '"/></Stream></Start>'
        + next_action
        + "</Response>"
    )
    return Response(content=twiml, media_type="application/xml")


@router.websocket("/media")
async def media_stream(websocket: WebSocket):
    expected_token = os.getenv("VOXGUARD_TWILIO_STREAM_TOKEN", "")
    if expected_token and not hmac.compare_digest(websocket.query_params.get("token", ""), expected_token):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    source_sample_rate = 8000
    analysis_sample_rate = 16000
    window = 4 * analysis_sample_rate
    stride = analysis_sample_rate
    buffer = np.zeros(0, dtype=np.float32)
    caller_number = None
    try:
        while True:
            message = await websocket.receive_text()
            event: dict[str, Any] = json.loads(message)
            if event.get("event") == "start":
                custom = event.get("start", {}).get("customParameters", {})
                caller_number = custom.get("caller_number") or None
                continue
            if event.get("event") == "stop":
                break
            if event.get("event") != "media":
                continue
            media = event.get("media", {})
            if media.get("track") not in (None, "inbound"):  # This endpoint analyzes the caller leg.
                continue
            payload = base64.b64decode(media.get("payload", ""), validate=True)
            from ai.audio_utils import TARGET_SR, resample

            buffer = np.concatenate((buffer, resample(decode_mulaw(payload), source_sample_rate, TARGET_SR)))
            while len(buffer) >= window:
                current = buffer[:window]
                buffer = buffer[stride:]
                from api.calls import analyze_audio

                result = await run_in_threadpool(analyze_audio, current, caller_number, 0, False, False, None, 0, True)
                await websocket.send_json({"event": "analysis", "result": result})
    except WebSocketDisconnect:
        pass
    except (ValueError, json.JSONDecodeError) as exc:
        await websocket.send_json({"event": "error", "detail": str(exc)})