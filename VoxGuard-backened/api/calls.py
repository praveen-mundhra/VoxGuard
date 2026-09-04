import json
import numpy as np

from fastapi import APIRouter, WebSocket

from ai.deepfake_detector import DeepfakeDetector
from ai.scam_detector import ScamDetector
from ai.risk_engine import RiskEngine


router = APIRouter()

deepfake_detector = DeepfakeDetector(
    "models/aasist.onnx"
)

scam_detector = ScamDetector()

risk_engine = RiskEngine()


@router.websocket("/ws/analyze")
async def analyze_call(websocket: WebSocket):

    await websocket.accept()

    audio_buffer = bytearray()

    SAMPLE_RATE = 16000

    WINDOW_SECONDS = 4

    WINDOW_BYTES = (
        SAMPLE_RATE *
        WINDOW_SECONDS *
        2
    )

    try:

        while True:

            data = await websocket.receive_bytes()

            audio_buffer.extend(data)

            if len(audio_buffer) < WINDOW_BYTES:
                continue

            chunk = bytes(
                audio_buffer[-WINDOW_BYTES:]
            )

            audio = np.frombuffer(
                chunk,
                dtype=np.int16
            ).astype(np.float32)

            audio /= 32768.0

            # -----------------------------
            # Layer 1
            # -----------------------------

            deepfake = (
                deepfake_detector.predict(audio)
            )

            # -----------------------------
            # Layer 2
            # -----------------------------

            # Placeholder until ECAPA
            speaker_risk = 20

            # -----------------------------
            # Layer 3
            # -----------------------------

            # Transcript will come from STT
            transcript = ""

            scam = scam_detector.analyze(
                transcript
            )

            # -----------------------------
            # Layer 4
            # -----------------------------

            caller_risk = 0
            device_risk = 0
            transaction_risk = 0

            # -----------------------------
            # Final risk
            # -----------------------------

            risk = risk_engine.calculate(

                deepfake_risk=
                    deepfake["deepfake_risk"],

                speaker_risk=
                    speaker_risk,

                scam_risk=
                    scam["scam_risk"],

                caller_risk=
                    caller_risk,

                device_risk=
                    device_risk,

                transaction_risk=
                    transaction_risk
            )

            result = {

                "deepfake": deepfake,

                "scam": scam,

                "risk": risk
            }

            await websocket.send_json(result)

    except Exception as e:

        await websocket.close()