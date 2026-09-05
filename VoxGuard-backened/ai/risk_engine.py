from dataclasses import dataclass

@dataclass
class RiskInputs:
    deepfake_risk: float = 0
    speaker_risk: float = 0
    scam_risk: float = 0
    caller_risk: float = 0
    device_risk: float = 0
    transaction_risk: float = 0

class RiskEngine:
    WEIGHTS = {"deepfake": .30, "speaker": .20, "scam": .20, "caller": .10, "device": .05, "transaction": .15}

    @staticmethod
    def _clamp(v):
        return max(0.0, min(100.0, float(v or 0)))

    def calculate(self, x: RiskInputs):
        values = {k: self._clamp(v) for k, v in vars(x).items()}
        score = sum(values[k + "_risk"] * w for k, w in self.WEIGHTS.items())
        reasons = []
        if values["deepfake_risk"] >= 75: reasons.append("high_voice_spoof_signal")
        if values["speaker_risk"] >= 75: reasons.append("speaker_mismatch")
        if values["scam_risk"] >= 60: reasons.append("scam_language_detected")
        if values["transaction_risk"] >= 60: reasons.append("high_transaction_risk")
        if values["caller_risk"] >= 60: reasons.append("caller_context_risk")
        if values["deepfake_risk"] >= 80 and values["scam_risk"] >= 70:
            score += 10; reasons.append("spoof_plus_scam_escalation")
        if values["speaker_risk"] >= 80 and values["transaction_risk"] >= 60:
            score += 8; reasons.append("speaker_mismatch_plus_transaction_escalation")
        score = self._clamp(score)
        if score >= 75:
            level, action = "HIGH", "BLOCK_OR_HOLD"
            rec = ["Stop sensitive transaction.", "Perform independent callback.", "Require MFA or step-up verification.", "Escalate to security/supervisor."]
        elif score >= 50:
            level, action = "MEDIUM", "SECONDARY_VERIFY"
            rec = ["Perform secondary verification.", "Do not disclose sensitive information.", "Confirm beneficiary and transaction independently."]
        else:
            level, action = "LOW", "MONITOR"
            rec = ["Continue monitoring."]
        return {"risk_score": round(score, 2), "risk_level": level, "action": action, "recommendations": rec, "reasons": reasons, "components": values}

risk_engine = RiskEngine()
