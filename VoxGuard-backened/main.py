import io
import json
import os
import time
import hashlib
from pathlib import Path

import av
import numpy as np
import onnxruntime as ort

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware


# ============================================================
# VOXGUARD CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_DIR = BASE_DIR / "model"

MODEL_PATH = MODEL_DIR / "aasist.onnx"

TARGET_SAMPLE_RATE = 16000

# Official AASIST evaluation window
AASIST_SAMPLES = 64600

WINDOW_SECONDS = (
    AASIST_SAMPLES / TARGET_SAMPLE_RATE
)

MIN_AUDIO_SECONDS = 2.0

MAX_AUDIO_SECONDS = 30.0

# Voice-biometric enrollment requires a longer, richer sample
MIN_ENROLL_SECONDS = 110.0

MAX_ENROLL_SECONDS = 180.0

# Silence threshold
SILENCE_RMS_THRESHOLD = 0.003

# Number of mel-style filters used for the lightweight
# voiceprint embedding (layer 4 / speaker verification)
EMBED_N_MELS = 40

EMBED_FFT_SIZE = 512

EMBED_FRAME_MS = 25

EMBED_HOP_MS = 10


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="VoxGuard AI",
    description=(
        "AI-powered voice deepfake and "
        "synthetic speech detection API"
    ),
    version="2.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================================
# GLOBAL MODEL
# ============================================================

onnx_session = None

model_error = None

model_input_name = None

model_output_name = None

model_input_shape = None

model_output_shape = None


# ============================================================
# LOAD ONNX MODEL
# ============================================================

def load_model():

    global onnx_session
    global model_error

    global model_input_name
    global model_output_name

    global model_input_shape
    global model_output_shape

    try:

        print()
        print("=" * 65)
        print("                 VOXGUARD AI")
        print("=" * 65)

        print(
            f"Looking for model:\n{MODEL_PATH}"
        )

        # ----------------------------------------------------
        # Check model directory
        # ----------------------------------------------------

        if not MODEL_DIR.exists():

            raise FileNotFoundError(
                f"""
Model folder does not exist:

{MODEL_DIR}

Create:

VoxGuard-backend/model/
"""
            )

        # ----------------------------------------------------
        # Check ONNX file
        # ----------------------------------------------------

        if not MODEL_PATH.exists():

            raise FileNotFoundError(
                f"""
aasist.onnx was not found.

Put the downloaded model here:

{MODEL_PATH}
"""
            )

        # ----------------------------------------------------
        # Check file size
        # ----------------------------------------------------

        file_size_mb = (
            MODEL_PATH.stat().st_size
            / (1024 * 1024)
        )

        print(
            f"Model size: {file_size_mb:.2f} MB"
        )

        if file_size_mb < 1:

            raise RuntimeError(
                """
aasist.onnx appears to be incomplete.

Make sure you downloaded the actual
ONNX file from Hugging Face and not
the small Git LFS pointer file.
"""
            )

        # ----------------------------------------------------
        # ONNX Runtime providers
        # ----------------------------------------------------

        providers = [
            "CPUExecutionProvider"
        ]

        print(
            "Initializing ONNX Runtime..."
        )

        # ----------------------------------------------------
        # Load model
        # ----------------------------------------------------

        onnx_session = ort.InferenceSession(
            str(MODEL_PATH),

            providers=providers,
        )

        # ----------------------------------------------------
        # Get input information
        # ----------------------------------------------------

        input_info = (
            onnx_session.get_inputs()[0]
        )

        output_info = (
            onnx_session.get_outputs()[0]
        )

        model_input_name = (
            input_info.name
        )

        model_output_name = (
            output_info.name
        )

        model_input_shape = (
            input_info.shape
        )

        model_output_shape = (
            output_info.shape
        )

        model_error = None

        print()
        print("MODEL LOADED SUCCESSFULLY")
        print("-" * 65)

        print(
            f"Input name   : {model_input_name}"
        )

        print(
            f"Input shape  : {model_input_shape}"
        )

        print(
            f"Output name  : {model_output_name}"
        )

        print(
            f"Output shape : {model_output_shape}"
        )

        print(
            f"Sample rate  : {TARGET_SAMPLE_RATE} Hz"
        )

        print(
            f"Window       : {AASIST_SAMPLES} samples"
        )

        print(
            f"Window time  : {WINDOW_SECONDS:.2f} seconds"
        )

        print("-" * 65)

        print(
            "VoxGuard AI backend is ready."
        )

        print("=" * 65)
        print()

    except Exception as exc:

        onnx_session = None

        model_error = str(exc)

        print()
        print("=" * 65)
        print("MODEL LOADING FAILED")
        print("=" * 65)
        print(exc)
        print("=" * 65)
        print()


