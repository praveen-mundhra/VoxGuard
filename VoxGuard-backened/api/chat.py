from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import re

router = APIRouter(prefix="/api", tags=["AI Chat"])


class ChatRequest(BaseModel):
    message: str
    language: str = "en"
    system: str | None = None


class ChatResponse(BaseModel):
    reply: str
    language: str
    source: str = "voxguard"


# -----------------------------
# Local VoxGuard AI responses
# -----------------------------

def get_local_response(message: str, language: str) -> str:
    text = message.lower().strip()

    if any(word in text for word in [
        "otp", "pin", "password", "cvv", "bank details",
        "upi pin", "card number"
    ]):
        return (
            "Never share your OTP, PIN, password, CVV or banking credentials "
            "with anyone over a phone call. If a caller asks for these details, "
            "treat the call as suspicious."
        )

    if any(word in text for word in [
        "voice clone",
        "voice cloning",
        "fake voice",
        "deepfake voice"
    ]):
        return (
            "A voice clone is AI-generated speech designed to imitate a real "
            "person. VoxGuard analyzes voice characteristics, speaker identity, "
            "speech content and behavioral signals to detect suspicious calls."
        )

    if any(word in text for word in [
        "how does voxguard work",
        "how voxguard works",
        "how it works"
    ]):
        return (
            "VoxGuard combines AI and ML models for voice deepfake detection, "
            "speaker verification, speech recognition, scam detection and "
            "real-time risk assessment. These signals are combined to determine "
            "whether a call should be monitored, verified or blocked."
        )

    if any(word in text for word in [
        "safe call",
        "is this call safe",
        "suspicious call",
        "scam call"
    ]):
        return (
            "I can help assess a call, but a final safety decision should be "
            "based on VoxGuard's live analysis. Check the deepfake score, "
            "speaker verification result, scam indicators and overall risk score."
        )

    if any(word in text for word in [
        "language",
        "languages",
        "indian language"
    ]):
        return (
            "VoxGuard's assistant is designed for 30 Indian and regional "
            "languages, including Hindi, Bengali, Marathi, Telugu, Tamil, "
            "Gujarati, Kannada, Malayalam, Punjabi, Odia and Assamese."
        )

    if any(word in text for word in [
        "hello",
        "hi",
        "hey",
        "namaste"
    ]):
        return (
            "Hello! I am VoxGuard AI. I can help you understand voice-cloning "
            "attacks, scam calls, risk scores and safe-call practices."
        )

    return (
        "I am VoxGuard AI. I can help with voice-cloning detection, "
        "speaker verification, scam detection, risk analysis and safe "
        "transaction practices."
    )


# -----------------------------
# Optional LLM integration
# -----------------------------

async def generate_ai_response(
    message: str,
    language: str,
    system_prompt: str | None
) -> str:

    # If no AI provider is configured, use the local assistant.
    provider = os.getenv("CHAT_PROVIDER", "local").lower()

    if provider == "local":
        return get_local_response(message, language)

    # --------------------------------------------------
    # Add your OpenAI/Gemini/Ollama integration here.
    # --------------------------------------------------

    return get_local_response(message, language)


# -----------------------------
# POST /api/chat
# -----------------------------

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):

    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    if len(request.message) > 4000:
        raise HTTPException(
            status_code=400,
            detail="Message is too long."
        )

    try:
        reply = await generate_ai_response(
            message=request.message,
            language=request.language,
            system_prompt=request.system
        )

        return ChatResponse(
            reply=reply,
            language=request.language,
            source="voxguard"
        )

    except Exception as exc:
        print(f"Chat error: {exc}")

        # Never make the chatbot completely unavailable.
        return ChatResponse(
            reply=get_local_response(
                request.message,
                request.language
            ),
            language=request.language,
            source="fallback"
        )