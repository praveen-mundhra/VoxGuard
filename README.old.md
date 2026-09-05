# VoxGuard v3 — Real-Time Voice Identity & Scam Protection

VoxGuard v3 is a prototype security platform for detecting synthetic/voice-cloned audio and combining it with speaker verification, scam-intent analysis, caller/device context, and transaction risk.

## Architecture

Browser microphone
→ 16 kHz PCM WebSocket
→ AASIST anti-spoofing
→ ECAPA-TDNN speaker embeddings
→ Whisper speech-to-text
→ India-focused scam detector
→ caller/device/transaction context
→ weighted risk engine
→ LOW / MEDIUM / HIGH
→ intervention recommendation

## Important

This repository contains application code, but **does not redistribute the AASIST model weights**. Copy your existing `aasist.onnx` into:

`backend/model/aasist.onnx`

The ECAPA-TDNN model is loaded through SpeechBrain and may download pretrained weights on first use.

The system is a security-assistance prototype. A model score is not proof that a caller is fraudulent.

## Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health check:

`http://localhost:8000/`

Swagger:

`http://localhost:8000/docs`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

If the backend is not on localhost:8000, create `.env` from `.env.example`.

## Model

Copy your existing AASIST ONNX file from the old VoxGuard project:

`VoxGuard-backened/model/aasist.onnx`

to:

`backend/model/aasist.onnx`

## Production checklist

- Calibrate thresholds on representative validation data.
- Replace development CORS settings.
- Add authentication and authorization.
- Encrypt transport with HTTPS/WSS.
- Do not store raw voice unless necessary and consented.
- Use a proper speaker-verification threshold obtained from your own EER/validation study.
- Test telephone codecs, noise, reverberation and unseen synthesis systems.
- Add real SIP/telephony integration before claiming phone-network deployment.
- Treat banking/transaction blocking as an integration workflow, not as an actual bank API in this prototype.
