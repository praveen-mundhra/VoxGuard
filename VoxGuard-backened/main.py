import io
import json
import os
import re
import time
import hashlib
from pathlib import Path

import av
import numpy as np
import onnxruntime as ort

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from fraud_engine import classify_transcript
from incidents import build_family_sos, build_incident_card, build_incident_payload
from registry import TelecomRegistryService


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

# Persistent raw-PCM streaming analysis window.
STREAM_CHUNK_SECONDS = 0.2
STREAM_WINDOW_SECONDS = 1.5
STREAM_CHUNK_SAMPLES = int(TARGET_SAMPLE_RATE * STREAM_CHUNK_SECONDS)
STREAM_WINDOW_SAMPLES = int(TARGET_SAMPLE_RATE * STREAM_WINDOW_SECONDS)

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

registry_service = TelecomRegistryService()


class TranscriptRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=20_000)


class RegistryNumberRequest(BaseModel):
    phone_number: str = Field(min_length=7, max_length=20)


class DeviceRequest(BaseModel):
    imei: str | None = Field(default=None, max_length=32)
    device_id: str | None = Field(default=None, max_length=128)


class IncidentRequest(BaseModel):
    transcript_analysis: dict
    caller_number: str | None = Field(default=None, max_length=20)
    call_started_at: str | None = None
    victim_consent: bool = False
    active_debit: bool = False


class SosRequest(BaseModel):
    guardian_contact: str = Field(min_length=3, max_length=160)
    call_details: dict = Field(default_factory=dict)
    language: str = "hi"


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
# The five "layers" below are classic, deterministic signal
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
# LAYER 4 — VOICE PRESENCE
# ------------------------------------------------------------

def compute_voice_presence_layer(raw_audio, sample_rate=TARGET_SAMPLE_RATE):
    """Estimate how much of the sample contains an audible voice."""

    audio = np.asarray(raw_audio, dtype=np.float32)

    frame_len = int(sample_rate * 0.03)
    hop_len = int(sample_rate * 0.01)
    frames = frame_signal(audio, frame_len, hop_len)
    frame_rms = np.sqrt(np.mean(np.square(frames), axis=1) + 1e-12)

    # Use the quietest frames as a recording-specific noise floor so the
    # percentage remains useful across microphones and input gain levels.
    noise_floor = float(np.percentile(frame_rms, 10))
    speech_reference = float(np.percentile(frame_rms, 60))
    threshold = max(speech_reference * 0.35, 1e-5)
    voiced_ratio = float(np.mean(frame_rms > threshold))
    voice_presence_pct = _clamp(voiced_ratio * 100)

    if voice_presence_pct >= 60:
        status = "pass"
        verdict = "Voice is present throughout most of the analyzed sample."
    elif voice_presence_pct >= 35:
        status = "caution"
        verdict = "Voice is present, but the sample includes notable pauses or background audio."
    else:
        status = "flag"
        verdict = "Only a small portion of the analyzed sample contains an audible voice."

    return {
        "name": "Voice Presence",
        "score": round(voice_presence_pct, 1),
        "status": status,
        "voice_presence_pct": round(voice_presence_pct, 1),
        "verdict": verdict,
        "metrics": {
            "voiced_frames_pct": round(voice_presence_pct, 1),
            "noise_floor_rms": round(noise_floor, 5),
        },
    }


