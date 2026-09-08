import os
import json
import threading
from pathlib import Path
import numpy as np

MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"
THRESHOLD_PATH = Path(
    os.getenv(
        "VOXGUARD_THRESHOLD_PATH",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "model", "thresholds.json"),
    )
)

class SpeakerVerifier:
    def __init__(self):
        self.model = None
        self.loaded = False
        self.error = None
        self.enrolled_embedding = None
        self.lock = threading.Lock()

    def _ensure_loaded(self):
        if self.loaded or self.error:
            return
        with self.lock:
            if self.loaded or self.error:
                return
            try:
                from speechbrain.inference.speaker import SpeakerRecognition
                from speechbrain.utils.fetching import LocalStrategy
                self.model = SpeakerRecognition.from_hparams(
                    source=MODEL_SOURCE,
                    savedir=os.path.join(os.path.dirname(os.path.dirname(__file__)), "model", "speaker"),
                    local_strategy=LocalStrategy.COPY,
                    run_opts={"device": os.getenv("VOXGUARD_SPEAKER_DEVICE", "cpu")},
                )
                self.loaded = True
            except Exception as exc:
                self.error = str(exc)

    @staticmethod
    def _tensor(audio):
        import torch
        x = np.asarray(audio, dtype=np.float32).reshape(-1)
        if not len(x):
            raise ValueError("Empty audio.")
        return torch.from_numpy(x).unsqueeze(0)

    def embedding(self, audio):
        import torch
        self._ensure_loaded()
        if not self.loaded:
            raise RuntimeError(self.error or "Speaker model unavailable.")
        with self.lock:
            with torch.no_grad():
                emb = self.model.encode_batch(self._tensor(audio))
        emb = emb.squeeze().detach().cpu().numpy().astype(np.float32)
        norm = np.linalg.norm(emb)
        return emb / norm if norm > 0 else emb

    def enroll(self, audio):
        emb = self.embedding(audio)
        self.enrolled_embedding = emb
        return {"status": "enrolled", "embedding_dimensions": int(emb.shape[-1]), "persistent": False}

    def clear(self):
        self.enrolled_embedding = None
        return {"status": "cleared"}

    @staticmethod
    def _calibrated_threshold():
        configured = os.getenv("VOXGUARD_SPEAKER_THRESHOLD")
        if configured is not None:
            return float(configured)
        if not THRESHOLD_PATH.exists():
            return None
        with THRESHOLD_PATH.open(encoding="utf-8") as file:
            calibration = json.load(file)
        threshold = calibration.get("speaker", {}).get("threshold")
        return float(threshold) if threshold is not None else None

    def verify(self, audio):
        self._ensure_loaded()
        if not self.loaded:
            return {"available": False, "status": "unavailable", "similarity": None, "speaker_risk": None, "error": self.error}
        if self.enrolled_embedding is None:
            return {"available": True, "status": "not_enrolled", "similarity": None, "speaker_risk": 35}
        live = self.embedding(audio)
        similarity = float(np.dot(self.enrolled_embedding, live))
        threshold = self._calibrated_threshold()
        if threshold is None:
            return {
                "available": True,
                "status": "unconfigured",
                "cosine_similarity": round(similarity, 4),
                "similarity": round(max(0, min(100, similarity * 100)), 2),
                "speaker_risk": 50,
                "error": f"No calibrated speaker threshold found at {THRESHOLD_PATH}",
            }
        margin = float(os.getenv("VOXGUARD_SPEAKER_MARGIN", "0.10"))
        if similarity >= threshold:
            status, risk = "verified", 5
        elif similarity >= threshold - margin:
            status, risk = "uncertain", 50
        else:
            status, risk = "mismatch", 90
        return {
            "available": True,
            "status": status,
            "cosine_similarity": round(similarity, 4),
            "similarity": round(max(0, min(100, similarity * 100)), 2),
            "speaker_risk": risk,
            "threshold": threshold,
        }

speaker_verifier = SpeakerVerifier()
