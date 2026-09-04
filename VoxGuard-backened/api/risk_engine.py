class RiskEngine:

    def calculate(
        self,
        deepfake_risk,
        speaker_risk,
        scam_risk,
        caller_risk=0,
        device_risk=0,
        transaction_risk=0
    ):

        final_score = (

            deepfake_risk * 0.30 +

            speaker_risk * 0.20 +

            scam_risk * 0.20 +

            caller_risk * 0.10 +

            device_risk * 0.05 +

            transaction_risk * 0.15
        )

        final_score = min(
            100,
            max(0, final_score)
        )

        if final_score >= 75:

            level = "HIGH"

            action = [
                "STOP sensitive transaction",
                "Perform independent callback",
                "Require MFA",
                "Alert security team"
            ]

        elif final_score >= 50:

            level = "MEDIUM"

            action = [
                "Perform secondary verification",
                "Do not disclose sensitive information",
                "Confirm transaction independently"
            ]

        else:

            level = "LOW"

            action = [
                "Continue monitoring"
            ]

        return {
            "risk_score": round(final_score, 2),
            "risk_level": level,
            "recommended_actions": action
        }