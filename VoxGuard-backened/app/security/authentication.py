import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import SessionLocal, User

TOKEN_TTL_SECONDS = int(os.getenv("VOXGUARD_TOKEN_TTL", "3600"))
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def normalize_email(email: str) -> str:
	return email.strip().lower()


def hash_password(password: str) -> str:
	salt = secrets.token_bytes(16)
	digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
	return f"pbkdf2_sha256$210000${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
	try:
		algorithm, rounds, salt_hex, digest_hex = encoded.split("$")
		if algorithm != "pbkdf2_sha256":
			return False
		digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds))
		return hmac.compare_digest(digest.hex(), digest_hex)
	except (ValueError, TypeError):
		return False


def _key() -> bytes:
	return os.getenv("VOXGUARD_SECRET_KEY", "development-only-change-me").encode()


def create_access_token(user: User) -> str:
	header = {"alg": "HS256", "typ": "VoxGuard"}
	payload = {"sub": str(user.id), "role": user.role, "exp": int(time.time()) + TOKEN_TTL_SECONDS}

	def encode(value):
		return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=").decode()

	message = f"{encode(header)}.{encode(payload)}".encode()
	signature = hmac.new(_key(), message, hashlib.sha256).digest()
	return f"{message.decode()}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def _decode_token(token: str) -> dict:
	try:
		encoded_header, encoded_payload, encoded_signature = token.split(".")
		message = f"{encoded_header}.{encoded_payload}".encode()
		expected = hmac.new(_key(), message, hashlib.sha256).digest()
		supplied = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
		if not hmac.compare_digest(expected, supplied):
			raise ValueError
		payload = json.loads(base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4)))
		if int(payload.get("exp", 0)) <= int(time.time()):
			raise ValueError
		return payload
	except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
	return get_user_for_token(token, db)


def get_user_for_token(token: str, db: Session) -> User:
	payload = _decode_token(token)
	try:
		user_id = int(payload["sub"])
	except (KeyError, TypeError, ValueError):
		raise HTTPException(status_code=401, detail="Invalid token", headers={"WWW-Authenticate": "Bearer"})
	user = db.get(User, user_id)
	if not user or not user.is_active:
		raise HTTPException(status_code=401, detail="User is inactive or does not exist", headers={"WWW-Authenticate": "Bearer"})
	return user
