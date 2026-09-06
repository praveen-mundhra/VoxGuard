import base64
import hashlib
import hmac

import numpy as np

from integrations.telephony.twilio_adapter import decode_mulaw, validate_twilio_signature


def test_decode_mulaw_returns_normalized_audio():
    audio = decode_mulaw(bytes([0xFF, 0x7F, 0x80]))

    assert audio.dtype == np.float32
    assert len(audio) == 3
    assert np.all(np.abs(audio) <= 1)


def test_twilio_signature_matches_sorted_form_parameters():
    url = "https://example.test/telephony/twilio/voice"
    params = {"From": "+14155550100", "CallSid": "CA123"}
    token = "secret"
    signed = url + "CallSidCA123From+14155550100"
    signature = base64.b64encode(hmac.new(token.encode(), signed.encode(), hashlib.sha1).digest()).decode()

    assert validate_twilio_signature(url, params, signature, token)
    assert not validate_twilio_signature(url, params, "invalid", token)