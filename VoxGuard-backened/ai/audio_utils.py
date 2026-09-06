import io
import wave
import numpy as np

TARGET_SR = 16000


def decode_container_audio(audio_bytes: bytes):
    import av

    if not audio_bytes:
        raise ValueError("Empty audio upload.")
    container = av.open(io.BytesIO(audio_bytes))
    try:
        stream = next((s for s in container.streams if s.type == "audio"), None)
        if stream is None:
            raise ValueError("No audio stream found.")
        rate = int(stream.sample_rate or TARGET_SR)
        frames = []
        for frame in container.decode(stream):
            arr = frame.to_ndarray()
            if arr.ndim == 2:
                arr = arr.mean(axis=0 if arr.shape[0] <= 8 else 1)
            frames.append(np.asarray(arr, dtype=np.float32).reshape(-1))
        if not frames:
            raise ValueError("No audio frames decoded.")
        return np.concatenate(frames), rate
    finally:
        container.close()


def resample(audio: np.ndarray, source_sr: int, target_sr: int = TARGET_SR):
    from scipy.signal import resample_poly

    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if len(audio) == 0 or source_sr == target_sr:
        return audio
    if source_sr <= 0 or target_sr <= 0:
        raise ValueError("Invalid sample rate.")
    from math import gcd
    g = gcd(int(source_sr), int(target_sr))
    return resample_poly(audio, target_sr // g, source_sr // g).astype(np.float32)


def normalize(audio: np.ndarray):
    audio = np.nan_to_num(np.asarray(audio, dtype=np.float32).reshape(-1), nan=0.0, posinf=0.0, neginf=0.0)
    if not len(audio):
        return audio
    audio = audio - float(np.mean(audio))
    peak = float(np.max(np.abs(audio)))
    if peak > 1e-8:
        audio = audio / peak
    return np.clip(audio, -1, 1).astype(np.float32)


def decode_pcm16(data: bytes):
    if len(data) % 2:
        data = data[:-1]
    return np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0


def decode_float32(data: bytes):
    if len(data) % 4:
        data = data[:len(data) - (len(data) % 4)]
    return np.frombuffer(data, dtype=np.float32).copy()


def pcm_to_wav_bytes(audio: np.ndarray, sample_rate: int = TARGET_SR):
    audio = np.clip(np.asarray(audio, dtype=np.float32), -1, 1)
    pcm = (audio * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()