# Load model when server starts
load_model()


# ============================================================
# AUDIO DECODER
# ============================================================

def decode_audio(
    audio_bytes: bytes
):
    """
    Decode WAV / WebM / OGG / MP3 / M4A
    using PyAV.

    Returns:

        mono float32 numpy array
        original sample rate
    """

    try:

        container = av.open(
            io.BytesIO(audio_bytes)
        )

    except Exception as exc:

        raise HTTPException(
            status_code=400,

            detail=(
                "Could not decode the uploaded "
                "audio file. "
                f"Decoder error: {exc}"
            ),
        )

    try:

        audio_stream = None

        for stream in container.streams:

            if stream.type == "audio":

                audio_stream = stream

                break

        if audio_stream is None:

            raise ValueError(
                "No audio stream found."
            )

        sample_rate = (
            audio_stream.sample_rate
        )

        frames = []

        for frame in container.decode(
            audio_stream
        ):

            # Convert to mono float32
            array = frame.to_ndarray()

            if array.ndim == 2:

                # Depending on codec/layout,
                # PyAV may return:
                #
                # channels x samples
                #
                # or samples x channels
                #

                if array.shape[0] <= 8:

                    array = np.mean(
                        array,
                        axis=0
                    )

                else:

                    array = np.mean(
                        array,
                        axis=1
                    )

            array = np.asarray(
                array,
                dtype=np.float32
            ).reshape(-1)

            frames.append(
                array
            )

        if not frames:

            raise ValueError(
                "Audio contains no decoded frames."
            )

        audio = np.concatenate(
            frames
        )

        return (
            audio,
            int(sample_rate)
        )

    except HTTPException:

        raise

    except Exception as exc:

        raise HTTPException(
            status_code=400,

            detail=(
                "Audio decoding failed: "
                f"{exc}"
            ),
        )

    finally:

        container.close()


# ============================================================
# RESAMPLE
# ============================================================

def resample_audio(
    audio,
    original_rate
):
    """
    Resample to 16 kHz.

    Uses PyAV's built-in resampler.
    """

    if original_rate == TARGET_SAMPLE_RATE:

        return audio.astype(
            np.float32
        )

    try:

        frame = av.AudioFrame.from_ndarray(
            audio.reshape(1, -1),
            format="flt",
            layout="mono",
        )

        frame.sample_rate = (
            original_rate
        )

        resampler = av.AudioResampler(
            format="flt",
            layout="mono",
            rate=TARGET_SAMPLE_RATE,
        )

        converted = (
            resampler.resample(
                frame
            )
        )

        if not isinstance(
            converted,
            list
        ):

            converted = [
                converted
            ]

        parts = []

        for output_frame in converted:

            data = (
                output_frame.to_ndarray()
            )

            parts.append(
                data.reshape(-1)
            )

        if not parts:

            raise RuntimeError(
                "Resampling returned no audio."
            )

        result = np.concatenate(
            parts
        )

        return result.astype(
            np.float32
        )

    except Exception:

        # Fallback: numpy interpolation
        original_length = len(
            audio
        )

        new_length = int(
            original_length
            * TARGET_SAMPLE_RATE
            / original_rate
        )

        old_positions = np.linspace(
            0,
            1,
            original_length,
            endpoint=False,
        )

        new_positions = np.linspace(
            0,
            1,
            new_length,
            endpoint=False,
        )

        return np.interp(
            new_positions,
            old_positions,
            audio,
        ).astype(
            np.float32
        )


# ============================================================
# NORMALIZE AUDIO
# ============================================================

def normalize_audio(
    audio
):

    audio = np.asarray(
        audio,
        dtype=np.float32
    )

    # Remove NaN
    audio = np.nan_to_num(
        audio
    )

    # Remove DC offset
    audio = (
        audio
        - np.mean(audio)
    )

    # Normalize peak
    peak = np.max(
        np.abs(audio)
    )

    if peak > 0:

        audio = (
            audio
            / max(peak, 1e-8)
        )

    return audio.astype(
        np.float32
    )


