import os
import tempfile
import threading
import numpy as np
from faster_whisper import WhisperModel
from ai.audio_utils import pcm_to_wav_bytes

class Transcriber:
    def __init__(self):
        self.model = None
        self.loaded = False
        self.error = None
        self.lock = threading.Lock()
        try:
            self.model = WhisperModel(
                os.getenv("VOXGUARD_WHISPER_MODEL", "small"),
                device=os.getenv("VOXGUARD_WHISPER_DEVICE", "cpu"),
                compute_type=os.getenv("VOXGUARD_WHISPER_COMPUTE_TYPE", "int8"),
            )
            self.loaded = True
        except Exception as exc:
            self.error = str(exc)

    def transcribe(self, audio: np.ndarray, language=None):
        if not self.loaded:
            return {"available": False, "text": "", "language": None, "error": self.error}
        fd, path = tempfile.mkstemp(suffix=".wav")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(pcm_to_wav_bytes(audio))
            with self.lock:
                segments, info = self.model.transcribe(
                    path, beam_size=int(os.getenv("VOXGUARD_WHISPER_BEAM", "3")),
                    language=language, vad_filter=True,
                    condition_on_previous_text=False,
                )
                text = " ".join(s.text.strip() for s in segments if s.text.strip())
            return {"available": True, "text": text, "language": getattr(info, "language", None)}
        finally:
            try: os.remove(path)
            except OSError: pass

transcriber = Transcriber()
