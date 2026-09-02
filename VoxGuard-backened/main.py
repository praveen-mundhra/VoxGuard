import io
import os
from pathlib import Path

import av
import numpy as np
import onnxruntime as ort

from fastapi import FastAPI, File, UploadFile, HTTPException
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

# Silence threshold
SILENCE_RMS_THRESHOLD = 0.003


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
    audio_bytes: bytes
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
    # Normalize
    # --------------------------------------------------------

    audio = normalize_audio(
        audio
    )

    # --------------------------------------------------------
    # Duration
    # --------------------------------------------------------

    duration = (
        len(audio)
        / TARGET_SAMPLE_RATE
    )

    # --------------------------------------------------------
    # Validate minimum duration
    # --------------------------------------------------------

    if duration < MIN_AUDIO_SECONDS:

        raise HTTPException(

            status_code=400,

            detail=(
                f"Please provide at least "
                f"{MIN_AUDIO_SECONDS:.0f} seconds "
                "of speech."
            ),
        )

    # --------------------------------------------------------
    # Limit duration
    # --------------------------------------------------------

    if duration > MAX_AUDIO_SECONDS:

        max_samples = int(
            MAX_AUDIO_SECONDS
            * TARGET_SAMPLE_RATE
        )

        audio = audio[
            :max_samples
        ]

        duration = (
            len(audio)
            / TARGET_SAMPLE_RATE
        )

    # --------------------------------------------------------
    # Silence detection
    # --------------------------------------------------------

    rms = float(
        np.sqrt(
            np.mean(
                np.square(audio)
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
        audio,
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