# ============================================================
# PREPARE AUDIO
# ============================================================

def prepare_audio(
    audio_bytes: bytes,
    min_seconds: float = MIN_AUDIO_SECONDS,
    max_seconds: float = MAX_AUDIO_SECONDS,
):

    # --------------------------------------------------------
    # Decode
    # --------------------------------------------------------

    audio, original_rate = (
        decode_audio(
            audio_bytes
        )
    )

    # --------------------------------------------------------
    # Resample
    # --------------------------------------------------------

    audio = resample_audio(
        audio,
        original_rate,
    )

    # --------------------------------------------------------
    # Clean (NaN removal + DC offset removal) BEFORE peak
    # normalization. This "raw" signal is what the layer-1
    # (acoustic) and layer-2 (spectral) analyzers use, since
    # peak-normalizing first would erase real amplitude and
    # dynamic-range information.
    # --------------------------------------------------------

    raw = np.nan_to_num(
        np.asarray(audio, dtype=np.float32)
    )

    raw = raw - np.mean(raw)

    # --------------------------------------------------------
    # Normalize (this version feeds the AASIST model, which
    # was trained on peak-normalized waveforms)
    # --------------------------------------------------------

    normalized = normalize_audio(
        raw
    )

    # --------------------------------------------------------
    # Duration
    # --------------------------------------------------------

    duration = (
        len(normalized)
        / TARGET_SAMPLE_RATE
    )

    # --------------------------------------------------------
    # Validate minimum duration
    # --------------------------------------------------------

    if duration < min_seconds:

        raise HTTPException(

            status_code=400,

            detail=(
                f"Please provide at least "
                f"{min_seconds:.0f} seconds "
                "of speech."
            ),
        )

    # --------------------------------------------------------
    # Limit duration
    # --------------------------------------------------------

    if duration > max_seconds:

        max_samples = int(
            max_seconds
            * TARGET_SAMPLE_RATE
        )

        normalized = normalized[:max_samples]
        raw = raw[:max_samples]

        duration = (
            len(normalized)
            / TARGET_SAMPLE_RATE
        )

    # --------------------------------------------------------
    # Silence detection
    # --------------------------------------------------------

    rms = float(
        np.sqrt(
            np.mean(
                np.square(normalized)
            )
        )
    )

    if rms < SILENCE_RMS_THRESHOLD:

        raise HTTPException(

            status_code=400,

            detail=(
                "No clear speech was detected. "
                "Please speak closer to the microphone "
                "and try again."
            ),
        )

    return (
        normalized,
        raw,
        duration,
        original_rate,
        rms,
    )


# ============================================================
# AASIST FIXED WINDOW
# ============================================================

def create_aasist_window(
    audio
):
    """
    AASIST expects a deterministic
    64,600-sample window.

    If the audio is longer:
        take first 64,600 samples.

    If shorter:
        repeat/tile the waveform until
        64,600 samples are available.

    This follows the deterministic
    evaluation-window approach used by
    the official implementation.
    """

    audio = np.asarray(
        audio,
        dtype=np.float32
    ).reshape(-1)

    if len(audio) >= AASIST_SAMPLES:

        window = audio[
            :AASIST_SAMPLES
        ]

    else:

        if len(audio) == 0:

            raise ValueError(
                "Empty audio."
            )

        repetitions = (
            AASIST_SAMPLES
            // len(audio)
        ) + 1

        window = np.tile(
            audio,
            repetitions
        )[:AASIST_SAMPLES]

    return np.ascontiguousarray(
        window,
        dtype=np.float32
    )


# ============================================================
# SOFTMAX
# ============================================================

def softmax(
    logits
):

    logits = np.asarray(
        logits,
        dtype=np.float64
    )

    logits = (
        logits
        - np.max(logits)
    )

    exp_values = np.exp(
        logits
    )

    return (
        exp_values
        /
        np.sum(exp_values)
    )


# ============================================================
# AASIST INFERENCE
# ============================================================

