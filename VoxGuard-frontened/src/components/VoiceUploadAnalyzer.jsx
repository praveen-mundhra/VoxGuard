import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileAudio,
  LoaderCircle,
  ShieldAlert,
  Upload,
  X,
  Clock3,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { API_BASE, authHeaders } from "../config";

const API = API_BASE;

const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Supported audio formats
const ACCEPTED_TYPES = ".wav,.mp3,.m4a,.flac,.ogg,.webm,audio/*";

// IMPORTANT:
// Normal audio analysis requires only 5 seconds.
// The 55-second requirement belongs ONLY to authentication/reference
// voice enrollment and is handled separately by the backend.
const MINIMUM_ANALYSIS_SECONDS = 5;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clampPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, number));
}

function toPercentage(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  // Backend may return either:
  // 0.0 - 1.0
  // OR
  // 0 - 100
  return clampPercentage(number <= 1 ? number * 100 : number);
}

function formatPercentage(value) {
  return `${Math.round(clampPercentage(value))}%`;
}

/* -------------------------------------------------------------------------- */
/* Normalize backend response                                                 */
/* -------------------------------------------------------------------------- */

function normalizeResult(data) {
  const risk = data?.risk || {};
  const deepfake = data?.deepfake || {};
  const speaker = data?.speaker || {};
  const scam = data?.scam || {};
  const transcript = data?.transcript || {};
  const signals = data?.signals || {};
  const context = data?.context || {};

  /*
   * Risk score
   */
  const rawRiskScore =
    risk.risk_score ??
    risk.score ??
    data?.risk_score ??
    deepfake.deepfake_risk ??
    0;

  const riskScore = toPercentage(rawRiskScore);

  /*
   * Deepfake / spoof probability
   */
  const spoofProbability = toPercentage(
    deepfake.spoof_probability ??
      deepfake.spoofProbability ??
      data?.spoof_probability ??
      0
  );

  /*
   * Speaker similarity
   */
  const speakerSimilarity =
    speaker.similarity ??
    speaker.speaker_similarity ??
    data?.speaker_similarity ??
    null;

  const speakerMatch =
    speakerSimilarity == null
      ? null
      : toPercentage(speakerSimilarity);

  /*
   * Scam risk
   */
  const scamRisk = toPercentage(
    scam.scam_risk ??
      scam.risk ??
      data?.scam_risk ??
      0
  );

  /*
   * Deepfake result
   */
  const isSpoof = Boolean(
    deepfake.is_spoof ??
      deepfake.isSpoof ??
      data?.is_spoof ??
      spoofProbability >= 50
  );

  /*
   * Risk level
   */
  let riskLevel =
    risk.risk_level ||
    risk.level ||
    data?.risk_level ||
    "";

  if (!riskLevel) {
    if (riskScore >= 70) {
      riskLevel = "HIGH";
    } else if (riskScore >= 40) {
      riskLevel = "MEDIUM";
    } else {
      riskLevel = "LOW";
    }
  }

  /*
   * Action
   */
  const action =
    risk.action ||
    data?.action ||
    (riskScore >= 70
      ? "BLOCK / VERIFY"
      : riskScore >= 40
        ? "VERIFY"
        : "MONITOR");

  /*
   * Recommendation
   */
  let recommendation =
    risk.action_message ||
    risk.recommendation ||
    data?.recommendation ||
    data?.message ||
    "";

  if (!recommendation) {
    if (riskScore >= 70 || isSpoof) {
      recommendation =
        "Do not trust the voice alone. Stop sensitive actions and verify the caller through an independent channel.";
    } else if (riskScore >= 40) {
      recommendation =
        "Use secondary verification before sharing sensitive information or approving transactions.";
    } else {
      recommendation =
        "Voice appears low risk. Continue monitoring and use secondary verification for high-value actions.";
    }
  }

  /*
   * Signal percentages
   *
   * We first use explicit backend signal values.
   * If the backend does not provide a particular signal, keep it null
   * rather than inventing a percentage.
   */

  const acousticAuthenticity =
    signals.acoustic_authenticity ??
    signals.acousticAuthenticity ??
    deepfake.acoustic_authenticity ??
    deepfake.acousticAuthenticity ??
    data?.acoustic_authenticity ??
    null;

  const spectralArtifacts =
    signals.spectral_artifacts ??
    signals.spectralArtifacts ??
    deepfake.spectral_artifacts ??
    deepfake.spectralArtifacts ??
    data?.spectral_artifacts ??
    null;

  const prosodyConsistency =
    signals.prosody_consistency ??
    signals.prosodyConsistency ??
    deepfake.prosody_consistency ??
    deepfake.prosodyConsistency ??
    data?.prosody_consistency ??
    null;

  const speakerIdentityMatch =
    signals.speaker_identity_match ??
    signals.speakerIdentityMatch ??
    speaker.speaker_identity_match ??
    speaker.speakerIdentityMatch ??
    speakerSimilarity ??
    null;

  const contextualFraudSignal =
    signals.contextual_fraud_signal ??
    signals.contextualFraudSignal ??
    scam.contextual_fraud_signal ??
    scam.contextualFraudSignal ??
    context.fraud_signal ??
    context.fraudSignal ??
    data?.contextual_fraud_signal ??
    null;

  return {
    is_spoof: isSpoof,

    risk_score: Math.round(riskScore),

    confidence: Math.round(
      clampPercentage(
        data?.confidence ??
          deepfake.confidence ??
          100 - riskScore
      )
    ),

    recommendation,

    risk_level: String(riskLevel).toUpperCase(),

    action,

    spoof_probability: spoofProbability / 100,

    speaker_similarity:
      speakerSimilarity == null
        ? null
        : Number(speakerSimilarity),

    speaker_status:
      speaker.status ||
      speaker.verification_status ||
      data?.speaker_status ||
      null,

    scam_risk: scamRisk / 100,

    scam_vectors:
      scam.detected_vectors ||
      scam.vectors ||
      data?.scam_vectors ||
      [],

    transcript:
      transcript.text ||
      transcript.transcription ||
      data?.text ||
      data?.transcript ||
      "",

    /*
     * Signals used by LiveDemo.jsx
     */
    signals: {
      acoustic_authenticity:
        acousticAuthenticity == null
          ? null
          : toPercentage(acousticAuthenticity),

      spectral_artifacts:
        spectralArtifacts == null
          ? null
          : toPercentage(spectralArtifacts),

      prosody_consistency:
        prosodyConsistency == null
          ? null
          : toPercentage(prosodyConsistency),

      speaker_identity_match:
        speakerIdentityMatch == null
          ? null
          : toPercentage(speakerIdentityMatch),

      contextual_fraud_signal:
        contextualFraudSignal == null
          ? null
          : toPercentage(contextualFraudSignal),
    },

    raw: data,
  };
}

