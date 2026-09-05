from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel, Field
from database import Incident, SessionLocal

router = APIRouter(tags=["incidents"])

class IncidentCreate(BaseModel):
    caller_number: str | None = Field(default=None, max_length=32)
    risk_score: float = Field(default=0, ge=0, le=100)
    risk_level: str = "LOW"
    action: str = "MONITOR"
    summary: str = Field(default="", max_length=10000)
    active_debit: bool = False

@router.post("/incidents")
def create_incident(payload: IncidentCreate):
    db = SessionLocal()
    try:
        item = Incident(created_at=datetime.now(timezone.utc), caller_number=payload.caller_number, risk_score=payload.risk_score, risk_level=payload.risk_level, action=payload.action, summary=payload.summary, active_debit=payload.active_debit)
        db.add(item); db.commit(); db.refresh(item)
        return {"id": item.id, "created_at": item.created_at.isoformat(), "status": "created"}
    finally: db.close()

@router.get("/incidents")
def list_incidents():
    db = SessionLocal()
    try:
        rows = db.query(Incident).order_by(Incident.id.desc()).limit(100).all()
        return [{"id": x.id, "created_at": x.created_at.isoformat(), "caller_number": x.caller_number, "risk_score": x.risk_score, "risk_level": x.risk_level, "action": x.action, "summary": x.summary, "active_debit": x.active_debit} for x in rows]
    finally: db.close()
