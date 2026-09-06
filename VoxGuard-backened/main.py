import os
from contextlib import asynccontextmanager
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from database import Base, SessionLocal, User, engine
from security.authentication import create_access_token, get_current_user, hash_password, normalize_email, verify_password
from api.calls import router as calls_router
from api.transactions import router as transactions_router
from api.incidents import router as incidents_router
from api.registry import router as registry_router
from api.chat import router as chat_router
from integrations.telephony.twilio_adapter import router as twilio_router

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

auth_router = APIRouter(prefix="/auth", tags=["authentication"])

class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)

def user_response(user: User):
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}

@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    db = SessionLocal()
    try:
        email = normalize_email(payload.email)
        if "@" not in email:
            raise HTTPException(status_code=422, detail="A valid email address is required")
        if db.query(User).filter(User.email == email).first():
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        role = "admin" if db.query(User).count() == 0 else "user"
        user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password), role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"access_token": create_access_token(user), "token_type": "bearer", "user": user_response(user)}
    finally:
        db.close()

@auth_router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == normalize_email(form.username)).first()
        if not user or not user.is_active or not verify_password(form.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Incorrect email or password", headers={"WWW-Authenticate": "Bearer"})
        return {"access_token": create_access_token(user), "token_type": "bearer", "user": user_response(user)}
    finally:
        db.close()

@auth_router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_response(user)

app.include_router(auth_router)

app.include_router(chat_router, dependencies=[Depends(get_current_user)])

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

app.include_router(calls_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(transactions_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(incidents_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(registry_router, prefix="/api", dependencies=[Depends(get_current_user)])
app.include_router(twilio_router)

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

@app.get("/api/config", dependencies=[Depends(get_current_user)])
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
