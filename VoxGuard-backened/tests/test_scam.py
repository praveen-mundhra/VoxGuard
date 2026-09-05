from ai.scam_detector import analyze_scam
def test_scam_signal(): assert analyze_scam('share your OTP now or account will be blocked')['scam_risk'] > 0