def compute_explainability_metadata(raw_audio, sample_rate=TARGET_SAMPLE_RATE):
    """Return timestamped, heuristic evidence supporting the analysis."""

    audio = np.asarray(raw_audio, dtype=np.float32)
    events = []

    def add_event(tag, timestamp, evidence, severity="caution", end_timestamp=None):
        event = {
            "tag": tag,
            "timestamp_seconds": round(float(timestamp), 3),
            "severity": severity,
            "evidence": evidence,
        }
        if end_timestamp is not None:
            event["timestamp_end_seconds"] = round(float(end_timestamp), 3)
        events.append(event)

    frame_len = int(sample_rate * 0.032)
    hop_len = int(sample_rate * 0.016)
    frames = frame_signal(audio, frame_len, hop_len)
    window = np.hamming(frame_len).astype(np.float32)
    spectra = np.abs(np.fft.rfft(frames * window[None, :], axis=1)) + 1e-8
    normalized_spectra = spectra / np.sum(spectra, axis=1, keepdims=True)

    if len(normalized_spectra) > 1:
        spectral_flux = np.mean(
            np.maximum(normalized_spectra[1:] - normalized_spectra[:-1], 0),
            axis=1,
        )
        flux_threshold = max(float(np.percentile(spectral_flux, 97)), 0.08)
        discontinuities = np.flatnonzero(spectral_flux >= flux_threshold)
        for frame_index in discontinuities[:5]:
            timestamp = (frame_index + 1) * hop_len / sample_rate
            add_event(
                "spectral_discontinuity",
                timestamp,
                f"Spectral flux {spectral_flux[frame_index]:.3f} exceeded the {flux_threshold:.3f} event threshold.",
            )

    frame_rms = np.sqrt(np.mean(np.square(frames), axis=1) + 1e-12)
    silence_threshold = max(float(np.percentile(frame_rms, 10)) * 1.8, 1e-5)
    voiced = frame_rms > silence_threshold
    silence_ratio = float(np.mean(~voiced))
    if silence_ratio < 0.08 and len(audio) / sample_rate >= 1.0:
        add_event(
            "missing_breath_cycles",
            0.0,
            f"Only {silence_ratio * 100:.1f}% of frames contained pause-like low energy.",
        )

    p95 = float(np.percentile(np.abs(audio), 95) + 1e-6)
    p20 = float(np.percentile(np.abs(audio), 20) + 1e-6)
    dynamic_range_db = float(20 * np.log10(p95 / p20))
    mean_spectrum = np.mean(spectra, axis=0)
    freqs = np.fft.rfftfreq(frame_len, d=1.0 / sample_rate)
    high_freq_ratio = float(np.sum(mean_spectrum[freqs > 7000]) / np.sum(mean_spectrum))
    if dynamic_range_db < 8.0 or high_freq_ratio < 0.01:
        add_event(
            "replay_acoustic_mismatch",
            0.0,
            f"Dynamic range {dynamic_range_db:.1f} dB and high-frequency energy {high_freq_ratio * 100:.2f}% suggest an acoustically constrained capture.",
        )

    return {
        "events": events,
        "reason_tags": [
            f"{event['tag']} at {event['timestamp_seconds']:.3f}s"
            for event in events
        ],
        "timestamp_basis": "Audio-relative seconds; event timestamps identify frame starts.",
        "heuristic": True,
    }


SCAM_KEYWORD_ALIASES = {
    "UPI PIN": ("upi pin", "upi mpin", "upi pin number", "yupi pin"),
    "Digital Arrest": ("digital arrest", "digital rest", "digital arest"),
    "CBI": ("cbi", "c b i", "see b i", "cbee eye"),
    "KYC update": ("kyc update", "kyc updation", "kyc renewal", "kyc"),
    "police verification": (
        "police verification",
        "police verify",
        "police varification",
    ),
}


def compute_scam_keyword_layer(transcript, explainability, duration_seconds):
    """Spot scam-script phrases in supplied text or phonetic ASR output."""

    normalized_transcript = re.sub(
        r"[^a-z0-9]+", " ", (transcript or "").lower()
    ).strip()
    normalized_transcript = re.sub(r"\s+", " ", normalized_transcript)
    matches = []

    for keyword, aliases in SCAM_KEYWORD_ALIASES.items():
        matched_alias = next(
            (alias for alias in aliases if f" {alias} " in f" {normalized_transcript} "),
            None,
        )
        if matched_alias:
            matches.append({
                "keyword": keyword,
                "matched_text": matched_alias,
                "detection_method": "text_or_phonetic_transcript",
                "timestamp_seconds": 0.0,
                "timestamp_end_seconds": round(float(duration_seconds), 3),
            })

    acoustic_anomaly = bool(explainability.get("events"))
    keyword_count = len(matches)
    base_boost = min(keyword_count * 12.0, 36.0)
    cooccurrence_boost = 20.0 if keyword_count and acoustic_anomaly else 0.0

    return {
        "matched": bool(matches),
        "matched_keywords": matches,
        "acoustic_anomaly_cooccurrence": acoustic_anomaly and bool(matches),
        "risk_boost": round(base_boost + cooccurrence_boost, 1),
        "timestamp_basis": (
            "Sample-level transcript timing; provide word-level ASR timestamps "
            "to localize individual keywords."
        ),
    }


