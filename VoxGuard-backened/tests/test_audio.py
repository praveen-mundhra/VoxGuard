import numpy as np
from ai.audio_utils import normalize
def test_normalize(): assert np.max(np.abs(normalize(np.array([0,2,-2],dtype=np.float32))))<=1