def run_aasist(
    audio
):

    if onnx_session is None:

        raise HTTPException(

            status_code=503,

            detail=(
                "AASIST ONNX model is not loaded. "
                "Check the backend terminal."
            ),
        )

    # --------------------------------------------------------
    # Prepare fixed window
    # --------------------------------------------------------

    window = create_aasist_window(
        audio
    )

    # --------------------------------------------------------
    # Add batch dimension
    #
    # [64600]
    #
    # becomes
    #
    # [1, 64600]
    # --------------------------------------------------------

    model_input = (
        window[
            np.newaxis,
            :
        ]
    ).astype(
        np.float32
    )

    # --------------------------------------------------------
    # ONNX inference
    # --------------------------------------------------------

    try:

        outputs = (
            onnx_session.run(
                [model_output_name],

                {
                    model_input_name:
                    model_input
                },
            )
        )

    except Exception as exc:

        raise HTTPException(

            status_code=500,

            detail=(
                "AASIST ONNX inference failed: "
                f"{exc}"
            ),
        )

    # --------------------------------------------------------
    # Extract logits
    # --------------------------------------------------------

    logits = np.asarray(
        outputs[0]
    )

    # Remove unnecessary dimensions
    logits = np.squeeze(
        logits
    )

    if logits.ndim != 1:

        logits = logits.reshape(
            -1
        )

    if len(logits) < 2:

        raise RuntimeError(
            "Unexpected AASIST output. "
            f"Received shape: {logits.shape}"
        )

    # --------------------------------------------------------
    # AASIST output
    #
    # Class 0 = spoof
    # Class 1 = bona fide
    #
    # Official Arena score is the
    # bona-fide logit.
    # --------------------------------------------------------

    spoof_logit = float(
        logits[0]
    )

    bona_fide_logit = float(
        logits[1]
    )

    probabilities = softmax(
        logits[:2]
    )

    spoof_probability = float(
        probabilities[0]
    )

    bona_fide_probability = float(
        probabilities[1]
    )

    # --------------------------------------------------------
    # Application risk
    #
    # This is a model-derived risk indicator,
    # NOT a calibrated probability of fraud.
    # --------------------------------------------------------

    risk_score = (
        spoof_probability
        * 100
    )

    # --------------------------------------------------------
    # Risk level
    # --------------------------------------------------------

    if risk_score >= 75:

        risk_level = "HIGH"

        recommendation = (
            "STOP sensitive actions. "
            "Perform callback verification, "
            "MFA and supervisor escalation."
        )

    elif risk_score >= 50:

        risk_level = "MEDIUM"

        recommendation = (
            "Perform secondary verification "
            "before approving transactions "
            "or disclosing sensitive information."
        )

    else:

        risk_level = "LOW"

        recommendation = (
            "Voice is comparatively consistent "
            "with bona-fide speech. Continue "
            "normal security procedures."
        )

    # --------------------------------------------------------
    # Classification
    # --------------------------------------------------------

    is_spoof = (
        spoof_probability
        >
        bona_fide_probability
    )

    if is_spoof:

        message = (
            "AASIST detected acoustic characteristics "
            "more consistent with spoofed or "
            "synthetic speech."
        )

    else:

        message = (
            "AASIST detected acoustic characteristics "
            "more consistent with bona-fide speech."
        )

    # --------------------------------------------------------
    # Return
    # --------------------------------------------------------

    return {

        "raw_logits": [
            round(
                spoof_logit,
                6
            ),
            round(
                bona_fide_logit,
                6
            ),
        ],

        "spoof_probability": round(
            spoof_probability * 100,
            2
        ),

        "bonafide_probability": round(
            bona_fide_probability * 100,
            2
        ),

        "risk_score": round(
            risk_score,
            2
        ),

        "risk_level": risk_level,

        "is_spoof": is_spoof,

        "message": message,

        "recommendation": recommendation,
    }


# ============================================================
# MULTI-LAYER SUPPLEMENTARY DSP ANALYSIS
#
# The AASIST ONNX model above is the only trained, validated
# spoof-detection model in this system, and it alone drives
# `risk_score` / `risk_level` / `is_spoof`.
#
# The four "layers" below are classic, deterministic signal
# processing measurements (no neural network) that give a
# human analyst supporting evidence to look at alongside the
# AASIST verdict. They are heuristic indicators, not a second
# certified detector, and are labelled as such in every
# response.
# ============================================================

def frame_signal(audio, frame_len, hop_len):
    """Split 1-D audio into overlapping frames (rows)."""

    audio = np.asarray(audio, dtype=np.float32)

    if len(audio) < frame_len:
        audio = np.pad(audio, (0, frame_len - len(audio)))

    n_frames = 1 + (len(audio) - frame_len) // hop_len

    indices = (
        np.arange(frame_len)[None, :]
        + np.arange(n_frames)[:, None] * hop_len
    )

    return audio[indices]


