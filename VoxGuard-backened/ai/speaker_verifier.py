import os
import threading
import numpy as np
import torch
from speechbrain.inference.speaker import SpeakerRecognition

MODEL_SOURCE = "speechbrain/spkrec-ecapa-voxceleb"

class SpeakerVerifier:
    def __init__(self):
        self.model = None
        self.loaded = False
        self.error = None
        self.enrolled_embedding = None
        self.lock = threading.Lock()
        try:
            self.model = SpeakerRecognition.from_hparams(
                source=MODEL_SOURCE,
                savedir=os.path.join(os.path.dirname(os.path.dirname(__file__)), "model", "speaker"),
                run_opts={"device": os.getenv("VOXGUARD_SPEAKER_DEVICE", "cpu")},
            )
            self.loaded = True
        except Exception as exc:
            self.error = str(exc)

    @staticmethod
    def _tensor(audio):
        x = np.asarray(audio, dtype=np.float32).reshape(-1)
        if not len(x):
            raise ValueError("Empty audio.")
        return torch.from_numpy(x).unsqueeze(0)

    @torch.no_grad()
    def embedding(self, audio):
        if not self.loaded:
            raise RuntimeError(self.error or "Speaker model unavailable.")
        with self.lock:
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

    def verify(self, audio):
        if not self.loaded:
            return {"available": False, "status": "unavailable", "similarity": None, "speaker_risk": None, "error": self.error}
        if self.enrolled_embedding is None:
            return {"available": True, "status": "not_enrolled", "similarity": None, "speaker_risk": 35}
        live = self.embedding(audio)
        similarity = float(np.dot(self.enrolled_embedding, live))
        threshold = float(os.getenv("VOXGUARD_SPEAKER_THRESHOLD", "0.72"))
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
