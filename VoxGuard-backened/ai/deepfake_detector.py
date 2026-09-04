import os
import numpy as np
import onnxruntime as ort


class DeepfakeDetector:

    def __init__(self, model_path="models/aasist.onnx"):

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"AASIST model not found: {model_path}"
            )

        self.session = ort.InferenceSession(
            model_path,
            providers=["CPUExecutionProvider"]
        )

        self.input_name = self.session.get_inputs()[0].name

    def preprocess(self, audio):

        audio = np.asarray(audio, dtype=np.float32)

        # mono
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)

        # remove DC
        audio = audio - np.mean(audio)

        # normalize
        max_value = np.max(np.abs(audio))

        if max_value > 0:
            audio = audio / max_value

        # AASIST uses approximately 4 seconds
        target_length = 64600

        if len(audio) < target_length:

            audio = np.pad(
                audio,
                (0, target_length - len(audio))
            )

        else:

            audio = audio[:target_length]

        return audio.astype(np.float32)

    def predict(self, audio):

        audio = self.preprocess(audio)

        input_tensor = audio.reshape(1, -1)

        output = self.session.run(
            None,
            {
                self.input_name: input_tensor
            }
        )

        logits = np.asarray(output[0])

        # Convert logits to probabilities
        exp_logits = np.exp(
            logits - np.max(logits, axis=-1, keepdims=True)
        )

        probabilities = (
            exp_logits /
            np.sum(exp_logits, axis=-1, keepdims=True)
        )

        probabilities = probabilities[0]

        # Depending on exported model:
        # index 0 = spoof
        # index 1 = bona fide
        spoof_probability = float(probabilities[0])
        genuine_probability = float(probabilities[1])

        return {
            "spoof_probability": spoof_probability,
            "genuine_probability": genuine_probability,
            "deepfake_risk": round(
                spoof_probability * 100,
                2
            )
        }