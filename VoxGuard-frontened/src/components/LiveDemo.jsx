import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Upload
} from "lucide-react";

export default function LiveDemo() {
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  /*
   * Start microphone recording
   */
  const startRecording = async () => {
    try {
      setError("");
      setResult(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType
        });

        await analyzeAudio(audioBlob);
      };

      recorder.start();

      setRecording(true);
    } catch (err) {
      console.error(err);

      setError(
        "Microphone access denied. Please allow microphone permission."
      );
    }
  };

  /*
   * Stop recording
   */
  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setAnalyzing(true);
    }
  };

  /*
   * Send audio to Python backend
   */
  const analyzeAudio = async (audioBlob) => {
    try {
      setAnalyzing(true);
      setError("");

      const formData = new FormData();

      formData.append(
        "file",
        audioBlob,
        "voice.webm"
      );

      const response = await fetch(
        "http://localhost:8000/api/analyze",
        {
          method: "POST",
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error("Backend analysis failed");
      }

      const data = await response.json();

      setResult(data);
    } catch (err) {
      console.error(err);

      setError(
        "Could not analyze the audio. Make sure the Python backend is running."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  /*
   * Reset everything
   */
  const reset = () => {
    setResult(null);
    setError("");
    setRecording(false);
    setAnalyzing(false);
  };

  /*
   * Calculate gauge color
   */
  const getRiskColor = () => {
    if (!result) return "#22d3ee";

    if (result.risk_score >= 70) {
      return "#fb7185";
    }

    if (result.risk_score >= 40) {
      return "#fbbf24";
    }

    return "#34d399";
  };

  return (
    <section
      id="demo"
      className="mx-auto max-w-7xl px-5 py-24"
    >
      {/* Header */}

      <div className="mb-12 text-center">

        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300">
          <ShieldCheck size={15} />
          REAL AI VOICE DETECTION
        </div>

        <h2 className="mt-5 text-4xl font-black md:text-5xl">
          Test a voice in real time
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          Record a short voice sample and VoxGuard will send it
          to the AI anti-spoofing engine for analysis.
        </p>
      </div>

      {/* Main Card */}

      <div className="glass grid gap-10 rounded-3xl p-6 md:grid-cols-2 md:p-10">

        {/* LEFT */}

        <div className="flex flex-col items-center justify-center">

          {/* Gauge */}

          <div
            className="relative grid h-64 w-64 place-items-center rounded-full"
            style={{
              background: `conic-gradient(
                ${getRiskColor()}
                ${result?.risk_score || 0}%,
                #17283d 0
              )`
            }}
          >

            <div className="grid h-48 w-48 place-items-center rounded-full bg-[#091626]">

              <div className="text-center">

                <div className="text-6xl font-black">
                  {result
                    ? `${Math.round(result.risk_score)}%`
                    : "--"}
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  IMPERSONATION RISK
                </div>

              </div>

            </div>

          </div>

          {/* Status */}

          <div className="mt-7 text-center">

            {!result && !analyzing && (
              <p className="text-slate-400">
                Ready to analyze
              </p>
            )}

            {recording && (
              <p className="flex items-center gap-2 text-rose-300">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" />
                Recording microphone...
              </p>
            )}

            {analyzing && (
              <p className="flex items-center gap-2 text-cyan-300">
                <Loader2
                  size={17}
                  className="animate-spin"
                />
                AI analyzing voice...
              </p>
            )}

            {result && !analyzing && (
              <p
                className={
                  result.is_spoof
                    ? "font-bold text-rose-300"
                    : "font-bold text-emerald-300"
                }
              >
                {result.is_spoof
                  ? "⚠ Synthetic / cloned voice detected"
                  : "✓ Voice appears genuine"}
              </p>
            )}

          </div>

          {/* Buttons */}

          <div className="mt-7 flex flex-wrap justify-center gap-3">

            {!recording && !analyzing && (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-300"
              >
                <Mic size={18} />
                Start Recording
              </button>
            )}

            {recording && (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-xl bg-rose-500 px-6 py-3 font-bold text-white"
              >
                <Square size={17} />
                Stop & Analyze
              </button>
            )}

            {!recording && !analyzing && (
              <button
                onClick={reset}
                className="rounded-xl border border-slate-700 px-4 py-3"
              >
                <RotateCcw size={17} />
              </button>
            )}

          </div>

        </div>

        {/* RIGHT */}

        <div className="space-y-4">

          {/* Error */}

          {error && (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-300">
              {error}
            </div>
          )}

          {/* Result */}

          {result && (
            <>
              <div
                className={`rounded-2xl border p-6 ${
                  result.is_spoof
                    ? "border-rose-400/30 bg-rose-400/10"
                    : "border-emerald-400/30 bg-emerald-400/10"
                }`}
              >

                <div className="flex items-start gap-4">

                  {result.is_spoof ? (
                    <AlertTriangle
                      className="text-rose-300"
                      size={25}
                    />
                  ) : (
                    <ShieldCheck
                      className="text-emerald-300"
                      size={25}
                    />
                  )}

                  <div>

                    <h3 className="font-bold">
                      {result.is_spoof
                        ? "Potential AI-generated voice"
                        : "Voice appears authentic"}
                    </h3>

                    <p className="mt-2 text-sm text-slate-400">
                      {result.message}
                    </p>

                  </div>

                </div>

              </div>

              {/* AI Metrics */}

              <Metric
                title="AI spoof probability"
                value={result.spoof_probability}
              />

              <Metric
                title="Human / bona-fide probability"
                value={result.bonafide_probability}
              />

              <Metric
                title="Model confidence"
                value={result.confidence}
              />

              {/* Recommendation */}

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">

                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Recommended action
                </p>

                <p className="mt-2 font-semibold">
                  {result.recommendation}
                </p>

              </div>
            </>
          )}

          {/* Empty state */}

          {!result && !error && (
            <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 text-center">

              <Mic
                size={40}
                className="text-slate-600"
              />

              <h3 className="mt-5 font-bold">
                No voice analyzed yet
              </h3>

              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Click "Start Recording", speak for at least
                4 seconds, then stop the recording.
              </p>

            </div>
          )}

        </div>

      </div>

      {/* Upload option */}

      <div className="mt-5 flex justify-center">

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500 hover:text-cyan-300">

          <Upload size={16} />

          Or upload a WAV/MP3 sample

          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];

              if (file) {
                await analyzeAudio(file);
              }
            }}
          />

        </label>

      </div>

    </section>
  );
}


/*
 * Metric component
 */

function Metric({ title, value }) {

  const percentage = Number(value || 0);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">

      <div className="flex justify-between">

        <span className="text-sm text-slate-400">
          {title}
        </span>

        <b>
          {percentage.toFixed(1)}%
        </b>

      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">

        <div
          className="h-full rounded-full bg-cyan-400 transition-all duration-700"
          style={{
            width: `${percentage}%`
          }}
        />

      </div>

    </div>
  );
}