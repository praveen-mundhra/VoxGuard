import numpy as np
import pytest

from ai.audio_utils import normalize
from app.services.voice import validate_voice_sample_duration


def test_normalize():
    assert np.max(np.abs(normalize(np.array([0, 2, -2], dtype=np.float32)))) <= 1


def test_validate_voice_sample_duration_requires_minimum_55_seconds():
    with pytest.raises(ValueError, match="at least 55 seconds"):
        validate_voice_sample_duration(54.9)

    validate_voice_sample_duration(55.0)
