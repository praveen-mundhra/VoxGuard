import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from api.calls import router as calls_router
from api.transactions import router as transactions_router
from api.incidents import router as incidents_router
from api.registry import router as registry_router
from api.chat import router as chat_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    yield

app = FastAPI(
    title="VoxGuard AI",
    version="4.0.0",
    description="India-focused real-time voice identity, anti-spoofing and scam-risk protection API.",
    lifespan=lifespan,
)

app.include_router(chat_router)

origins = [x.strip() for x in os.getenv(
    "VOXGUARD_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if x.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(calls_router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(incidents_router, prefix="/api")
app.include_router(registry_router, prefix="/api")

@app.get("/")
def root():
    return {"name": "VoxGuard", "version": "4.0.0", "status": "online"}

@app.get("/health")
def health():
    from ai.deepfake_detector import detector
    from ai.speaker_verifier import speaker_verifier
    from ai.transcriber import transcriber
    return {
        "status": "ok",
        "version": "4.0.0",
        "models": {
            "deepfake": {"loaded": detector.loaded, "error": detector.error},
            "speaker": {"loaded": speaker_verifier.loaded, "error": speaker_verifier.error},
            "transcriber": {"loaded": transcriber.loaded, "error": transcriber.error},
        },
    }

@app.get("/api/config")
def config():
    return {
        "target_sample_rate": 16000,
        "stream_window_seconds": int(os.getenv("VOXGUARD_STREAM_WINDOW", "4")),
        "stream_stride_seconds": int(os.getenv("VOXGUARD_STREAM_STRIDE", "1")),
        "speaker_threshold": float(os.getenv("VOXGUARD_SPEAKER_THRESHOLD", "0.72")),
        "privacy": {
            "raw_audio_persistence": False,
            "speaker_embedding_persistence": False,
            "note": "Prototype keeps live audio and embeddings in memory only."
        }
    }