def _mel_filterbank(sample_rate, n_fft, n_mels, fmin=0.0, fmax=None):

    fmax = fmax or sample_rate / 2

    def hz_to_mel(f):
        return 2595.0 * np.log10(1.0 + f / 700.0)

    def mel_to_hz(m):
        return 700.0 * (10.0 ** (m / 2595.0) - 1.0)

    mel_min, mel_max = hz_to_mel(fmin), hz_to_mel(fmax)

    mel_points = np.linspace(mel_min, mel_max, n_mels + 2)

    hz_points = mel_to_hz(mel_points)

    bin_points = np.floor(
        (n_fft + 1) * hz_points / sample_rate
    ).astype(int)

    n_bins = n_fft // 2 + 1

    filters = np.zeros((n_mels, n_bins), dtype=np.float32)

    for m in range(1, n_mels + 1):

        left, center, right = bin_points[m - 1], bin_points[m], bin_points[m + 1]

        left, center, right = max(left, 0), max(center, 1), max(right, center + 1)

        for k in range(left, min(center, n_bins)):
            if center > left:
                filters[m - 1, k] = (k - left) / (center - left)

        for k in range(center, min(right, n_bins)):
            if right > center:
                filters[m - 1, k] = (right - k) / (right - center)

    return filters


_MEL_FB_CACHE = _mel_filterbank(
    TARGET_SAMPLE_RATE, EMBED_FFT_SIZE, EMBED_N_MELS
)


def compute_embedding(raw_audio):
    """
    Lightweight, fully-deterministic "voiceprint" for the
    layer-4 speaker-verification check.

    This is a mean log-mel-energy profile of the speaker's
    voice (NOT a trained neural speaker embedding / d-vector /
    x-vector). It is a reasonable, fast proxy for "does this
    voice's spectral energy distribution resemble the enrolled
    sample", but it is explicitly a lightweight heuristic, not
    an enterprise-grade biometric system.
    """

    frame_len = int(TARGET_SAMPLE_RATE * EMBED_FRAME_MS / 1000)
    hop_len = int(TARGET_SAMPLE_RATE * EMBED_HOP_MS / 1000)

    frames = frame_signal(raw_audio, frame_len, hop_len)

    window = np.hamming(frame_len).astype(np.float32)

    frames = frames * window[None, :]

    spectrum = np.fft.rfft(frames, n=EMBED_FFT_SIZE, axis=1)

    magnitude = np.abs(spectrum)

    mel_energy = magnitude @ _MEL_FB_CACHE.T

    log_mel = np.log(mel_energy + 1e-6)

    embedding = np.mean(log_mel, axis=0)

    norm = np.linalg.norm(embedding)

    if norm > 0:
        embedding = embedding / norm

    return embedding.astype(np.float32)


def cosine_similarity(a, b):

    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)

    if a.shape != b.shape or a.size == 0:
        return 0.0

    denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8

    return float(np.clip(np.dot(a, b) / denom, -1.0, 1.0))


def _clamp(value, low=0.0, high=100.0):
    return float(min(max(value, low), high))


def _status_from_score(score):

    if score >= 66:
        return "flag"

    if score >= 33:
        return "caution"

    return "pass"


# ------------------------------------------------------------
# LAYER 1 — ACOUSTIC ANALYSIS
# ------------------------------------------------------------