def compute_fraud_risk(result, scam_keyword_layer):
    """Combine model spoof risk with bounded scam-script evidence."""

    fraud_risk_score = _clamp(
        result["risk_score"] + scam_keyword_layer["risk_boost"]
    )
    if fraud_risk_score >= 75:
        fraud_risk_level = "HIGH"
    elif fraud_risk_score >= 50:
        fraud_risk_level = "MEDIUM"
    else:
        fraud_risk_level = "LOW"

    return round(fraud_risk_score, 1), fraud_risk_level


# ------------------------------------------------------------
# LAYER 5 — SPEAKER VERIFICATION
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
# REAL-TIME PCM STREAMING
# ============================================================

class PCMStreamRingBuffer:
    """Fixed-size FIFO ring buffer for one mono PCM stream."""

    def __init__(self, capacity):
        self._buffer = np.zeros(capacity, dtype=np.float32)
        self._capacity = capacity
        self._size = 0
        self._write_index = 0

    @property
    def size(self):
        return self._size

    def append(self, samples):
        samples = np.asarray(samples, dtype=np.float32).reshape(-1)

        if samples.size >= self._capacity:
            self._buffer[:] = samples[-self._capacity:]
            self._size = self._capacity
            self._write_index = 0
            return

        first_count = min(samples.size, self._capacity - self._write_index)
        self._buffer[self._write_index:self._write_index + first_count] = samples[:first_count]
        remaining = samples.size - first_count

        if remaining:
            self._buffer[:remaining] = samples[first_count:]

        self._write_index = (self._write_index + samples.size) % self._capacity
        self._size = min(self._capacity, self._size + samples.size)

    def latest(self, count):
        if count > self._size:
            raise ValueError("Not enough samples in the PCM ring buffer.")

        start = (self._write_index - count) % self._capacity
        if start + count <= self._capacity:
            return self._buffer[start:start + count].copy()

        first_count = self._capacity - start
        return np.concatenate((self._buffer[start:], self._buffer[:count - first_count]))


def decode_pcm_stream_chunk(payload, sample_rate, channels, encoding):
    """Decode one binary WebSocket message into mono 16 kHz float audio."""

    if payload[:4] == b"RIFF" and payload[8:12] == b"WAVE":
        audio, original_rate = decode_audio(payload)
        if original_rate != TARGET_SAMPLE_RATE:
            audio = resample_audio(audio, original_rate)
        return audio

    if sample_rate != TARGET_SAMPLE_RATE:
        raise ValueError("Raw PCM stream must use a 16000 Hz sample rate.")

    if channels < 1:
        raise ValueError("PCM channel count must be at least 1.")

    if encoding == "pcm_s16le":
        bytes_per_sample = 2
        dtype = np.dtype("<i2")
        scale = 32768.0
    elif encoding == "pcm_f32le":
        bytes_per_sample = 4
        dtype = np.dtype("<f4")
        scale = 1.0
    else:
        raise ValueError("Encoding must be pcm_s16le or pcm_f32le.")

    bytes_per_frame = bytes_per_sample * channels
    if len(payload) % bytes_per_frame:
        raise ValueError("PCM chunk ends mid-sample or mid-channel frame.")

    samples = np.frombuffer(payload, dtype=dtype).astype(np.float32) / scale
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)

    return samples


