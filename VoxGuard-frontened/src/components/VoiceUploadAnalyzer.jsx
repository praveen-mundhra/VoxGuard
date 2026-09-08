import { useRef, useState } from "react";
import {
  CheckCircle2,
  FileAudio,
  LoaderCircle,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import { API_BASE, authHeaders } from "../config";

const API = API_BASE;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ACCEPTED_TYPES = ".wav,.mp3,.m4a,.flac,.ogg,.webm,audio/*";

function normalizeResult(data) {
  const risk = data?.risk || {};
  const deepfake = data?.deepfake || {};
  const speaker = data?.speaker || {};
  const scam = data?.scam || {};
  const transcript = data?.transcript || {};

  const riskScore = Number(
    risk.risk_score ?? risk.score ?? data?.risk_score ?? deepfake.deepfake_risk ?? 0
  );
  const spoofProbability = Number(
    deepfake.spoof_probability ?? deepfake.spoofProbability ?? data?.spoof_probability ?? 0
  );

  return {
    is_spoof:
      Boolean(deepfake.is_spoof ?? data?.is_spoof ?? spoofProbability >= 0.5),
    risk_score: Math.round(riskScore <= 1 ? riskScore * 100 : riskScore),
    confidence: Number(
      data?.confidence ?? deepfake.confidence ?? Math.max(0, 100 - (riskScore <= 1 ? riskScore * 100 : riskScore))
    ),
    recommendation:
      risk.action ||
      data?.recommendation ||
      data?.message ||
      "Continue monitoring and use secondary verification for sensitive actions.",
    risk_level: risk.risk_level || risk.level || data?.risk_level || "LOW",
    action: risk.action || data?.action || "MONITOR",
    spoof_probability: spoofProbability,
    speaker_similarity: speaker.similarity,
    speaker_status: speaker.status,
    scam_risk: Number(scam.scam_risk ?? scam.risk ?? 0),
    scam_vectors: scam.detected_vectors || scam.vectors || [],
    transcript: transcript.text || data?.text || "",
  };
}

export default function VoiceUploadAnalyzer({ onAnalysisComplete }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const chooseFile = (selectedFile) => {
    setError("");
    setResult(null);

    if (!selectedFile) return;
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File is larger than 25 MB. Please choose a smaller voice sample.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const analyze = async () => {
    if (!file) return;

    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const response = await fetch(`${API}/api/v1/voice/analyze`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || "Voice analysis failed.");
      }

      const normalized = normalizeResult(data);
      setResult(normalized);

      onAnalysisComplete?.({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        fileName: file.name,
        audioUrl: previewUrl,
        result: normalized,
      });
    } catch (err) {
      setError(
        err?.message?.includes("Failed to fetch")
          ? "Cannot connect to VoxGuard AI backend. Start the FastAPI server on http://localhost:8000."
          : err.message || "Voice analysis failed."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-10 rounded-3xl border border-cyan-500/20 bg-[#0c121e]/90 p-6 shadow-2xl backdrop-blur-xl md:p-8">
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
            Upload a voice recording and VoxGuard will send it to the AI analysis pipeline for deepfake, speaker, transcript, scam and risk analysis.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-400">
          Max 25 MB
        </span>
      </div>

      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          chooseFile(e.dataTransfer.files?.[0]);
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
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />

        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">
          <Upload className="h-6 w-6" />
        </div>
        <p className="mt-4 font-semibold text-white">
          Drag & drop your voice sample here
        </p>
        <p className="mt-1 text-xs text-slate-500">WAV, MP3, M4A, FLAC, OGG or WEBM</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
        >
          Choose audio file
        </button>
      </div>

      {file && (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-400/10 text-indigo-300">
                <FileAudio className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                <p className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
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

          {previewUrl && (
            <audio className="mt-4 h-9 w-full" controls src={previewUrl} />
          )}

          <button
            type="button"
            onClick={analyze}
            disabled={uploading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Analyzing with VoxGuard AI…
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

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <div className={`mt-5 rounded-2xl border p-5 ${result.is_spoof ? "border-rose-500/30 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
          <div className="flex items-start gap-3">
            {result.is_spoof ? (
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-300" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider ${result.is_spoof ? "text-rose-300" : "text-emerald-300"}`}>
                    {result.risk_level} RISK
                  </p>
                  <h4 className="mt-1 text-lg font-black text-white">
                    {result.is_spoof ? "Potential AI-generated voice detected" : "Voice appears authentic"}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="block text-xs uppercase tracking-wider text-slate-400">Risk score</span>
                  <strong className={`text-3xl font-black ${result.is_spoof ? "text-rose-300" : "text-emerald-300"}`}>
                    {result.risk_score}%
                  </strong>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Deepfake" value={`${Math.round(result.spoof_probability * 100)}%`} />
                <Metric label="Speaker match" value={result.speaker_similarity == null ? "N/A" : `${Math.round(Number(result.speaker_similarity) * 100)}%`} />
                <Metric label="Scam risk" value={`${Math.round(result.scam_risk <= 1 ? result.scam_risk * 100 : result.scam_risk)}%`} />
                <Metric label="Action" value={result.action} />
              </div>

              {result.transcript && (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Transcript</span>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{result.transcript}</p>
                </div>
              )}

              <p className="mt-4 text-sm leading-6 text-slate-300">
                <span className="font-semibold text-white">Recommended action:</span> {result.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="mt-1 block truncate text-sm font-bold text-white">{value}</span>
    </div>
  );
}
