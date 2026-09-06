import { useEffect, useRef, useState } from "react";
import { Activity, Play, RefreshCw, Square, ShieldAlert, CheckCircle2 } from "lucide-react";
import Badge from "./Badge";
import RiskGauge from "./RiskGauge";
import VoiceUploadAnalyzer from "./VoiceUploadAnalyzer";
import { WS_BASE } from "../config";

export default function LiveDemo({ onAnalysisComplete }) {
  const [score, setScore] = useState(18);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready to analyze");
  const [error, setError] = useState("");
  const socket = useRef(null);
  const audioContext = useRef(null);
  const microphone = useRef(null);
  const processor = useRef(null);
  const mediaStream = useRef(null);

  const stop = () => {
    processor.current?.disconnect();
    microphone.current?.disconnect();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    audioContext.current?.close();
    socket.current?.close();
    processor.current = null;
    microphone.current = null;
    mediaStream.current = null;
    audioContext.current = null;
    socket.current = null;
    setRunning(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setError("");
    setStatus("Requesting microphone access...");

    if (!navigator.mediaDevices?.getUserMedia || !window.WebSocket) {
      setError("Live microphone analysis is not supported by this browser.");
      setStatus("Use Chrome or Edge, or upload a recording below");
      return;
    }

    let stream;
    let ws;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const context = new AudioContext();
      const token = window.localStorage.getItem("voxguard_access_token");
      const wsUrl = `${WS_BASE}/api/stream?token=${encodeURIComponent(token || "")}`;
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = () => reject(new Error("Could not connect to the live analysis service."));
      });

      const source = context.createMediaStreamSource(stream);
      const node = context.createScriptProcessor(4096, 1, 1);
      const silentOutput = context.createGain();
      silentOutput.gain.value = 0;
      ws.send(JSON.stringify({ sample_rate: context.sampleRate, format: "float32", channels: 1 }));

      ws.onmessage = (event) => {
        const result = JSON.parse(event.data);
        if (result.error) return setError(result.error);
        const nextScore = Math.round(Number(result.risk?.risk_score ?? result.deepfake?.deepfake_risk ?? 0));
        const normalized = {
          is_spoof: Number(result.deepfake?.spoof_probability || 0) >= 0.5,
          risk_score: nextScore,
          confidence: Math.max(0, 100 - nextScore),
          recommendation: result.risk?.action || "Continue monitoring and use secondary verification.",
        };
        setScore(Math.max(0, Math.min(100, nextScore)));
        setStatus(result.risk?.action || (nextScore > 72 ? "High-risk voice detected" : "Live audio analyzed"));
        onAnalysisComplete?.({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          fileName: "Live microphone stream",
          result: normalized,
        });
      };
      ws.onclose = () => {
        if (socket.current === ws) {
          setRunning(false);
          setStatus("Analysis disconnected");
        }
      };

      node.onaudioprocess = (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(event.inputBuffer.getChannelData(0).slice().buffer);
        }
      };
      source.connect(node);
      node.connect(silentOutput);
      silentOutput.connect(context.destination);
      socket.current = ws;
      audioContext.current = context;
      microphone.current = source;
      processor.current = node;
      mediaStream.current = stream;
      setRunning(true);
      setStatus("Listening for live audio...");
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      ws?.close();
      setError(err.message || "Microphone access failed.");
      setStatus("Ready to analyze");
      stop();
    }
  };

  const reset = () => {
    stop();
    setRunning(false);
    setScore(18);
    setStatus("Ready to analyze");
    setError("");
  };

  const isHighRisk = score > 72;
  const authenticity = Math.max(8, 100 - score);

  return (
    <section id="demo" className="relative mx-auto max-w-7xl px-5 py-24 overflow-hidden">
      {/* Background Glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-96 w-[700px] rounded-full bg-cyan-500/5 blur-[140px]" />

      {/* Header */}
      <div className="mb-12 text-center">
        <Badge>INTERACTIVE DEMO</Badge>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
          Real-time voice integrity{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            monitor
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400">
          Speak into your microphone and VoxGuard will continuously score deepfake, speaker, scam and transaction-risk signals.
        </p>
      </div>

      {/* Main Container */}
      <div className="group relative rounded-3xl border border-indigo-500/20 bg-[#0c121e]/85 p-6 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-cyan-400/30 md:p-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          
          {/* Left Column: Gauge & Live Controls */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-950/50 p-6 md:p-8">
            <RiskGauge score={score} />

            {/* Audio Waveform Indicator */}
            <div className="my-4 flex h-8 items-center justify-center gap-1">
              {[...Array(9)].map((_, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    running
                      ? "bg-gradient-to-t from-cyan-400 to-indigo-500 animate-[bounce_0.8s_infinite_ease-in-out]"
                      : "h-2 bg-slate-700"
                  }`}
                  style={{
                    animationDelay: `${(i % 4) * 0.15}s`,
                    height: running ? `${Math.max(10, (i + 1) * 3.5)}px` : "6px",
                  }}
                />
              ))}
            </div>

            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold">
              <span
                className={`h-2 w-2 rounded-full ${
                  isHighRisk
                    ? "bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-ping"
                    : running
                    ? "bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse"
                    : "bg-emerald-400"
                }`}
              />
              <span className={isHighRisk ? "text-rose-300" : running ? "text-cyan-300" : "text-slate-300"}>
                {status}
              </span>
            </div>

            {/* Buttons */}
            <div className="mt-7 flex items-center gap-3">
              {!running ? (
                <button
                  onClick={start}
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-cyan-400/40 active:translate-y-0"
                >
                  <Play size={16} className="fill-slate-950 transition-transform group-hover:scale-110" />
                  <span>Start Analysis</span>
                </button>
              ) : (
                <button
                  onClick={() => { stop(); setStatus("Analysis stopped"); }}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-6 py-3 text-sm font-bold text-rose-300 transition-all duration-300 hover:bg-rose-500/20"
                >
                  <Square size={15} className="fill-rose-300" />
                  <span>Stop</span>
                </button>
              )}

              <button
                onClick={reset}
                title="Reset analysis"
                className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700/80 bg-slate-900/60 text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-500 hover:text-white"
              >
                <RefreshCw size={16} className="transition-transform duration-500 hover:rotate-180" />
              </button>
            </div>
            {error && <p className="mt-3 max-w-sm text-center text-xs text-rose-300">{error}</p>}
          </div>

          {/* Right Column: Real-time Telemetry & Recommendations */}
          <div className="space-y-3.5">
            
            {/* Authenticity Bar */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5 backdrop-blur-sm transition-colors hover:border-slate-700">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-400">Acoustic authenticity</span>
                <b className={`font-mono text-base ${isHighRisk ? "text-rose-400" : "text-cyan-400"}`}>
                  {authenticity}%
                </b>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/90">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isHighRisk
                      ? "bg-gradient-to-r from-rose-500 to-amber-500"
                      : "bg-gradient-to-r from-cyan-400 to-indigo-500"
                  }`}
                  style={{ width: `${authenticity}%` }}
                />
              </div>
            </div>

            {/* Diagnostic Signals */}
            {[
              "Spectral artifacts",
              "Prosody consistency",
              "Speaker identity match",
              "Contextual fraud signal",
            ].map((item, index) => {
              const metricVal = Math.max(42, 90 - score + index * 7);
              return (
                <div
                  key={item}
                  className="group/signal flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/30 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/70"
                >
                  <span className="flex items-center gap-3 text-sm font-medium text-slate-300">
                    <Activity size={16} className="text-cyan-400 transition-transform group-hover/signal:scale-110" />
                    {item}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-400">
                    {metricVal}%
                  </span>
                </div>
              );
            })}

            {/* Recommended Action Box */}
            <div
              className={`rounded-2xl border p-5 transition-all duration-500 ${
                isHighRisk
                  ? "border-rose-500/40 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                  : "border-emerald-500/30 bg-emerald-500/10"
              }`}
            >
              <div className="flex gap-3.5">
                {isHighRisk ? (
                  <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-400 shrink-0 animate-bounce" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400 shrink-0" />
                )}
                <div>
                  <b className={`text-sm ${isHighRisk ? "text-rose-300" : "text-emerald-300"}`}>
                    {isHighRisk ? "Critical Alert: High-Risk Detection" : "Normal Stream: Low Threat"}
                  </b>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    {isHighRisk
                      ? "Do not authorize sensitive action. Trigger callback verification and step-up MFA."
                      : "Continue monitoring. Secondary verification recommended for high-value transactions."}
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      <VoiceUploadAnalyzer onAnalysisComplete={onAnalysisComplete} />
    </section>
  );
}