/* -------------------------------------------------------------------------- */
/* Recommended actions                                                        */
/* -------------------------------------------------------------------------- */

function getRecommendedActions(result) {
  if (!result) {
    return [];
  }

  const risk = Number(result.risk_score || 0);
  const spoof = Number(result.spoof_probability || 0) * 100;
  const scam = Number(result.scam_risk || 0) * 100;

  if (risk >= 70 || spoof >= 70) {
    return [
      {
        title: "Do not trust the voice alone",
        description:
          "Treat the caller as potentially impersonated or AI-generated.",
        icon: ShieldAlert,
      },
      {
        title: "Verify through another channel",
        description:
          "Call the person back using a previously saved number or another trusted channel.",
        icon: ShieldCheck,
      },
      {
        title: "Pause sensitive transactions",
        description:
          "Do not approve payments, OTPs, credentials or account changes based only on this call.",
        icon: AlertTriangle,
      },
      {
        title: "Report suspicious activity",
        description:
          "Escalate the incident if the caller is requesting money, credentials or urgent action.",
        icon: ShieldAlert,
      },
    ];
  }

  if (risk >= 40 || scam >= 50) {
    return [
      {
        title: "Perform secondary verification",
        description:
          "Confirm the caller's identity using an independent trusted channel.",
        icon: ShieldCheck,
      },
      {
        title: "Avoid sharing sensitive information",
        description:
          "Do not provide passwords, OTPs, banking details or confidential information.",
        icon: AlertTriangle,
      },
      {
        title: "Monitor the conversation",
        description:
          "Look for urgency, unusual requests or changes in normal communication behaviour.",
        icon: ShieldAlert,
      },
    ];
  }

  return [
    {
      title: "Continue monitoring",
      description:
        "The current sample shows relatively low impersonation risk.",
      icon: ShieldCheck,
    },
    {
      title: "Use secondary verification for high-value actions",
      description:
        "For financial or sensitive requests, independently confirm the caller.",
      icon: ShieldCheck,
    },
    {
      title: "Stay alert to social-engineering signals",
      description:
        "Do not rely only on voice familiarity when approving sensitive requests.",
      icon: AlertTriangle,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function VoiceUploadAnalyzer({
  onAnalysisComplete,
}) {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);

  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  /* ---------------------------------------------------------------------- */
  /* Cleanup object URL                                                     */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /* ---------------------------------------------------------------------- */
  /* Choose file                                                            */
  /* ---------------------------------------------------------------------- */

  const chooseFile = (selectedFile) => {
    setError("");
    setResult(null);
    setAudioDuration(0);

    if (!selectedFile) {
      return;
    }

    /* File size check */
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setPreviewUrl("");

      setError(
        "File is larger than 25 MB. Please choose a smaller voice sample."
      );

      return;
    }

    /* Basic audio type validation */
    const isAudio =
      selectedFile.type.startsWith("audio/") ||
      /\.(wav|mp3|m4a|flac|ogg|webm)$/i.test(
        selectedFile.name
      );

    if (!isAudio) {
      setFile(null);
      setPreviewUrl("");

      setError(
        "Please select a valid audio file such as WAV, MP3, M4A, FLAC, OGG or WEBM."
      );

      return;
    }

    /*
     * Temporary URL only for reading metadata.
     */
    const metadataUrl = URL.createObjectURL(selectedFile);

    const audio = document.createElement("audio");

    audio.preload = "metadata";

    audio.onloadedmetadata = () => {
      const duration = Number(audio.duration);

      URL.revokeObjectURL(metadataUrl);

      if (!Number.isFinite(duration) || duration <= 0) {
        setFile(null);
        setPreviewUrl("");
        setAudioDuration(0);

        setError(
          "Could not determine the audio duration."
        );

        return;
      }

      /*
       * IMPORTANT:
       * Audio analysis requires ONLY 5 seconds.
       *
       * Do NOT change this to 55.
       * The 55-second requirement is only for authentication/
       * reference voice enrollment.
       */
      if (duration < MINIMUM_ANALYSIS_SECONDS) {
        setFile(null);
        setPreviewUrl("");
        setAudioDuration(0);

        setError(
          `Audio analysis requires at least ${MINIMUM_ANALYSIS_SECONDS} seconds of audio. Your sample is ${duration.toFixed(
            1
          )} seconds.`
        );

        return;
      }

      /*
       * Remove previous preview URL.
       */
      setPreviewUrl((oldUrl) => {
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }

        return URL.createObjectURL(selectedFile);
      });

      setFile(selectedFile);
      setAudioDuration(duration);
      setError("");
    };

    audio.onerror = () => {
      URL.revokeObjectURL(metadataUrl);

      setFile(null);
      setPreviewUrl("");
      setAudioDuration(0);

      setError(
        "That audio file could not be read. Try another recording."
      );
    };

    audio.src = metadataUrl;
  };

  /* ---------------------------------------------------------------------- */
  /* Clear file                                                             */
  /* ---------------------------------------------------------------------- */

  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(null);
    setPreviewUrl("");
    setAudioDuration(0);
    setResult(null);
    setError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Analyze                                                                */
  /* ---------------------------------------------------------------------- */

  const analyze = async () => {
    if (!file) {
      return;
    }

    /*
     * Frontend safety check.
     */
    if (audioDuration < MINIMUM_ANALYSIS_SECONDS) {
      setError(
        `Audio analysis requires at least ${MINIMUM_ANALYSIS_SECONDS} seconds of audio.`
      );

      return;
    }

    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();

      formData.append("audio", file);

      /*
       * Existing backend endpoint.
       */
      const response = await fetch(
        `${API}/api/v1/voice/analyze`,
        {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        }
      );

      const contentType =
        response.headers.get("content-type") || "";

      const data = contentType.includes(
        "application/json"
      )
        ? await response.json()
        : {
            message: await response.text(),
          };

      /* Authentication failure */
      if (response.status === 401) {
        window.localStorage.removeItem(
          "voxguard_access_token"
        );

        setError(
          "Your session has expired. Please log in again."
        );

        setTimeout(() => {
          window.location.reload();
        }, 800);

        return;
      }

      /* Backend failure */
      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Voice analysis failed."
        );
      }

      /*
       * Convert backend response into one consistent structure.
       */
      const normalized = normalizeResult(data);

      setResult(normalized);

      /*
       * Send result to LiveDemo.jsx.
       *
       * This is important because LiveDemo can now update:
       * - circular impersonation risk
       * - percentage bars
       * - recommended actions
       * - activity/history
       */
      onAnalysisComplete?.({
        id:
          typeof crypto !== "undefined" &&
          crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,

        createdAt: new Date().toISOString(),

        fileName: file.name,

        audioUrl: previewUrl,

        duration_seconds: audioDuration,

        result: normalized,
      });
    } catch (err) {
      console.error(
        "Voice sample analysis error:",
        err
      );

      const message = String(
        err?.message || ""
      );

      setError(
        message.includes("Failed to fetch")
          ? "Cannot connect to VoxGuard AI backend. Make sure the FastAPI server is running on http://localhost:8000."
          : message ||
              "Voice analysis failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const recommendedActions =
    result
      ? getRecommendedActions(result)
      : [];

  /* ---------------------------------------------------------------------- */
  /* UI                                                                      */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="mt-10 rounded-3xl border border-cyan-500/20 bg-[#0c121e]/90 p-6 shadow-2xl backdrop-blur-xl md:p-8">

      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            <FileAudio className="h-4 w-4" />

            Upload & Analyze Voice
          </div>

          <h3 className="mt-3 text-2xl font-black text-white md:text-3xl">
            Test a recorded voice sample
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Upload a voice recording and Swaraksha will
            analyze it for AI-generated speech,
            speaker consistency, scam signals,
            transcription and impersonation risk.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5 text-xs font-semibold text-cyan-300">
            Min 5 sec
          </span>

          <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-400">
            Max 25 MB
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Upload area                                                       */}
      {/* ---------------------------------------------------------------- */}

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);

          chooseFile(
            e.dataTransfer.files?.[0]
          );
        }}
        className={`mt-7 rounded-2xl border-2 border-dashed p-7 text-center transition-all ${
          dragActive
            ? "border-cyan-400 bg-cyan-400/10"
            : "border-slate-700 bg-slate-950/40 hover:border-cyan-500/50 hover:bg-slate-900/60"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => {
            chooseFile(
              e.target.files?.[0]
            );
          }}
        />

        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
          <Upload className="h-6 w-6" />
        </div>

        <p className="mt-4 font-semibold text-white">
          Drag & drop your voice sample here
        </p>

        <p className="mt-1 text-xs text-slate-500">
          WAV, MP3, M4A, FLAC, OGG or WEBM
        </p>

        <p className="mt-2 text-xs text-cyan-400/80">
          At least 5 seconds required for audio analysis
        </p>

        <button
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
          className="mt-5 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
        >
          Choose audio file
        </button>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Selected file                                                     */}
      {/* ---------------------------------------------------------------- */}

      {file && (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">

              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-400/10 text-indigo-300">
                <FileAudio className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {file.name}
                </p>

                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>
                    {(file.size / 1024 / 1024).toFixed(
                      2
                    )}{" "}
                    MB
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />

                    {audioDuration.toFixed(1)} sec
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={clearFile}
                disabled={uploading}
                className="ml-auto rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Audio preview */}
          {previewUrl && (
            <audio
              className="mt-4 h-9 w-full"
              controls
              src={previewUrl}
            />
          )}

          {/* Analyze button */}
          <button
            type="button"
            onClick={analyze}
            disabled={
              uploading ||
              audioDuration < MINIMUM_ANALYSIS_SECONDS
            }
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />

                Analyzing with Swaraksha AI…
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />

                Analyze Voice Sample
              </>
            )}
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Error                                                             */}
      {/* ---------------------------------------------------------------- */}

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

          <span>{error}</span>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Analysis result                                                   */}
      {/* ---------------------------------------------------------------- */}

      {result && (
        <div
          className={`mt-5 rounded-2xl border p-5 ${
            result.is_spoof
              ? "border-rose-500/30 bg-rose-500/10"
              : "border-emerald-500/30 bg-emerald-500/10"
          }`}
        >
          <div className="flex items-start gap-3">

            {result.is_spoof ? (
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-300" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />
            )}

            <div className="min-w-0 flex-1">

              {/* Result heading */}
              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>
                  <p
                    className={`text-xs font-bold uppercase tracking-wider ${
                      result.is_spoof
                        ? "text-rose-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {result.risk_level} RISK
                  </p>

                  <h4 className="mt-1 text-lg font-black text-white">
                    {result.is_spoof
                      ? "Potential AI-generated voice detected"
                      : "Voice appears authentic"}
                  </h4>
                </div>

                <div className="text-right">
                  <span className="block text-xs uppercase tracking-wider text-slate-400">
                    Impersonation risk
                  </span>

                  <strong
                    className={`text-3xl font-black ${
                      result.is_spoof
                        ? "text-rose-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {result.risk_score}%
                  </strong>
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* Signal percentage bars                                   */}
              {/* -------------------------------------------------------- */}

              <div className="mt-6 grid gap-3 md:grid-cols-2">

                <SignalBar
                  label="Deepfake probability"
                  value={
                    result.spoof_probability *
                    100
                  }
                  danger
                />

                <SignalBar
                  label="Speaker identity match"
                  value={
                    result.signals
                      ?.speaker_identity_match
                  }
                />

                <SignalBar
                  label="Acoustic authenticity"
                  value={
                    result.signals
                      ?.acoustic_authenticity
                  }
                />

                <SignalBar
                  label="Spectral artifacts"
                  value={
                    result.signals
                      ?.spectral_artifacts
                  }
                />

                <SignalBar
                  label="Prosody consistency"
                  value={
                    result.signals
                      ?.prosody_consistency
                  }
                />

                <SignalBar
                  label="Contextual fraud signal"
                  value={
                    result.signals
                      ?.contextual_fraud_signal
                  }
                  danger
                />

                <SignalBar
                  label="Scam risk"
                  value={
                    result.scam_risk * 100
                  }
                  danger
                />

                <SignalBar
                  label="Overall impersonation risk"
                  value={result.risk_score}
                  danger={
                    result.risk_score >= 50
                  }
                />
              </div>

              {/* -------------------------------------------------------- */}
              {/* Compact metrics                                           */}
              {/* -------------------------------------------------------- */}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                <Metric
                  label="Deepfake"
                  value={formatPercentage(
                    result.spoof_probability *
                      100
                  )}
                />

                <Metric
                  label="Speaker match"
                  value={
                    result.speaker_similarity ==
                    null
                      ? "N/A"
                      : formatPercentage(
                          result.speaker_similarity
                        )
                  }
                />

                <Metric
                  label="Scam risk"
                  value={formatPercentage(
                    result.scam_risk * 100
                  )}
                />

                <Metric
                  label="Action"
                  value={result.action}
                />
              </div>

              {/* -------------------------------------------------------- */}
              {/* Transcript                                                */}
              {/* -------------------------------------------------------- */}

              {result.transcript && (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Transcript
                  </span>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {result.transcript}
                  </p>
                </div>
              )}

              {/* -------------------------------------------------------- */}
              {/* Recommended actions                                       */}
              {/* -------------------------------------------------------- */}

              <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-slate-950/50 p-5">

                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />

                  <div>
                    <h5 className="font-black text-white">
                      Recommended Actions
                    </h5>

                    <p className="mt-1 text-xs text-slate-500">
                      Suggested steps based on the current
                      voice-analysis result.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {recommendedActions.map(
                    (item, index) => {
                      const Icon = item.icon;

                      return (
                        <div
                          key={`${item.title}-${index}`}
                          className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                        >
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300">
                            <Icon className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="text-sm font-bold text-white">
                              {item.title}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* Main recommendation                                      */}
              {/* -------------------------------------------------------- */}

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-sm leading-6 text-slate-300">
                  <span className="font-semibold text-white">
                    Recommended action:
                  </span>{" "}
                  {result.recommendation}
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Signal Bar                                                                 */
/* -------------------------------------------------------------------------- */

function SignalBar({
  label,
  value,
  danger = false,
}) {
  const valid =
    value !== null &&
    value !== undefined &&
    Number.isFinite(Number(value));

  const percentage = valid
    ? clampPercentage(value)
    : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-300">
          {label}
        </span>

        <span
          className={`text-xs font-black ${
            valid
              ? danger
                ? "text-rose-300"
                : "text-cyan-300"
              : "text-slate-600"
          }`}
        >
          {valid
            ? `${Math.round(percentage)}%`
            : "N/A"}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            danger
              ? "bg-gradient-to-r from-amber-400 to-rose-500"
              : "bg-gradient-to-r from-cyan-400 to-indigo-500"
          }`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Metric                                                                     */
/* -------------------------------------------------------------------------- */

function Metric({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">

      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>

      <span className="mt-1 block truncate text-sm font-bold text-white">
        {value}
      </span>
    </div>
  );
}