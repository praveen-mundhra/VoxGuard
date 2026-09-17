import os
import hashlib
import json
import importlib.util
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import Base, SessionLocal, User, engine

from app.db import Base as AppBase, engine as app_engine, get_db
from app.models import Scan
from app.risk_engine import analyze_risk

# IMPORTANT:
# security.py was renamed to security_core.py because app/security/
# is the authentication package used by the live WebSocket.
from app.security_core import clear_session, create_session, require_user

from app.services.chat import security_chat
from app.services.email_scanner import scan_email
from app.services.url_scanner import scan_url
from app.services.voice import (
    analyze_audio,
    validate_analysis_audio_duration,
)

# Live audio / speaker / deepfake router.
# This provides:
#   POST /api/analyze
#   POST /api/speaker/enroll
#   DELETE /api/speaker/enroll
#   WS   /api/stream
from app.api.calls import router as calls_router


# ============================================================
# AUTHENTICATION MODULE
# ============================================================

def load_authentication_module():
    module_path = (
        Path(__file__).parent
        / "app"
        / "security"
        / "authentication.py"
    )

    spec = importlib.util.spec_from_file_location(
        "voxguard_authentication",
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

create_access_token = authentication.create_access_token
get_current_user = authentication.get_current_user
hash_password = authentication.hash_password
normalize_email = authentication.normalize_email
verify_password = authentication.verify_password


# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    AppBase.metadata.create_all(bind=app_engine)
    yield


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="VoxGuard AI",
    version="4.0.0",
    description=(
        "India-focused real-time voice identity, anti-spoofing "
        "and scam-risk protection API."
    ),
    lifespan=lifespan,
)


# ============================================================
# AUTH ROUTER
# ============================================================

auth_router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)


class RegisterRequest(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=120,
    )

    email: str = Field(
        min_length=3,
        max_length=255,
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )


class LoginRequest(BaseModel):
    email: str
    password: str


class ChatRequest(BaseModel):
    message: str
    language: str = "en-IN"
    conversation_id: str | None = None


class UrlRequest(BaseModel):
    url: str


class EmailRequest(BaseModel):
    subject: str = ""
    sender: str = ""
    body: str


class RiskRequest(BaseModel):
    voice_authenticity: float = 50
    speaker_identity: float = 50
    scam_intent: float = 0
    caller_reputation: float = 50
    financial_risk: float = 0
    conversation_risk: float = 0
    quality: float = 100


def user_response(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


@auth_router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest):
    db = SessionLocal()

    try:
        email = normalize_email(payload.email)

        if "@" not in email:
            raise HTTPException(
                status_code=422,
                detail="A valid email address is required",
            )

        if db.query(User).filter(User.email == email).first():
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists",
            )

        role = (
            "admin"
            if db.query(User).count() == 0
            else "user"
        )

        user = User(
            name=payload.name.strip(),
            email=email,
            password_hash=hash_password(payload.password),
            role=role,
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "access_token": create_access_token(user),
            "token_type": "bearer",
            "user": user_response(user),
        }

    finally:
        db.close()


@auth_router.post("/login")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
):
    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(
                User.email == normalize_email(form.username)
            )
            .first()
        )

        if (
            not user
            or not user.is_active
            or not verify_password(
                form.password,
                user.password_hash,
            )
        ):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password",
                headers={
                    "WWW-Authenticate": "Bearer"
                },
            )

        return {
            "access_token": create_access_token(user),
            "token_type": "bearer",
            "user": user_response(user),
        }

    finally:
        db.close()


@auth_router.get("/me")
def auth_me(
    user: User = Depends(get_current_user),
):
    return user_response(user)


app.include_router(auth_router)


# ============================================================
# CORS
# ============================================================

