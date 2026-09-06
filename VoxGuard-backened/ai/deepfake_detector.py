import os
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model", "aasist.onnx")
AASIST_SAMPLES = 64600

class DeepfakeDetector:
    def __init__(self, model_path=MODEL_PATH):
        self.model_path = model_path
        self.session = None
        self.loaded = False
        self.error = None
        self.input_name = None
        self.output_name = None
        self.spoof_index = int(os.getenv("VOXGUARD_AASIST_SPOOF_INDEX", "0"))

    def _ensure_loaded(self):
        if self.loaded or self.error:
            return
        if not os.path.exists(self.model_path):
            self.error = f"AASIST model not found: {self.model_path}"
            return
        try:
            import onnxruntime as ort
            self.session = ort.InferenceSession(self.model_path, providers=["CPUExecutionProvider"])
            self.input_name = self.session.get_inputs()[0].name
            self.output_name = self.session.get_outputs()[0].name
            self.loaded = True
        except Exception as exc:
            self.error = str(exc)

    @staticmethod
    def prepare(audio):
        audio = np.asarray(audio, dtype=np.float32).reshape(-1)
        if not len(audio):
            raise ValueError("Empty audio.")
        if len(audio) >= AASIST_SAMPLES:
            return np.ascontiguousarray(audio[:AASIST_SAMPLES])
        reps = AASIST_SAMPLES // len(audio) + 1
        return np.ascontiguousarray(np.tile(audio, reps)[:AASIST_SAMPLES])

    @staticmethod
    def softmax(x):
        x = np.asarray(x, dtype=np.float64).reshape(-1)
        x -= np.max(x)
        e = np.exp(x)
        return e / max(np.sum(e), 1e-12)

    def predict(self, audio):
        self._ensure_loaded()
        if not self.loaded:
            return {"available": False, "error": self.error, "spoof_probability": None, "genuine_probability": None, "deepfake_risk": None}
        x = self.prepare(audio).reshape(1, -1)
        output = self.session.run([self.output_name], {self.input_name: x})[0]
        logits = np.asarray(output).reshape(-1)
        if len(logits) < 2:
            raise RuntimeError(f"Expected 2 AASIST outputs, got {len(logits)}")
        probs = self.softmax(logits[:2])
        idx = 0 if self.spoof_index not in (0, 1) else self.spoof_index
        spoof = float(probs[idx])
        genuine = float(probs[1 - idx])
        return {
            "available": True,
            "spoof_probability": round(spoof, 6),
            "genuine_probability": round(genuine, 6),
            "deepfake_risk": round(spoof * 100, 2),
            "model": "AASIST",
            "window_samples": AASIST_SAMPLES,
            "spoof_index": idx,
        }

detector = DeepfakeDetector()
