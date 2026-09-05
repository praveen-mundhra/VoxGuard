from fastapi import APIRouter
from pydantic import BaseModel, Field
from ai.risk_engine import risk_engine, RiskInputs

router = APIRouter(tags=["transactions"])

class Transaction(BaseModel):
    amount: float = Field(default=0, ge=0)
    beneficiary: str = ""
    new_beneficiary: bool = False
    user_confirmed: bool = False
    transaction_type: str = "transfer"
    caller_risk: float = Field(default=0, ge=0, le=100)
    speaker_risk: float = Field(default=0, ge=0, le=100)
    deepfake_risk: float = Field(default=0, ge=0, le=100)
    scam_risk: float = Field(default=0, ge=0, le=100)
    device_risk: float = Field(default=0, ge=0, le=100)

def tx_risk(amount, new_beneficiary, user_confirmed):
    score = 0
    if amount >= 10000: score += 20
    if amount >= 50000: score += 25
    if amount >= 200000: score += 20
    if new_beneficiary: score += 25
    if not user_confirmed: score += 15
    return min(100, score)

@router.post("/transactions/evaluate")
def evaluate_transaction(tx: Transaction):
    transaction_risk = tx_risk(tx.amount, tx.new_beneficiary, tx.user_confirmed)
    fused = risk_engine.calculate(RiskInputs(
        deepfake_risk=tx.deepfake_risk, speaker_risk=tx.speaker_risk,
        scam_risk=tx.scam_risk, caller_risk=tx.caller_risk,
        device_risk=tx.device_risk, transaction_risk=transaction_risk
    ))
    action = "HOLD" if fused["risk_score"] >= 75 else "STEP_UP" if fused["risk_score"] >= 50 else "ALLOW_WITH_MONITORING"
    return {"transaction_risk": transaction_risk, "action": action, "risk": fused}