def compute_acoustic_layer(raw_audio, sample_rate=TARGET_SAMPLE_RATE):

    audio = np.asarray(raw_audio, dtype=np.float32)

    rms = float(np.sqrt(np.mean(np.square(audio)) + 1e-12))

    peak = float(np.max(np.abs(audio)) + 1e-12)

    sign_changes = np.sum(
        np.abs(np.diff(np.sign(audio))) > 0
    )

    zcr_per_sec = float(sign_changes) / 2.0 / (len(audio) / sample_rate)

    p95 = np.percentile(np.abs(audio), 95) + 1e-6

    p20 = np.percentile(np.abs(audio), 20) + 1e-6

    dynamic_range_db = float(20 * np.log10(p95 / p20))

    frame_len = int(sample_rate * 0.02)

    frames = frame_signal(audio, frame_len, frame_len)

    frame_rms = np.sqrt(np.mean(np.square(frames), axis=1) + 1e-12)

    silence_ratio = float(
        np.mean(frame_rms < (0.06 * peak))
    )

    # Heuristic anomaly scoring: natural conversational speech
    # usually shows moderate dynamic range and a healthy amount
    # of micro-pauses/breaths. Extremely flat dynamic range or
    # near-zero silence ratio (typical of some TTS renders) or
    # excessive silence (clipped/looped samples) push the score up.
    dr_risk = _clamp(100 - (dynamic_range_db / 28.0) * 100)

    silence_risk = _clamp(
        abs(silence_ratio - 0.22) / 0.22 * 100
    )

    score = _clamp(0.6 * dr_risk + 0.4 * silence_risk)

    status = _status_from_score(score)

    verdict = {
        "pass": "Amplitude dynamics and pause patterns look consistent with natural speech.",
        "caution": "Amplitude dynamics show some deviation from typical natural speech patterns.",
        "flag": "Unusually flat dynamic range or pause pattern — a trait sometimes seen in synthetic audio.",
    }[status]

    return {
        "name": "Acoustic Analysis",
        "score": round(score, 1),
        "status": status,
        "verdict": verdict,
        "metrics": {
            "rms_energy": round(rms, 4),
            "peak_amplitude": round(peak, 4),
            "zero_crossing_rate_hz": round(zcr_per_sec, 1),
            "dynamic_range_db": round(dynamic_range_db, 1),
            "silence_ratio_pct": round(silence_ratio * 100, 1),
        },
    }


# ------------------------------------------------------------
# LAYER 2 — SPECTRAL ANALYSIS
# ------------------------------------------------------------

def compute_spectral_layer(raw_audio, sample_rate=TARGET_SAMPLE_RATE):

    audio = np.asarray(raw_audio, dtype=np.float32)

    frame_len = int(sample_rate * 0.032)

    hop_len = int(sample_rate * 0.016)

    frames = frame_signal(audio, frame_len, hop_len)

    window = np.hamming(frame_len).astype(np.float32)

    spectrum = np.abs(np.fft.rfft(frames * window[None, :], axis=1))

    mean_spectrum = np.mean(spectrum, axis=0) + 1e-8

    freqs = np.fft.rfftfreq(frame_len, d=1.0 / sample_rate)

    total_energy = float(np.sum(mean_spectrum))

    spectral_centroid = float(
        np.sum(freqs * mean_spectrum) / total_energy
    )

    geo_mean = float(np.exp(np.mean(np.log(mean_spectrum))))

    arith_mean = float(np.mean(mean_spectrum))

    spectral_flatness = float(geo_mean / arith_mean)

    cumulative = np.cumsum(mean_spectrum)

    rolloff_idx = int(np.searchsorted(cumulative, 0.85 * total_energy))

    rolloff_idx = min(rolloff_idx, len(freqs) - 1)

    spectral_rolloff = float(freqs[rolloff_idx])

    high_freq_energy = float(np.sum(mean_spectrum[freqs > 7000]))

    high_freq_ratio = float(high_freq_energy / total_energy)

    # Many neural vocoders are band-limited (little energy
    # above ~7-8kHz) and produce an over-smoothed spectral
    # envelope (low flatness / low natural "roughness").
    hf_risk = _clamp((1 - high_freq_ratio / 0.05) * 100)

    flatness_risk = _clamp(abs(spectral_flatness - 0.12) / 0.12 * 100)

    score = _clamp(0.55 * hf_risk + 0.45 * flatness_risk)

    status = _status_from_score(score)

    verdict = {
        "pass": "Frequency content extends naturally into the high band with organic spectral texture.",
        "caution": "Some spectral smoothing or reduced high-frequency content detected.",
        "flag": "High-frequency roll-off and spectral smoothness resemble vocoder / TTS synthesis artifacts.",
    }[status]

    return {
        "name": "Spectral Analysis",
        "score": round(score, 1),
        "status": status,
        "verdict": verdict,
        "metrics": {
            "spectral_centroid_hz": round(spectral_centroid, 1),
            "spectral_flatness": round(spectral_flatness, 4),
            "spectral_rolloff_hz": round(spectral_rolloff, 1),
            "high_freq_energy_ratio_pct": round(high_freq_ratio * 100, 2),
        },
    }


