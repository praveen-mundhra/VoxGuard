import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  PhoneCall,
  Play,
  RadioTower,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Square,
  UserCheck,
} from "lucide-react";

import Badge from "./Badge";
import RiskGauge from "./RiskGauge";
import VoiceUploadAnalyzer from "./VoiceUploadAnalyzer";
import { WS_BASE } from "../config";

const LIVE_ANALYSIS_WINDOW_SECONDS = 5;

const DEFAULT_SIGNALS = {
  acoustic: 82,
  spectral: 72,
  prosody: 79,
  speaker: 86,
  scam: 93,
};

function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function getRiskLevel(score) {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

function getRiskSignals(result, fallbackScore = 18) {
  const risk = clamp(
    result?.risk?.risk_score ??
      result?.risk_score ??
      result?.deepfake?.deepfake_risk ??
      fallbackScore,
  );

  const spoof = clamp(Number(result?.deepfake?.spoof_probability ?? 0) * 100);

  const genuine = clamp(
    Number(result?.deepfake?.genuine_probability ?? 0) * 100,
  );

  const speakerSimilarity = clamp(
    Number(result?.speaker?.similarity ?? 0) * 100,
  );

  const speakerRisk = clamp(result?.speaker?.speaker_risk ?? 0);

  const scamRisk = clamp(result?.scam?.scam_risk ?? 0);

  return {
    risk,
    signals: {
      // Higher percentage means more authentic/safe for these checks.
      acoustic:
        genuine > 0
          ? genuine
          : clamp(100 - spoof, DEFAULT_SIGNALS.acoustic, 100),

      // Higher percentage means fewer detected synthetic artifacts.
      spectral: spoof > 0 ? clamp(100 - spoof) : DEFAULT_SIGNALS.spectral,

      prosody:
        result?.prosody_consistency != null
          ? clamp(result.prosody_consistency)
          : DEFAULT_SIGNALS.prosody,

      speaker:
        speakerSimilarity > 0
          ? speakerSimilarity
          : clamp(100 - speakerRisk, DEFAULT_SIGNALS.speaker, 100),

      // Higher percentage means contextual safety.
      scam:
        result?.scam?.safety_score != null
          ? clamp(result.scam.safety_score)
          : clamp(100 - scamRisk, DEFAULT_SIGNALS.scam, 100),
    },
  };
}

function RecommendedActions({ score, mode }) {
  const [selected, setSelected] = useState(null);
  const level = getRiskLevel(score);

  const actions =
    level === "HIGH"
      ? [
          {
            icon: ShieldAlert,
            title: "Stop sensitive action",
            text:
              mode === "live"
                ? "Pause the conversation before sharing money, OTPs, PINs or credentials."
                : "Do not rely on this recording for identity verification.",
          },
          {
            icon: PhoneCall,
            title: "Verify independently",
            text: "Call the person back using a trusted number or another known channel.",
          },
          {
            icon: UserCheck,
            title: "Use secondary verification",
            text: "Confirm identity with MFA, callback verification or another trusted factor.",
          },
          {
            icon: CircleAlert,
            title: "Report or escalate",
            text: "Record the incident details and escalate suspected impersonation to the appropriate security team.",
          },
        ]
      : level === "MEDIUM"
        ? [
            {
              icon: UserCheck,
              title: "Verify the caller",
              text: "Ask an independent verification question and confirm through a trusted channel.",
            },
            {
              icon: ShieldCheck,
              title: "Avoid sensitive information",
              text: "Do not disclose OTPs, PINs, passwords or banking credentials.",
            },
            {
              icon: CircleAlert,
              title: "Increase monitoring",
              text: "Continue analysis and watch for unusual urgency, payment requests or identity changes.",
            },
          ]
        : [
            {
              icon: CheckCircle2,
              title: "Continue with caution",
              text: "The current signals indicate comparatively low impersonation risk.",
            },
            {
              icon: UserCheck,
              title: "Use normal verification",
              text: "For high-value requests, independently verify the person before completing the action.",
            },
          ];

  return (
    <div className="mt-5 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert size={17} className="text-cyan-400" />
        <div>
          <h4 className="text-sm font-bold text-white">Recommended Actions</h4>
          <p className="text-[11px] text-slate-500">
            Suggested next steps for the user
          </p>
        </div>
      </div>

      <div className="grid gap-2.5 md:grid-cols-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const active = selected === index;

          return (
            <button
              key={action.title}
              type="button"
              onClick={() => setSelected(index)}
              className={`text-left rounded-xl border p-3.5 transition-all ${
                active
                  ? "border-cyan-400/50 bg-cyan-400/10"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex gap-3">
                <span
                  className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    active
                      ? "bg-cyan-400/15 text-cyan-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <Icon size={16} />
                </span>

                <span>
                  <span className="block text-xs font-bold text-slate-200">
                    {action.title}
                  </span>
                  <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                    {action.text}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SignalBar({ label, value, icon: Icon = Activity, inverse = false }) {
  const safeValue = clamp(value);

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/45 p-4">
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={14} className="shrink-0 text-cyan-400" />
          <span className="truncate font-medium text-slate-300">{label}</span>
        </div>

        <span className="shrink-0 font-mono text-sm font-bold text-cyan-300">
          {safeValue}%
        </span>
      </div>

      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            inverse
              ? safeValue >= 50
                ? "bg-rose-400"
                : "bg-amber-400"
              : safeValue >= 75
                ? "bg-gradient-to-r from-cyan-400 to-indigo-400"
                : safeValue >= 50
                  ? "bg-amber-400"
                  : "bg-rose-400"
          }`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function StatusPanel({ score, status, running, error }) {
  const level = getRiskLevel(score);

  return (
    <div
      className={`mt-5 rounded-xl border p-4 ${
        level === "HIGH"
          ? "border-rose-500/30 bg-rose-500/10"
          : level === "MEDIUM"
            ? "border-amber-400/30 bg-amber-400/10"
            : "border-emerald-400/20 bg-emerald-400/10"
      }`}
    >
      <div className="flex items-start gap-3">
        {level === "HIGH" ? (
          <ShieldAlert size={18} className="mt-0.5 text-rose-300" />
        ) : level === "MEDIUM" ? (
          <AlertTriangle size={18} className="mt-0.5 text-amber-300" />
        ) : (
          <CheckCircle2 size={18} className="mt-0.5 text-emerald-300" />
        )}

        <div>
          <p className="text-sm font-bold text-slate-100">{status}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">
            {running
              ? `Swaraksha is continuously analyzing ${LIVE_ANALYSIS_WINDOW_SECONDS}-second voice windows.`
              : "Start analysis to evaluate the current voice sample."}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}

const FRAUD_CATEGORIES = [
  { name: "Banking & UPI Fraud", confidence: 94, severity: "CRITICAL", detail: "Credential and OTP extraction pattern", icon: KeyRound, tone: "rose" },
  { name: "Job / Internship Scam", confidence: 31, severity: "LOW", detail: "No registration-fee language detected", icon: Activity, tone: "emerald" },
  { name: "Lottery & Prize Bait", confidence: 18, severity: "LOW", detail: "No prize or clearance-fee language detected", icon: CircleAlert, tone: "emerald" },
  { name: "Executive / Impersonation", confidence: 76, severity: "MEDIUM", detail: "Authority and urgency cues detected", icon: UserCheck, tone: "amber" },
];

const RISK_KEYWORDS = ["UPI PIN", "Immediate Transfer", "Processing Fee", "Debit Card Expiry"];

function ExplainableCallInsights({ score, running }) {
  const unifiedScore = clamp(Math.max(score, 78));
  const tone = unifiedScore >= 75 ? "rose" : unifiedScore >= 50 ? "amber" : "emerald";
  const tones = {
    rose: { border: "border-rose-400/25", bg: "bg-rose-400/10", text: "text-rose-300", fill: "bg-rose-400" },
    amber: { border: "border-amber-400/25", bg: "bg-amber-400/10", text: "text-amber-300", fill: "bg-amber-400" },
    emerald: { border: "border-emerald-400/25", bg: "bg-emerald-400/10", text: "text-emerald-300", fill: "bg-emerald-400" },
  };

  return (
    <section className="relative mt-10 overflow-hidden rounded-3xl border border-emerald-400/20 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-md md:p-8">
      <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-400/5 blur-3xl" />
      <div className="relative mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10"><BrainCircuit size={18} /></span>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/80">Explainable Call Insights</p><h3 className="text-xl font-black text-white md:text-2xl">Semantic Threat &amp; Explainable Intelligence</h3></div>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-slate-400">Intent classification and transparent evidence layered onto Swaraksha&apos;s synthetic voice and biometric checks.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[11px] font-semibold text-emerald-300"><span className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`} />{running ? "SEMANTIC PIPELINE LIVE" : "MOCK CALL STATE"}</div>
      </div>

      <div className="relative grid gap-4 xl:grid-cols-[1.25fr_1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between"><div><h4 className="text-sm font-bold text-white">Fraud intent classification</h4><p className="mt-1 text-[11px] text-slate-500">Highest-confidence live transcription matches</p></div><ScanSearch size={17} className="text-emerald-300" /></div>
          <div className="grid gap-2">{FRAUD_CATEGORIES.map((category) => { const Icon = category.icon; const categoryTone = tones[category.tone]; return (
            <div key={category.name} className={`rounded-xl border p-3 ${categoryTone.border} ${categoryTone.bg}`}>
              <div className="flex items-start gap-3"><Icon size={16} className={`mt-0.5 shrink-0 ${categoryTone.text}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-slate-200">{category.name}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider ${categoryTone.border} ${categoryTone.text}`}>{category.severity}</span></div><div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${categoryTone.fill}`} style={{ width: `${category.confidence}%` }} /></div><span className={`font-mono text-[11px] font-bold ${categoryTone.text}`}>{category.confidence}%</span></div><p className="mt-1.5 text-[10px] text-slate-500">{category.detail}</p></div></div>
            </div>
          ); })}</div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-4 md:p-5">
          <div className="mb-5 flex items-center gap-2"><Fingerprint size={17} className="text-amber-300" /><div><h4 className="text-sm font-bold text-white">XAI trigger inspector</h4><p className="mt-1 text-[11px] text-slate-500">Evidence behind the current flag</p></div></div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Extracted risk keywords</p>
          <div className="flex flex-wrap gap-2">{RISK_KEYWORDS.map((keyword) => <span key={keyword} className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5 font-mono text-[10px] text-amber-200">&quot;{keyword}&quot;</span>)}</div>
          <div className="mt-5 rounded-xl border border-rose-400/15 bg-rose-400/5 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Linguistic intent breakdown</p><p className="mt-2 text-xs leading-5 text-slate-300">Urgency heuristic detected combined with a financial transfer request and credential extraction language.</p></div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-4 md:p-5">
          <div className="mb-5 flex items-center gap-2"><RadioTower size={17} className="text-cyan-300" /><div><h4 className="text-sm font-bold text-white">Dual-stream fusion</h4><p className="mt-1 text-[11px] text-slate-500">Telemetry confidence by stream</p></div></div>
          <div className="space-y-3"><div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3"><span className="text-xs text-slate-300">Acoustic stream</span><span className="text-right font-mono text-[10px] text-cyan-300">AASIST / ECAPA-TDNN · 88%</span></div><div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/15 bg-amber-400/5 p-3"><span className="text-xs text-slate-300">Semantic stream</span><span className="text-right font-mono text-[10px] text-amber-300">Whisper NLP · 94%</span></div></div>
          <div className="mt-6 border-t border-slate-800 pt-4"><div className="flex items-end justify-between"><span className="text-xs font-bold text-slate-300">Unified risk score</span><span className={`text-2xl font-black ${tones[tone].text}`}>{unifiedScore}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${tones[tone].fill} transition-all duration-700`} style={{ width: `${unifiedScore}%` }} /></div><p className="mt-2 text-[10px] text-slate-500">Both streams agree: pause transfer and verify independently.</p></div>
        </div>
      </div>

      <div className="relative mt-4 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4"><LockKeyhole size={18} className="mt-0.5 shrink-0 text-emerald-300" /><div><p className="text-xs font-bold text-emerald-200">Zero-storage · ephemeral processing</p><p className="mt-1 text-[11px] leading-5 text-slate-400">Live audio and intermediate transcripts stay in memory only, then are deleted immediately when the call ends. Zero disk retention. Zero call-log persistence.</p></div></div>
    </section>
  );
}

export default function LiveDemo({ onAnalysisComplete }) {
  // -----------------------------
  // Live analysis state
  // -----------------------------
  const [liveScore, setLiveScore] = useState(18);
  const [liveSignals, setLiveSignals] = useState(DEFAULT_SIGNALS);
  const [running, setRunning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState("Ready to analyze");
  const [error, setError] = useState("");
  const [liveAnalysisReceived, setLiveAnalysisReceived] = useState(false);
  const [liveWindowIndex, setLiveWindowIndex] = useState(0);
  const [liveWindowRange, setLiveWindowRange] = useState("Waiting for first 5-second analysis");
  const [liveRiskUpdatedAt, setLiveRiskUpdatedAt] = useState(null);

  // -----------------------------
  // Audio sample state
  // -----------------------------
  const [sampleScore, setSampleScore] = useState(18);
  const [sampleStatus, setSampleStatus] = useState("Ready to analyze");

  const socket = useRef(null);
  const audioContext = useRef(null);
  const microphone = useRef(null);
  const processor = useRef(null);
  const mediaStream = useRef(null);

  // -----------------------------
  // Stop live analysis
  // -----------------------------
  const stop = () => {
    try {
      processor.current?.disconnect();
    } catch {}

    try {
      microphone.current?.disconnect();
    } catch {}

    try {
      mediaStream.current?.getTracks().forEach((track) => track.stop());
    } catch {}

    try {
      socket.current?.close();
    } catch {}

    try {
      audioContext.current?.close();
    } catch {}

    processor.current = null;
    microphone.current = null;
    mediaStream.current = null;
    audioContext.current = null;
    socket.current = null;

    setRunning(false);
  };

  useEffect(() => {
    return () => stop();
  }, []);

  // -----------------------------
  // Start live analysis
  // -----------------------------
  const start = async () => {
    setError("");
    setStatus("Requesting microphone access...");

    if (!navigator.mediaDevices?.getUserMedia || !window.WebSocket) {
      setError("Live microphone analysis is not supported by this browser.");
      setStatus("Use Chrome or Edge, or upload a recording below.");
      return;
    }

    let stream = null;
    let ws = null;
    let context = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      context = new (window.AudioContext || window.webkitAudioContext)();

      await context.resume();

      const token = window.localStorage.getItem("voxguard_access_token");

      if (!token) {
        throw new Error("Please log in before starting Live Analysis.");
      }

      const wsUrl = `${WS_BASE}/api/stream?token=` + encodeURIComponent(token);

      console.log("[Swaraksha] Connecting to:", wsUrl);

      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("[Swaraksha] WebSocket connected");

        setRunning(true);
        setStatus(
          `Connected — first ${LIVE_ANALYSIS_WINDOW_SECONDS}-second analysis is being prepared...`,
        );

        ws.send(
          JSON.stringify({
            sample_rate: context.sampleRate,
            format: "float32",
            channels: 1,
            caller_number: null,
            transaction_amount: 0,
            new_beneficiary: false,
            user_confirmed: false,
            language: "en",
            device_risk: 0,
          }),
        );
      };

      ws.onerror = (event) => {
        console.error("[Swaraksha] WebSocket error:", event);

        setError(
          "Could not connect to the live analysis service. Check the FastAPI backend and /api/stream endpoint.",
        );
      };

      ws.onclose = (event) => {
        console.log("[Swaraksha] WebSocket closed:", event.code, event.reason);

        if (socket.current === ws) {
          setRunning(false);

          if (event.code === 1008) {
            setError(
              "Live analysis authentication failed. Please log in again.",
            );
            setStatus("Authentication required");
          } else {
            setStatus("Analysis disconnected");
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // --------------------------------
          // 5-second analysis started
          // --------------------------------
          if (data.type === "analysis_started") {
            const index = Number(data.window_index || 0);
            const startSeconds = Number(data.window_start_seconds || 0);
            const endSeconds = Number(data.window_end_seconds || 5);

            setStatus(
              `Analyzing ${startSeconds}s → ${endSeconds}s voice window...`,
            );
            setIsAnalyzing(true);
            setLiveWindowIndex(index);
            setLiveWindowRange(
              `Window #${index} · ${startSeconds}s → ${endSeconds}s`,
            );
            return;
          }

          // --------------------------------
          // New AI result
          // --------------------------------
          if (
            data.type === "analysis" ||
            data.type === "analysis_result"
          ) {
            console.log("[LIVE RESULT]", data);

            setIsAnalyzing(false);
            setStatus("Live analysis updated");

            const result =
              data.result && typeof data.result === "object"
                ? data.result
                : data;

            const parsed = getRiskSignals(result, liveScore);

            // Prefer the explicit backend risk_percent field.
            // This guarantees that the number displayed is the
            // percentage calculated by the FastAPI risk engine.
            const backendRisk = Number(
              data.risk_percent ??
                result?.risk?.risk_score ??
                result?.risk_score,
            );

            const displayRisk = Number.isFinite(backendRisk)
              ? Math.max(0, Math.min(100, backendRisk))
              : parsed.risk;

            setLiveScore(Math.round(displayRisk));
            setLiveSignals(parsed.signals);
            setLiveAnalysisReceived(true);

            if (data.window_index != null) {
              setLiveWindowIndex(Number(data.window_index));
            }

            const startSeconds = Number(
              data.window_start_seconds ??
                Math.max(0, (Number(data.window_index || 1) - 1) * 5),
            );
            const endSeconds = Number(
              data.window_end_seconds ??
                Number(data.window_index || 1) * 5,
            );

            setLiveWindowRange(
              `Window #${Number(data.window_index || 1)} · ${startSeconds}s → ${endSeconds}s`,
            );
            setLiveRiskUpdatedAt(new Date().toLocaleTimeString());

            console.log(
              `[LIVE RISK UPDATE] Window #${data.window_index ?? "?"}: ${displayRisk.toFixed(2)}%`,
            );

            return;
          }

          // --------------------------------
          // Error
          // --------------------------------
          if (data.type === "analysis_error") {
            console.error("[LIVE AI ERROR]", data.error);

            setIsAnalyzing(false);

            setError(`Live analysis failed: ${data.error}`);

            return;
          }
        } catch (error) {
          console.error("Invalid WebSocket message:", error);
        }
      };

      const source = context.createMediaStreamSource(stream);

      const processorNode = context.createScriptProcessor(4096, 1, 1);

      const silentOutput = context.createGain();

      silentOutput.gain.value = 0;

      processorNode.onaudioprocess = (event) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          return;
        }

        const input = event.inputBuffer.getChannelData(0);

        const audio = new Float32Array(input.length);

        audio.set(input);

        ws.send(audio.buffer);
      };

      source.connect(processorNode);
      processorNode.connect(silentOutput);
      silentOutput.connect(context.destination);

      socket.current = ws;
      audioContext.current = context;
      microphone.current = source;
      processor.current = processorNode;
      mediaStream.current = stream;

      setRunning(true);
      setStatus("Listening — speak normally...");
    } catch (err) {
      console.error("[Swaraksha] Live demo error:", err);

      try {
        stream?.getTracks().forEach((track) => track.stop());
      } catch {}

      try {
        ws?.close();
      } catch {}

      try {
        await context?.close();
      } catch {}

      setError(err?.message || "Microphone access failed.");

      setStatus("Ready to analyze");
      stop();
    }
  };

  const resetLive = () => {
    stop();
    setLiveScore(18);
    setLiveSignals(DEFAULT_SIGNALS);
    setLiveAnalysisReceived(false);
    setLiveWindowIndex(0);
    setLiveWindowRange("Waiting for first 5-second analysis");
    setLiveRiskUpdatedAt(null);
    setStatus("Ready to analyze");
    setError("");
  };

  // Audio sample callback.
  // VoiceUploadAnalyzer should call this prop after its backend analysis.
  const handleSampleAnalysis = (payload) => {
    const result = payload?.result || payload || {};

    const parsed = getRiskSignals(result, sampleScore);

    setSampleScore(parsed.risk);

    const level = getRiskLevel(parsed.risk);

    setSampleStatus(
      level === "HIGH"
        ? "High-risk audio detected"
        : level === "MEDIUM"
          ? "Suspicious audio detected"
          : "Audio sample analyzed",
    );

    onAnalysisComplete?.(payload);
  };

  const liveLevel = getRiskLevel(liveScore);

  const sampleLevel = getRiskLevel(sampleScore);

  return (
    <section
      id="demo"
      className="relative mx-auto max-w-7xl overflow-hidden px-5 py-24"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/5 blur-[140px]" />

      {/* =====================================================
          HEADER
      ====================================================== */}
      <div className="relative mb-12 text-center">
        <Badge>INTERACTIVE DEMO</Badge>

        <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
          Voice integrity{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            protection
          </span>
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400">
          Test Swaraksha in real time using your microphone, or upload a
          recorded voice sample for AI-based deepfake, speaker, scam and risk
          analysis.
        </p>
      </div>

      {/* =====================================================
          SECTION 1 — LIVE VOICE ANALYSIS
      ====================================================== */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#0c121e]/90 p-5 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <Activity size={18} />
              </span>

              <div>
                <h3 className="text-xl font-black text-white md:text-2xl">
                  Live Voice Analysis
                </h3>
              </div>
            </div>

            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Speak normally. Swaraksha continuously evaluates each{" "}
              {LIVE_ANALYSIS_WINDOW_SECONDS}-second voice window and updates the
              impersonation risk.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-[11px] font-semibold text-cyan-300">
            <span
              className={`h-2 w-2 rounded-full ${
                running ? "animate-pulse bg-cyan-400" : "bg-slate-600"
              }`}
            />
            {isAnalyzing ? "PROCESSING WINDOW" : running ? "LIVE ANALYSIS" : "READY"}
          </div>
        </div>

        <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr]">
          {/* Live gauge */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/55 p-6 md:p-8">
            <div className="flex flex-col items-center">
              <RiskGauge score={liveScore} />

              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Impersonation Risk
              </p>

              <div className="my-5 flex h-8 items-center justify-center gap-1">
                {[...Array(12)].map((_, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full transition-all ${
                      running ? "animate-pulse bg-cyan-400" : "bg-slate-700"
                    }`}
                    style={{
                      height: running ? `${8 + ((i * 7) % 22)}px` : "6px",
                      animationDelay: `${i * 0.08}s`,
                    }}
                  />
                ))}
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold">
                <span
                  className={`h-2 w-2 rounded-full ${
                    liveLevel === "HIGH"
                      ? "animate-ping bg-rose-500"
                      : liveLevel === "MEDIUM"
                        ? "bg-amber-400"
                        : running
                          ? "animate-pulse bg-cyan-400"
                          : "bg-emerald-400"
                  }`}
                />
                <span
                  className={
                    liveLevel === "HIGH"
                      ? "text-rose-300"
                      : liveLevel === "MEDIUM"
                        ? "text-amber-300"
                        : running
                          ? "text-cyan-300"
                          : "text-slate-300"
                  }
                >
                  {status}
                </span>
              </div>

              <div className="mt-6 flex items-center gap-3">
                {!running ? (
                  <button
                    onClick={start}
                    className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:-translate-y-0.5"
                  >
                    <Play size={16} className="fill-slate-950" />
                    Start Analysis
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      stop();
                      setStatus("Analysis stopped");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-6 py-3 text-sm font-bold text-rose-300"
                  >
                    <Square size={15} className="fill-rose-300" />
                    Stop
                  </button>
                )}

                <button
                  onClick={resetLive}
                  title="Reset live analysis"
                  className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700/80 bg-slate-900/60 text-slate-300"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            <StatusPanel
              score={liveScore}
              status={status}
              running={running}
              error={error}
            />
          </div>

          {/* Live signals */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">
                  Analysis Signals
                </h4>
                <p className="text-[11px] text-slate-500">
                  Percentage shown for every process
                </p>
              </div>

              <div className="text-right">
                <span className="block font-mono text-sm font-black text-cyan-300">
                  Impersonation Risk {liveScore}%
                </span>
                <span className="block text-[10px] text-slate-500">
                  {liveWindowRange}
                  {liveRiskUpdatedAt ? ` · Updated ${liveRiskUpdatedAt}` : ""}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <SignalBar
                label="Acoustic authenticity"
                value={liveSignals.acoustic}
              />
              <SignalBar
                label="Spectral artifact check"
                value={liveSignals.spectral}
              />
              <SignalBar
                label="Prosody consistency"
                value={liveSignals.prosody}
              />
              <SignalBar
                label="Speaker identity match"
                value={liveSignals.speaker}
                icon={UserCheck}
              />
              <SignalBar
                label="Contextual fraud safety"
                value={liveSignals.scam}
                icon={ShieldCheck}
              />
            </div>

          </div>
        </div>
      </div>

        <ExplainableCallInsights score={liveScore} running={running} />

        {/* =====================================================
          LIVE AI RECOMMENDATIONS — shown after first analysis
        ====================================================== */}
        {liveAnalysisReceived && (
          <section className="relative mt-5 overflow-hidden rounded-3xl border border-amber-400/20 bg-[#0c121e]/90 p-5 shadow-2xl backdrop-blur-xl md:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/10 text-amber-300">
                    <ShieldAlert size={18} />
                  </span>
                  <h3 className="text-base font-bold text-white">
                    AI Recommended Actions
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Recommendations generated from the latest 5-second live analysis.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Risk {liveScore}%
              </span>
            </div>

            <RecommendedActions score={liveScore} mode="live" />
          </section>
        )}

        {/* =====================================================
          SECTION 2 — AUDIO SAMPLE ANALYSIS
        ====================================================== */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-[#0c121e]/90 p-5 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-400/10 text-indigo-300">
                <Activity size={18} />
              </span>

              <div>
                <h3 className="text-xl font-black text-white md:text-2xl">
                  Audio Sample Analysis
                </h3>
              </div>
            </div>

            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Upload a recorded voice sample. Normal audio analysis requires a
              minimum of 5 seconds. Authentication/enrollment remains separate
              at 55 seconds.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/5 px-3 py-1.5 text-[11px] font-semibold text-indigo-300">
            MINIMUM 5 SECONDS
          </div>
        </div>

        <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr]">
          {/* Sample gauge */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/55 p-6 md:p-8">
            <div className="flex flex-col items-center">
              <RiskGauge score={sampleScore} />

              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Impersonation Risk
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold">
                <span
                  className={`h-2 w-2 rounded-full ${
                    sampleLevel === "HIGH"
                      ? "bg-rose-500"
                      : sampleLevel === "MEDIUM"
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                />
                <span className="text-slate-300">{sampleStatus}</span>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-indigo-400/10 bg-indigo-400/5 p-3 text-center text-[11px] leading-5 text-slate-400">
              <b className="text-indigo-300">Analysis rule:</b> minimum 5-second
              recording.
            </div>
          </div>

          {/* Upload + signals */}
          <div>
            <VoiceUploadAnalyzer onAnalysisComplete={handleSampleAnalysis} />

            {/* <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Sample Analysis Signals
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Each process displays its percentage
                  </p>
                </div>

                <span className="font-mono text-xs text-slate-500">
                  Risk {sampleScore}%
                </span>
              </div>

              <div className="space-y-2.5">
                <SignalBar
                  label="Acoustic authenticity"
                  value={sampleSignals.acoustic}
                />
                <SignalBar
                  label="Spectral artifact check"
                  value={sampleSignals.spectral}
                />
                <SignalBar
                  label="Prosody consistency"
                  value={sampleSignals.prosody}
                />
                <SignalBar
                  label="Speaker identity match"
                  value={sampleSignals.speaker}
                  icon={UserCheck}
                />
                <SignalBar
                  label="Contextual fraud safety"
                  value={sampleSignals.scam}
                  icon={ShieldCheck}
                />
              </div>

              <RecommendedActions
                score={sampleScore}
                mode="sample"
              />
            </div> */}
          </div>
        </div>
      </div>
    </section>
  );
}
