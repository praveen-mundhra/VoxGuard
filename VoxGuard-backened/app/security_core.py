from fastapi import Request, HTTPException
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import os

SECRET = os.getenv("SESSION_SECRET", "CHANGE-ME-IN-PRODUCTION")
serializer = URLSafeTimedSerializer(SECRET)
COOKIE = "voxguard_session"

def create_session(email: str):
    token = serializer.dumps({"email": email})
    # API clients can use the returned token; browsers should exchange this
    # through a server endpoint that sets an HttpOnly Secure SameSite cookie.
    return token

def require_user(request: Request):
    token = request.cookies.get(COOKIE) or request.headers.get("X-VoxGuard-Session")
    if not token:
        # Development mode allows a demo session only when explicitly enabled.
        if os.getenv("ALLOW_DEMO_AUTH", "false").lower() == "true":
            return {"email": "demo@voxguard.local", "demo": True}
        raise HTTPException(401, "Authentication required")
    try:
        return serializer.loads(token, max_age=60 * 60 * 8)
    except (BadSignature, SignatureExpired):
        raise HTTPException(401, "Session expired")

def clear_session():
    from fastapi.responses import JSONResponse
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE)
    return response