# ------------------------------------------------------------
# LAYER 3 — PROSODY ANALYSIS
# ------------------------------------------------------------

def compute_prosody_layer(raw_audio, sample_rate=TARGET_SAMPLE_RATE):

    audio = np.asarray(raw_audio, dtype=np.float32)

    frame_len = int(sample_rate * 0.03)

    hop_len = int(sample_rate * 0.01)

    frames = frame_signal(audio, frame_len, hop_len)

    window = np.hamming(frame_len).astype(np.float32)

    min_lag = int(sample_rate / 400)   # 400 Hz upper bound
    max_lag = int(sample_rate / 70)    # 70 Hz lower bound

    pitches = []

    for frame in frames:

        f = frame * window

        energy = np.sum(f * f)

        if energy < 1e-6:
            continue

        corr = np.correlate(f, f, mode="full")[len(f) - 1:]

        segment = corr[min_lag:max_lag]

        if len(segment) == 0:
            continue

        peak_lag = int(np.argmax(segment)) + min_lag

        peak_val = corr[peak_lag]

        normalized_peak = peak_val / (corr[0] + 1e-8)

        if normalized_peak > 0.32:
            pitches.append(sample_rate / peak_lag)

    voiced_ratio = float(len(pitches) / max(len(frames), 1))

    if len(pitches) >= 4:

        pitches = np.array(pitches)

        pitch_mean = float(np.mean(pitches))

        pitch_std = float(np.std(pitches))

        jitter_pct = float(
            np.mean(np.abs(np.diff(pitches))) / (pitch_mean + 1e-6) * 100
        )

    else:

        pitch_mean = 0.0
        pitch_std = 0.0
        jitter_pct = 0.0

    # Very low pitch variability ("too flat/monotone") or
    # unnaturally low jitter is a pattern sometimes seen in
    # synthetic speech; extremely low voiced ratio suggests the
    # analysis window had too little usable speech.
    if pitch_mean > 0:
        variability_risk = _clamp(100 - (pitch_std / 18.0) * 100)
        jitter_risk = _clamp(100 - (jitter_pct / 3.0) * 100)
    else:
        variability_risk = 50.0
        jitter_risk = 50.0

    coverage_risk = _clamp((1 - voiced_ratio / 0.55) * 100) if voiced_ratio < 0.55 else 0.0

    score = _clamp(0.45 * variability_risk + 0.35 * jitter_risk + 0.20 * coverage_risk)

    status = _status_from_score(score)

    verdict = {
        "pass": "Pitch contour shows natural micro-variation consistent with human speech.",
        "caution": "Pitch variation is somewhat lower than typical natural speech.",
        "flag": "Unusually flat or monotone pitch contour — a pattern often seen in synthetic voices.",
    }[status]

    return {
        "name": "Prosody Analysis",
        "score": round(score, 1),
        "status": status,
        "verdict": verdict,
        "metrics": {
            "pitch_mean_hz": round(pitch_mean, 1),
            "pitch_std_hz": round(pitch_std, 2),
            "jitter_pct": round(jitter_pct, 2),
            "voiced_ratio_pct": round(voiced_ratio * 100, 1),
        },
    }


# ------------------------------------------------------------
# LAYER 4 — SPEAKER VERIFICATION
# ------------------------------------------------------------

def compute_speaker_layer(raw_audio, enrolled_embedding):

    live_embedding = compute_embedding(raw_audio)

    if enrolled_embedding is None:

        return {
            "name": "Speaker Verification",
            "enrolled": False,
            "status": "unavailable",
            "verdict": (
                "No enrolled voiceprint on file for this user. "
                "Enroll a voice sample to enable speaker verification."
            ),
            "similarity_pct": None,
            "match": None,
            "live_embedding": live_embedding.tolist(),
        }

    similarity = cosine_similarity(live_embedding, enrolled_embedding)

    similarity_pct = _clamp((similarity + 1) / 2 * 100)

    match = similarity_pct >= 78

    status = "pass" if match else ("caution" if similarity_pct >= 60 else "flag")

    verdict = {
        "pass": "This voice's spectral profile closely matches the enrolled voiceprint.",
        "caution": "Partial match to the enrolled voiceprint — some deviation detected.",
        "flag": "This voice's spectral profile does not match the enrolled voiceprint.",
    }[status]

    return {
        "name": "Speaker Verification",
        "enrolled": True,
        "status": status,
        "verdict": verdict,
        "similarity_pct": round(similarity_pct, 1),
        "match": match,
        "live_embedding": live_embedding.tolist(),
    }


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
async def root():

    return {

        "application": "VoxGuard AI",

        "status": "online",

        "model": "AASIST ONNX",

        "model_loaded": (
            onnx_session is not None
        ),

        "version": "2.0.0",

    }