origins = [
    x.strip()
    for x in os.getenv(
        "VOXGUARD_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if x.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# LIVE / AI CALLS ROUTER
# ============================================================
# IMPORTANT:
# This registers /api/stream and the real AI audio endpoints.
app.include_router(
    calls_router,
    prefix="/api",
)


# ============================================================
# BASIC ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "name": "VoxGuard",
        "version": "4.0.0",
        "status": "online",
    }


@app.get("/health")
def health():
    models = {}

    for name, module_name, attribute in (
        (
            "deepfake",
            "app.ai.deepfake_detector",
            "detector",
        ),
        (
            "speaker",
            "app.ai.speaker_verifier",
            "speaker_verifier",
        ),
        (
            "transcriber",
            "app.ai.transcriber",
            "transcriber",
        ),
    ):
        try:
            module = __import__(
                module_name,
                fromlist=[attribute],
            )

            model = getattr(
                module,
                attribute,
            )

            models[name] = {
                "loaded": model.loaded,
                "error": model.error,
            }

        except (
            ImportError,
            AttributeError,
            OSError,
        ) as exc:
            models[name] = {
                "loaded": False,
                "error": str(exc),
            }

    return {
        "status": "ok",
        "service": "voxguard-api",
        "version": "4.0.0",
        "models": models,
    }


# ============================================================
# FRONTEND CONFIGURATION
# ============================================================

@app.get(
    "/api/config",
    dependencies=[Depends(get_current_user)],
)
def config():
    return {
        "target_sample_rate": 16000,

        # IMPORTANT:
        # Live analysis uses 5-second windows.
        "analysis_minimum_seconds": 5,
        "stream_window_seconds": max(
            5,
            int(
                os.getenv(
                    "VOXGUARD_STREAM_WINDOW",
                    "5",
                )
            ),
        ),

        "stream_stride_seconds": max(
            1,
            int(
                os.getenv(
                    "VOXGUARD_STREAM_STRIDE",
                    "2",
                )
            ),
        ),

        # Authentication / speaker enrollment remains 55 seconds.
        "authentication_minimum_seconds": 55,

        "speaker_threshold": float(
            os.getenv(
                "VOXGUARD_SPEAKER_THRESHOLD",
                "0.72",
            )
        ),

        "privacy": {
            "raw_audio_persistence": False,
            "speaker_embedding_persistence": False,
            "note": (
                "Prototype keeps live audio and embeddings "
                "in memory only."
            ),
        },
    }


# ============================================================
# LEGACY SESSION API
# ============================================================

@app.post("/api/v1/auth/login")
def session_login(
    payload: LoginRequest,
):
    if "@" not in payload.email or len(payload.password) < 6:
        raise HTTPException(
            401,
            "Invalid credentials",
        )

    token = create_session(
        payload.email
    )

    return {
        "ok": True,
        "user": {
            "email": payload.email
        },
        "session": token,
    }


@app.post("/api/v1/auth/logout")
def logout():
    return clear_session()


@app.get("/api/v1/me")
def session_me(
    user=Depends(require_user),
):
    return {
        "user": user
    }


@app.post("/api/v1/chat")
def session_chat(
    payload: ChatRequest,
    user=Depends(require_user),
):
    return security_chat(
        payload.message,
        payload.language,
        payload.conversation_id,
    )


@app.post("/api/v1/risk")
def session_risk(
    payload: RiskRequest,
    user=Depends(require_user),
):
    return analyze_risk(
        payload.model_dump()
    )


@app.post("/api/v1/scan/url")
def session_url_scan(
    payload: UrlRequest,
    user=Depends(require_user),
    db: Session = Depends(get_db),
):
    result = scan_url(payload.url)

    db.add(
        Scan(
            kind="url",
            risk_score=result["score"],
            verdict=result["verdict"],
            payload_json=json.dumps(result),
        )
    )

    db.commit()

    return result


@app.post("/api/v1/scan/email")
def session_email_scan(
    payload: EmailRequest,
    user=Depends(require_user),
    db: Session = Depends(get_db),
):
    result = scan_email(
        payload.subject,
        payload.sender,
        payload.body,
    )

    db.add(
        Scan(
            kind="email",
            risk_score=result["score"],
            verdict=result["verdict"],
            payload_json=json.dumps(result),
        )
    )

    db.commit()

    return result


# ============================================================
# LEGACY UPLOAD VOICE ANALYSIS
# ============================================================
#
# NOTE:
# The main real-time AI analysis endpoint is now:
#
#     POST /api/analyze
#
# from app.api.calls.
#
# This legacy endpoint remains available as:
#
#     POST /api/v1/voice/analyze
#
# It requires only 5 seconds.
#
# Authentication / speaker enrollment is NOT handled here.
# Authentication remains 55 seconds in:
#
#     POST /api/speaker/enroll
# ============================================================

@app.post("/api/v1/voice/analyze")
async def session_voice_analyze(
    audio: UploadFile | None = File(None),
    file: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    audio = audio or file

    if audio is None:
        raise HTTPException(
            422,
            "An audio upload is required",
        )

    raw = await audio.read()

    if not raw:
        raise HTTPException(
            400,
            "Audio is empty.",
        )

    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(
            400,
            "Audio exceeds 25 MB.",
        )

    try:
        from app.ai.audio_utils import (
            decode_container_audio,
            TARGET_SR,
        )

        decoded_audio, sample_rate = (
            decode_container_audio(raw)
        )

        duration_seconds = (
            len(decoded_audio) / sample_rate
            if sample_rate
            else len(decoded_audio) / TARGET_SR
        )

        # ----------------------------------------------------
        # NORMAL AUDIO ANALYSIS = 5 SECONDS
        # ----------------------------------------------------
        validate_analysis_audio_duration(
            duration_seconds
        )

    except ValueError as exc:
        raise HTTPException(
            400,
            str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            400,
            f"Audio sample could not be decoded: {exc}",
        ) from exc

    digest = hashlib.sha256(
        raw
    ).hexdigest()

    result = analyze_audio(
        raw,
        audio.filename or "audio",
    )

    result["sha256"] = digest
    result["duration_seconds"] = round(
        duration_seconds,
        2,
    )

    db.add(
        Scan(
            kind="voice",
            risk_score=result["risk_score"],
            verdict=result["verdict"],
            payload_json=json.dumps(result),
        )
    )

    db.commit()

    return result
