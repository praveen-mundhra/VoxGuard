import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


class SpeakerVerifier:

    def __init__(self):

        self.enrolled_embedding = None

    def enroll(self, embedding):

        embedding = np.asarray(
            embedding,
            dtype=np.float32
        )

        norm = np.linalg.norm(embedding)

        if norm > 0:
            embedding = embedding / norm

        self.enrolled_embedding = embedding

    def verify(self, live_embedding):

        if self.enrolled_embedding is None:

            return {
                "status": "not_enrolled",
                "similarity": 0,
                "speaker_risk": 50
            }

        live_embedding = np.asarray(
            live_embedding,
            dtype=np.float32
        )

        live_norm = np.linalg.norm(live_embedding)

        if live_norm > 0:
            live_embedding = live_embedding / live_norm

        similarity = cosine_similarity(
            self.enrolled_embedding.reshape(1, -1),
            live_embedding.reshape(1, -1)
        )[0][0]

        similarity = float(
            (similarity + 1) / 2
        )

        score = similarity * 100

        if score >= 80:

            status = "verified"
            risk = 5

        elif score >= 65:

            status = "uncertain"
            risk = 45

        else:

            status = "mismatch"
            risk = 90

        return {
            "status": status,
            "similarity": round(score, 2),
            "speaker_risk": risk
        }