# ============================================================
# STATUS ENDPOINT
# ============================================================

@app.get("/api/status")
async def api_status():

    return {

        "backend": "online",

        "model": "AASIST ONNX",

        "model_loaded": (
            onnx_session is not None
        ),

        "model_path": str(
            MODEL_PATH
        ),

        "input_name": (
            model_input_name
        ),

        "input_shape": (
            model_input_shape
        ),

        "output_name": (
            model_output_name
        ),

        "output_shape": (
            model_output_shape
        ),

        "sample_rate": (
            TARGET_SAMPLE_RATE
        ),

        "window_samples": (
            AASIST_SAMPLES
        ),

        "window_seconds": round(
            WINDOW_SECONDS,
            2
        ),

        "runtime": "ONNX Runtime CPU",

        "error": model_error,
    }


# ============================================================
# ANALYZE AUDIO
# ============================================================

@app.post("/api/analyze")
async def analyze_audio(
    file: UploadFile = File(...)
):

    # --------------------------------------------------------
    # Check model
    # --------------------------------------------------------

    if onnx_session is None:

        raise HTTPException(

            status_code=503,

            detail=(
                "AASIST ONNX model is not available. "
                "Open /api/status and check the backend "
                "terminal for the model-loading error."
            ),
        )

    # --------------------------------------------------------
    # Validate filename
    # --------------------------------------------------------

    if not file.filename:

        raise HTTPException(

            status_code=400,

            detail="No audio file supplied.",
        )

    # --------------------------------------------------------
    # Read uploaded audio
    # --------------------------------------------------------

    try:

        audio_bytes = await file.read()

    except Exception as exc:

        raise HTTPException(

            status_code=400,

            detail=(
                "Could not read uploaded audio: "
                f"{exc}"
            ),
        )

    if not audio_bytes:

        raise HTTPException(

            status_code=400,

            detail="Uploaded audio file is empty.",
        )

    # --------------------------------------------------------
    # Prepare audio
    # --------------------------------------------------------

    (
        audio,
        duration,
        original_sample_rate,
        rms,
    ) = prepare_audio(
        audio_bytes
    )

    # --------------------------------------------------------
    # Run AASIST
    # --------------------------------------------------------

    result = run_aasist(
        audio
    )

    # --------------------------------------------------------
    # Confidence
    # --------------------------------------------------------

    confidence = max(

        result[
            "spoof_probability"
        ],

        result[
            "bonafide_probability"
        ],
    )

    # --------------------------------------------------------
    # Final API response
    # --------------------------------------------------------

    return {

        "success": True,

        "filename": file.filename,

        "audio_duration": round(
            duration,
            2
        ),

        "original_sample_rate": (
            original_sample_rate
        ),

        "processed_sample_rate": (
            TARGET_SAMPLE_RATE
        ),

        "audio_rms": round(
            rms,
            6
        ),

        "model": "AASIST ONNX",

        "raw_logits": (
            result[
                "raw_logits"
            ]
        ),

        "is_spoof": (
            result[
                "is_spoof"
            ]
        ),

        "risk_score": (
            result[
                "risk_score"
            ]
        ),

        "risk_level": (
            result[
                "risk_level"
            ]
        ),

        "spoof_probability": (
            result[
                "spoof_probability"
            ]
        ),

        "bonafide_probability": (
            result[
                "bonafide_probability"
            ]
        ),

        "confidence": round(
            confidence,
            2
        ),

        "message": (
            result[
                "message"
            ]
        ),

        "recommendation": (
            result[
                "recommendation"
            ]
        ),

        "analysis_window_seconds": round(
            WINDOW_SECONDS,
            2
        ),

        "disclaimer": (
            "VoxGuard provides an AI-based "
            "anti-spoofing risk signal. "
            "It is not definitive proof of "
            "caller identity or fraud."
        ),
    }


# ============================================================
# SERVER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(

        "main:app",

        host="0.0.0.0",

        port=8000,

        reload=True,
    )