def analyze_stream_window(window, transcript=None):
    """Run the existing detector over one 1.5-second stream window."""

    normalized = normalize_audio(window)
    india_fraud_analysis = classify_transcript(transcript or "")
    result = run_aasist(normalized)
    voice_analysis = compute_voice_presence_layer(window)
    explainability = compute_explainability_metadata(window)
    scam_keyword_analysis = compute_scam_keyword_layer(
        transcript,
        explainability,
        STREAM_WINDOW_SECONDS,
    )
    fraud_risk_score, fraud_risk_level = compute_fraud_risk(
        result,
        scam_keyword_analysis,
    )
    confidence = max(result["spoof_probability"], result["bonafide_probability"])

    return {
        "success": True,
        "model": "AASIST ONNX",
        "window_seconds": STREAM_WINDOW_SECONDS,
        "processed_sample_rate": TARGET_SAMPLE_RATE,
        "raw_logits": result["raw_logits"],
        "is_spoof": result["is_spoof"],
        "risk_score": result["risk_score"],
        "risk_level": result["risk_level"],
        "spoof_probability": result["spoof_probability"],
        "bonafide_probability": result["bonafide_probability"],
        "confidence": round(confidence, 2),
        "message": result["message"],
        "recommendation": result["recommendation"],
        "voice_analysis": voice_analysis,
        "explainability": explainability,
        "scam_keyword_analysis": scam_keyword_analysis,
        "fraud_risk_score": fraud_risk_score,
        "fraud_risk_level": fraud_risk_level,
        "india_fraud_analysis": india_fraud_analysis,
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


@app.post("/api/fraud/classify")
async def classify_fraud(request: TranscriptRequest):
    return {"success": True, "analysis": classify_transcript(request.transcript)}


@app.post("/api/registry/number")
async def verify_number(request: RegistryNumberRequest):
    return {"success": True, "verification": await registry_service.verify_number(request.phone_number)}


@app.post("/api/registry/device")
async def verify_device(request: DeviceRequest):
    if not request.imei and not request.device_id:
        raise HTTPException(status_code=400, detail="Provide an IMEI or device identifier.")
    return {"success": True, "verification": await registry_service.validate_ceir_device(request.imei, request.device_id)}


@app.post("/api/incidents")
async def create_incident(request: IncidentRequest):
    try:
        payload = build_incident_payload(
            transcript_analysis=request.transcript_analysis,
            caller_number=request.caller_number,
            call_started_at=request.call_started_at,
            victim_consent=request.victim_consent,
            active_debit=request.active_debit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    payload["incident_card"] = build_incident_card(
        incident_id=payload["incident_id"],
        active_debit=request.active_debit,
        risk_level=str(request.transcript_analysis.get("level", "caution")),
        caller_number=request.caller_number,
    )
    return {"success": True, "incident": payload}


@app.post("/api/family/sos")
async def family_sos(request: SosRequest):
    return {"success": True, "sos": build_family_sos(**request.model_dump())}


# ============================================================
# REAL-TIME PCM WEBSOCKET
# ============================================================

@app.websocket("/api/analyze/stream")
async def analyze_pcm_stream(websocket: WebSocket):
    """Accept raw PCM/WAV messages and emit sliding-window analyses."""

    await websocket.accept()

    if onnx_session is None:
        await websocket.send_json({
            "success": False,
            "error": "AASIST ONNX model is not available.",
        })
        await websocket.close(code=1013)
        return

    sample_rate = TARGET_SAMPLE_RATE
    channels = 1
    encoding = "pcm_s16le"
    transcript = None
    ring_buffer = PCMStreamRingBuffer(STREAM_WINDOW_SAMPLES)
    total_samples = 0
    next_analysis_sample = STREAM_WINDOW_SAMPLES

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            if message.get("text") is not None:
                try:
                    control = json.loads(message["text"])
                    if control.get("type") == "config":
                        sample_rate = int(control.get("sample_rate", sample_rate))
                        channels = int(control.get("channels", channels))
                        encoding = control.get("encoding", encoding)
                        transcript = control.get("transcript", transcript)
                        await websocket.send_json({
                            "success": True,
                            "type": "config_ack",
                            "sample_rate": sample_rate,
                            "channels": channels,
                            "encoding": encoding,
                        })
                    elif control.get("type") == "transcript":
                        transcript = control.get("text", "")
                    continue
                except (json.JSONDecodeError, TypeError, ValueError) as exc:
                    await websocket.send_json({"success": False, "error": f"Invalid stream control message: {exc}"})
                    continue

            payload = message.get("bytes")
            if not payload:
                continue

            try:
                samples = decode_pcm_stream_chunk(payload, sample_rate, channels, encoding)
            except (HTTPException, ValueError) as exc:
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                await websocket.send_json({"success": False, "error": detail})
                continue

            ring_buffer.append(samples)
            total_samples += samples.size

            while total_samples >= next_analysis_sample:
                analysis = analyze_stream_window(
                    ring_buffer.latest(STREAM_WINDOW_SAMPLES),
                    transcript,
                )
                analysis["type"] = "analysis"
                analysis["stream_sample_end"] = next_analysis_sample
                analysis["stream_seconds"] = round(next_analysis_sample / TARGET_SAMPLE_RATE, 3)
                await websocket.send_json(analysis)
                next_analysis_sample += STREAM_CHUNK_SAMPLES

    except WebSocketDisconnect:
        pass


# ============================================================
# ANALYZE AUDIO
# ============================================================

@app.post("/api/analyze")
async def analyze_audio(
    file: UploadFile = File(...),
    transcript: str | None = Form(default=None),
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
        raw_audio,
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

    voice_analysis = compute_voice_presence_layer(
        raw_audio
    )

    explainability = compute_explainability_metadata(
        raw_audio
    )
    scam_keyword_analysis = compute_scam_keyword_layer(
        transcript,
        explainability,
        duration,
    )
    fraud_risk_score, fraud_risk_level = compute_fraud_risk(
        result,
        scam_keyword_analysis,
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

        "voice_analysis": voice_analysis,

        "explainability": explainability,

        "scam_keyword_analysis": scam_keyword_analysis,

        "fraud_risk_score": fraud_risk_score,

        "fraud_risk_level": fraud_risk_level,

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
# LIVE AUDIO ANALYSIS
# ============================================================

@app.post("/api/analyze/live")
async def analyze_live_audio(
    file: UploadFile = File(...),
    transcript: str | None = Form(default=None),
):
    """Analyze a rolling recording while the caller is speaking."""

    if onnx_session is None:
        raise HTTPException(
            status_code=503,
            detail="AASIST ONNX model is not available.",
        )

    audio_bytes = await file.read()

    if not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail="Live audio chunk is empty.",
        )

    audio, raw_audio, duration, original_sample_rate, rms = prepare_audio(
        audio_bytes,
        min_seconds=MIN_AUDIO_SECONDS,
        max_seconds=MAX_AUDIO_SECONDS,
    )
    result = run_aasist(audio)
    voice_analysis = compute_voice_presence_layer(raw_audio)
    explainability = compute_explainability_metadata(raw_audio)
    scam_keyword_analysis = compute_scam_keyword_layer(
        transcript,
        explainability,
        duration,
    )
    fraud_risk_score, fraud_risk_level = compute_fraud_risk(
        result,
        scam_keyword_analysis,
    )
    confidence = max(
        result["spoof_probability"],
        result["bonafide_probability"],
    )

    return {
        "success": True,
        "filename": file.filename or "live-recording.webm",
        "audio_duration": round(duration, 2),
        "original_sample_rate": original_sample_rate,
        "processed_sample_rate": TARGET_SAMPLE_RATE,
        "audio_rms": round(rms, 6),
        "model": "AASIST ONNX",
        "raw_logits": result["raw_logits"],
        "is_spoof": result["is_spoof"],
        "risk_score": result["risk_score"],
        "risk_level": result["risk_level"],
        "spoof_probability": result["spoof_probability"],
        "bonafide_probability": result["bonafide_probability"],
        "confidence": round(confidence, 2),
        "message": result["message"],
        "recommendation": result["recommendation"],
        "voice_analysis": voice_analysis,
        "explainability": explainability,
        "scam_keyword_analysis": scam_keyword_analysis,
        "fraud_risk_score": fraud_risk_score,
        "fraud_risk_level": fraud_risk_level,
        "analysis_window_seconds": round(WINDOW_SECONDS, 2),
        "live": True,
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