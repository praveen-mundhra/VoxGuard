import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  Globe2,
  LockKeyhole,
  Mic2,
  Network,
  PhoneCall,
  ScanSearch,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  Zap,
  Activity,
  Cpu,
  ChevronRight,
  Sliders,
  Play,
  Pause,
  AlertTriangle,
  RotateCcw,
  Check,
  Radio
} from "lucide-react";

const technologies = [
  {
    id: "aasist",
    icon: BrainCircuit,
    title: "AASIST",
    subtitle: "Voice Deepfake Detection",
    description:
      "Analyzes acoustic and spectral characteristics to identify AI-generated or cloned speech.",
    latency: "18ms",
    status: "Active Inference",
    tensorSpec: "Raw waveform (16kHz mono) -> Spectro-Temporal Graph Attention",
    metrics: "99.2% Synthetic Voice Spoof Rejection",
  },
  {
    id: "ecapa",
    icon: Users,
    title: "ECAPA-TDNN",
    subtitle: "Speaker Verification",
    description:
      "Compares speaker characteristics with a trusted voice reference to detect identity mismatch.",
    latency: "24ms",
    status: "Active Verification",
    tensorSpec: "192-dim deep speaker embedding distance cosine score",
    metrics: "0.84% Equal Error Rate (EER)",
  },
  {
    id: "whisper",
    icon: Mic2,
    title: "Faster-Whisper",
    subtitle: "Speech-to-Text",
    description:
      "Converts speech into text for real-time transcription and contextual scam analysis.",
    latency: "110ms (Streaming)",
    status: "Active Transcribing",
    tensorSpec: "CTranslate2 INT8 quantized transformer model",
    metrics: "Sub-second word error rate < 3.8%",
  },
  {
    id: "risk",
    icon: ScanSearch,
    title: "Risk Engine",
    subtitle: "Multi-Signal Analysis",
    description:
      "Combines voice, speaker, language, behavioral, device and transaction signals into a dynamic risk score.",
    latency: "8ms",
    status: "Scoring Matrix",
    tensorSpec: "Bayesian Multi-Feature Ensembling + Temporal Decay",
    metrics: "0–100 Dynamic Risk Spectrum Index",
  },
  {
    id: "fastapi",
    icon: Server,
    title: "FastAPI + Python",
    subtitle: "AI Backend",
    description:
      "Handles secure APIs, model inference, real-time processing and application logic.",
    latency: "4ms routing",
    status: "Async Workers Ready",
    tensorSpec: "Asynchronous ASGI multi-worker threadpools with ONNX Runtime",
    metrics: "Zero-copy audio chunk streaming",
  },
  {
    id: "websockets",
    icon: Network,
    title: "WebSockets",
    subtitle: "Real-Time Communication",
    description:
      "Enables continuous communication between the microphone, AI backend and dashboard.",
    latency: "< 2ms socket overhead",
    status: "Full Duplex Connected",
    tensorSpec: "Binary Float32 PCM / Opus audio frame streaming",
    metrics: "Continuous bi-directional payload exchange",
  },
];

const workflow = [
  {
    number: "01",
    icon: PhoneCall,
    title: "Voice Input",
    description:
      "Audio enters Swaraksha through a microphone, VoIP or supported telephony channel.",
    badge: "Ingestion Layer",
    techSignal: "Real-time PCM stream capture at 16kHz / 48kHz bitrate",
  },
  {
    number: "02",
    icon: Workflow,
    title: "Audio Processing",
    description:
      "The incoming audio is captured, normalized, filtered and prepared for AI analysis.",
    badge: "Acoustic Normalization",
    techSignal: "Bandpass filtering, noise cancellation & amplitude normalization",
  },
  {
    number: "03",
    icon: BrainCircuit,
    title: "AI Detection",
    description:
      "Deepfake detection and speaker verification examine whether the voice is authentic and consistent.",
    badge: "Biometric Verification",
    techSignal: "AASIST spectral artifact extraction + ECAPA-TDNN reference matching",
  },
  {
    number: "04",
    icon: ScanSearch,
    title: "Scam Analysis",
    description:
      "Speech is transcribed and analyzed for suspicious intent, urgency, OTP, PIN and fraud-related signals.",
    badge: "NLP Intent Engine",
    techSignal: "Faster-Whisper text stream evaluation for coercive psychological pressure",
  },
  {
    number: "05",
    icon: Zap,
    title: "Risk Scoring",
    description:
      "Multiple signals are fused to generate a dynamic 0–100 impersonation risk score.",
    badge: "Multi-Signal Synthesis",
    techSignal: "Real-time weighted probabilistic synthesis across 8 vectors",
  },
  {
    number: "06",
    icon: ShieldCheck,
    title: "Protection",
    description:
      "Swaraksha provides alerts and recommends actions such as callback verification, MFA or transaction hold.",
    badge: "Mitigation & Action",
    techSignal: "Instant UI telemetry warning & automated defensive protocol execution",
  },
];

const benefits = [
  "Real-time voice-cloning and impersonation detection",
  "Dynamic risk scoring instead of relying on voice familiarity alone",
  "Speaker verification for additional identity confidence",
  "Scam and intent analysis from conversation context",
  "Multilingual support for 25+ Indian languages",
  "Actionable alerts instead of simply detecting a threat",
  "Designed for individuals, families, enterprises and financial workflows",
  "Modular architecture that can evolve with new AI models and threats",
];

const uses = [
  {
    icon: Users,
    title: "Individuals & Families",
    text: "Protect users from fraudulent calls pretending to be relatives, friends or trusted contacts.",
    highlight: "Family Defense",
  },
  {
    icon: Server,
    title: "Enterprises",
    text: "Help reduce CEO, CXO, employee and customer-support impersonation risks.",
    highlight: "Corporate Shield",
  },
  {
    icon: Globe2,
    title: "Indian Languages",
    text: "Support safer communication across diverse Indian-language environments.",
    highlight: "25+ Dialects",
  },
  {
    icon: LockKeyhole,
    title: "Financial Protection",
    text: "Provide additional warning signals before sensitive information or transactions are shared.",
    highlight: "Transaction Guard",
  },
];

const defaultSignals = [
  { id: "acoustic", label: "Acoustic characteristics", weight: 18, active: true },
  { id: "spectral", label: "Spectral artifacts", weight: 22, active: true },
  { id: "prosody", label: "Prosody consistency", weight: 14, active: false },
  { id: "identity", label: "Speaker identity", weight: 20, active: true },
  { id: "intent", label: "Speech & scam intent", weight: 12, active: false },
  { id: "context", label: "Caller context", weight: 6, active: false },
  { id: "device", label: "Device behaviour", weight: 4, active: false },
  { id: "transaction", label: "Transaction signals", weight: 4, active: true },
];

const customStyles = `
  @keyframes floatSlow {
    0%, 100% { transform: translateY(0px) scale(1); }
    50% { transform: translateY(-8px) scale(1.02); }
  }

  @keyframes pulseSubtle {
    0%, 100% { opacity: 0.35; transform: scale(1); }
    50% { opacity: 0.65; transform: scale(1.08); }
  }

  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(1000%); }
  }

  .animate-float {
    animation: floatSlow 6s ease-in-out infinite;
  }

  .animate-pulse-subtle {
    animation: pulseSubtle 5s ease-in-out infinite;
  }

  .glass-card-tech {
    background: rgba(13, 20, 33, 0.7);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(34, 211, 238, 0.12);
  }

  .glass-card-tech:hover {
    border-color: rgba(34, 211, 238, 0.4);
    box-shadow: 0 16px 40px -12px rgba(6, 182, 212, 0.22),
                0 0 0 1px rgba(34, 211, 238, 0.2);
  }

  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.001s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001s !important;
      scroll-behavior: auto !important;
    }
  }
`;

function useScrollReveal() {
  const [revealed, setRevealed] = useState(false);
  const domRef = useRef(null);

  useEffect(() => {
    const node = domRef.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.07, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [domRef, revealed];
}

export default function About() {
  // Scroll reveal section references
  const [heroRef, heroRevealed] = useScrollReveal();
  const [motiveRef, motiveRevealed] = useScrollReveal();
  const [workflowRef, workflowRevealed] = useScrollReveal();
  const [techRef, techRevealed] = useScrollReveal();
  const [archRef, archRevealed] = useScrollReveal();
  const [benefitsRef, benefitsRevealed] = useScrollReveal();
  const [usesRef, usesRevealed] = useScrollReveal();
  const [trustRef, trustRevealed] = useScrollReveal();
  const [futureRef, futureRevealed] = useScrollReveal();
  const [ctaRef, ctaRevealed] = useScrollReveal();

  // Interactive state
  const [activeWorkflowIndex, setActiveWorkflowIndex] = useState(0);
  const [isWorkflowAutoPlaying, setIsWorkflowAutoPlaying] = useState(true);
  const [selectedTech, setSelectedTech] = useState(technologies[0].id);
  const [activeSignals, setActiveSignals] = useState(defaultSignals);
  const [activeUseTab, setActiveUseTab] = useState(0);

  // Workflow auto-stepping
  useEffect(() => {
    if (!isWorkflowAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveWorkflowIndex((prev) => (prev + 1) % workflow.length);
    }, 4200);
    return () => clearInterval(interval);
  }, [isWorkflowAutoPlaying]);

  // Compute live risk score based on active signal weights
  const currentRiskScore = useMemo(() => {
    const totalWeight = activeSignals.reduce(
      (acc, s) => (s.active ? acc + s.weight : acc),
      0
    );
    // Base ambient noise of 4%
    return Math.min(100, Math.max(0, totalWeight + 4));
  }, [activeSignals]);

  const toggleSignal = (id) => {
    setActiveSignals((prev) =>
      prev.map((sig) => (sig.id === id ? { ...sig, active: !sig.active } : sig))
    );
  };

  const resetSignals = () => {
    setActiveSignals(defaultSignals);
  };

  const getRiskStatus = (score) => {
    if (score >= 70) {
      return {
        label: "CRITICAL IMPERSONATION RISK",
        color: "text-rose-400",
        border: "border-rose-500/40",
        bg: "bg-rose-950/40",
        action: "Trigger mandatory callback verification & freeze transaction",
      };
    }
    if (score >= 40) {
      return {
        label: "ELEVATED SUSPICION DETECTED",
        color: "text-amber-400",
        border: "border-amber-500/40",
        bg: "bg-amber-950/40",
        action: "Request contextual secondary authorization & pause dialogue",
      };
    }
    return {
      label: "NOMINAL - LOW PROBABILITY",
      color: "text-emerald-400",
      border: "border-emerald-500/40",
      bg: "bg-emerald-950/40",
      action: "Audio signals within expected human baseline parameters",
    };
  };

  const riskStatus = getRiskStatus(currentRiskScore);
  const currentTechData = technologies.find((t) => t.id === selectedTech) || technologies[0];
  const activeWorkflowItem = workflow[activeWorkflowIndex];

  return (
    <div className="about-page relative min-h-screen overflow-hidden bg-[#070b13] text-white font-sans selection:bg-cyan-500 selection:text-slate-950">
      <style>{customStyles}</style>

      {}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-1/2 -top-40 h-[650px] w-[1000px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[160px] animate-pulse-subtle" />
        <div className="absolute right-[-15%] top-[35%] h-[500px] w-[600px] rounded-full bg-indigo-600/10 blur-[150px]" />
        <div className="absolute left-[-10%] top-[65%] h-[550px] w-[650px] rounded-full bg-teal-600/10 blur-[160px]" />
        {/* Subtle Cyber Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_10%,#000_65%,transparent_100%)]" />
      </div>

      {}
      <section
        ref={heroRef}
        className={`relative z-10 px-6 pb-24 pt-20 md:px-10 lg:px-16 transition-all duration-700 ${
          heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="relative mx-auto max-w-6xl text-center">
          {/* Glowing Pill Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/40 px-4 py-2 text-xs font-bold tracking-[0.18em] text-cyan-300 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Sparkles size={14} className="animate-spin text-cyan-400" style={{ animationDuration: "10s" }} />
            ABOUT SWARAKSHA
            <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            Your voice.
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              Our priority.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
            Swaraksha is an AI-powered voice security platform designed to
            detect voice-cloning and impersonation attacks in real time and
            help users take the right security action before a suspicious
            conversation becomes a serious threat.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 backdrop-blur-md transition hover:border-cyan-400/50 hover:text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> AI Powered
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 backdrop-blur-md transition hover:border-cyan-400/50 hover:text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-teal-400" /> Real-Time
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 backdrop-blur-md transition hover:border-cyan-400/50 hover:text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-indigo-400" /> Multilingual
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 backdrop-blur-md transition hover:border-cyan-400/50 hover:text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Security First
            </span>
          </div>
        </div>
      </section>

      {}
      <section
        ref={motiveRef}
        className={`relative z-10 border-y border-slate-800/70 bg-[#0a101b]/90 backdrop-blur-xl px-6 py-20 md:px-10 lg:px-16 transition-all duration-700 ${
          motiveRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold tracking-[0.2em] text-cyan-400">
              WHY SWARAKSHA
            </p>

            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              Trust should not depend
              <span className="text-cyan-400"> only on a voice.</span>
            </h2>

            <p className="mt-6 leading-8 text-slate-300">
              AI voice cloning can make fraudulent speech sound remarkably
              convincing. Traditional caller ID and human voice familiarity
              cannot independently establish that the person speaking is
              genuine.
            </p>

            <p className="mt-4 leading-8 text-slate-400">
              Swaraksha is designed around a different approach: analyze the
              voice, verify the speaker, understand the conversation and
              combine these signals into an actionable security assessment.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Detect", "Identify suspicious synthetic or cloned voice patterns.", "01"],
              ["Verify", "Compare speaker characteristics with trusted references.", "02"],
              ["Understand", "Analyze speech and potential scam intent.", "03"],
              ["Protect", "Provide warnings and recommended security actions.", "04"],
            ].map(([title, text, num], index) => (
              <div
                key={title}
                className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0d1421]/90 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_10px_30px_-10px_rgba(6,182,212,0.18)]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 group-hover:scale-110 transition-transform">
                    <span className="text-sm font-black">{num}</span>
                  </div>
                  <span className="text-xs font-mono tracking-wider text-slate-600 group-hover:text-cyan-400/70 transition-colors">
                    STAGE_{index + 1}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section
        ref={workflowRef}
        className={`relative z-10 px-6 py-24 md:px-10 lg:px-16 transition-all duration-700 ${
          workflowRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-bold tracking-[0.2em] text-cyan-400">
              HOW SWARAKSHA WORKS
            </p>

            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              From voice input to
              <span className="text-cyan-400"> protection</span>
            </h2>

            <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400">
              Every stage contributes to a broader security decision rather
              than depending on a single detection signal.
            </p>
          </div>

          {/* Interactive Stepper Navigation Bar */}
          <div className="mt-12 rounded-2xl border border-slate-800 bg-[#0c121e]/80 p-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                <Workflow size={15} />
                <span>INTERACTIVE PIPELINE RUNTIME</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsWorkflowAutoPlaying(!isWorkflowAutoPlaying)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400 transition"
                  title="Toggle automatic walkthrough"
                >
                  {isWorkflowAutoPlaying ? <Pause size={13} className="text-amber-400" /> : <Play size={13} className="text-emerald-400" />}
                  <span>{isWorkflowAutoPlaying ? "Pause Auto-Step" : "Auto Play"}</span>
                </button>
              </div>
            </div>

            {/* Stepper Node Chips */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {workflow.map((item, idx) => {
                const isActive = idx === activeWorkflowIndex;
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.number}
                    onClick={() => {
                      setActiveWorkflowIndex(idx);
                      setIsWorkflowAutoPlaying(false);
                    }}
                    className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all ${
                      isActive
                        ? "bg-cyan-500/20 border border-cyan-400 text-white shadow-lg shadow-cyan-500/20"
                        : "border border-slate-800/80 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                      <ItemIcon size={14} className={isActive ? "text-cyan-400" : "text-slate-500"} />
                      <span>{item.number}</span>
                    </div>
                    <span className="mt-1 text-xs font-semibold truncate w-full">{item.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Active Step Focus Spotlight */}
          <div className="mt-6 rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/90 via-[#0a1426] to-slate-900/90 p-6 md:p-8 backdrop-blur-xl shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                  {React.createElement(activeWorkflowItem.icon, { size: 28 })}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-cyan-400/30 bg-cyan-950/70 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                      STAGE {activeWorkflowItem.number} OF 06
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-cyan-400 font-mono">{activeWorkflowItem.badge}</span>
                  </div>
                  <h3 className="mt-1 text-2xl font-black text-white">{activeWorkflowItem.title}</h3>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-2xl">
                    {activeWorkflowItem.description}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-black/40 p-4 shrink-0 md:min-w-[260px]">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Engine Telemetry:</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-mono">
                    <Radio size={12} className="animate-pulse" /> LIVE
                  </span>
                </div>
                <div className="font-mono text-xs text-cyan-300/90 leading-relaxed bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  {activeWorkflowItem.techSignal}
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Cards Grid */}
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {workflow.map((item, idx) => {
              const Icon = item.icon;
              const isCurrent = idx === activeWorkflowIndex;

              return (
                <div
                  key={item.number}
                  onClick={() => {
                    setActiveWorkflowIndex(idx);
                    setIsWorkflowAutoPlaying(false);
                  }}
                  className={`group cursor-pointer rounded-2xl border p-6 transition-all duration-300 ${
                    isCurrent
                      ? "border-cyan-400 bg-[#0d172b] shadow-xl shadow-cyan-500/15 -translate-y-1.5"
                      : "border-slate-800 bg-[#0c121e] hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-[#0e1626]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
                      isCurrent
                        ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/40 scale-110"
                        : "bg-cyan-400/10 text-cyan-400 group-hover:scale-105"
                    }`}>
                      <Icon size={22} />
                    </div>

                    <span className={`text-3xl font-black transition-colors ${
                      isCurrent ? "text-cyan-400/60" : "text-slate-800 group-hover:text-slate-700"
                    }`}>
                      {item.number}
                    </span>
                  </div>

                  <h3 className={`mt-6 text-xl font-bold transition-colors ${
                    isCurrent ? "text-cyan-300" : "text-white group-hover:text-cyan-300"
                  }`}>
                    {item.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {}
      <section
        ref={techRef}
        className={`relative z-10 border-y border-slate-800/70 bg-[#0a101b]/95 backdrop-blur-xl px-6 py-24 md:px-10 lg:px-16 transition-all duration-700 ${
          techRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold tracking-[0.2em] text-cyan-400">
              TECHNOLOGY
            </p>

            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              Built as a
              <span className="text-cyan-400"> multi-layer AI system</span>
            </h2>

            <p className="mt-5 leading-8 text-slate-300">
              Swaraksha combines specialized AI models, real-time
              communication and security infrastructure to create a complete
              voice-protection workflow.
            </p>
          </div>

          {/* Interactive Technology Inspector Banner */}
          <div className="mt-10 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-5 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Cpu size={20} />
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-300">
                    Inspecting Architecture Spec
                  </div>
                  <div className="text-base font-bold text-white flex items-center gap-2">
                    <span>{currentTechData.title}</span>
                    <span className="text-xs font-normal text-slate-400">— {currentTechData.subtitle}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-slate-300">
                  <span className="text-slate-500">Latency: </span>
                  <span className="font-mono text-cyan-300 font-bold">{currentTechData.latency}</span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-slate-300">
                  <span className="text-slate-500">Benchmark: </span>
                  <span className="font-mono text-emerald-300 font-bold">{currentTechData.metrics}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-800/80 pt-2.5 text-xs font-mono text-slate-400">
              <span className="text-indigo-400">Tensor Flow: </span>
              {currentTechData.tensorSpec}
            </div>
          </div>

          {/* Technology Cards Grid */}
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {technologies.map((tech) => {
              const Icon = tech.icon;
              const isSelected = selectedTech === tech.id;

              return (
                <div
                  key={tech.title}
                  onClick={() => setSelectedTech(tech.id)}
                  className={`group relative cursor-pointer rounded-2xl border p-6 transition-all duration-300 ${
                    isSelected
                      ? "border-indigo-400/80 bg-[#121b30] shadow-xl shadow-indigo-500/15 -translate-y-1"
                      : "border-slate-800 bg-[#0d1421] hover:border-slate-700 hover:bg-[#101828]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300 border border-indigo-400/20 group-hover:scale-105 transition-transform">
                      <Icon size={22} />
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-indigo-500/20 border border-indigo-400/40 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-300">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {tech.title}
                  </h3>

                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-cyan-400">
                    {tech.subtitle}
                  </p>

                  <p className="mt-4 text-sm leading-7 text-slate-400">
                    {tech.description}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-500">
                    <span>{tech.latency}</span>
                    <span className="text-cyan-400 group-hover:underline">Inspect spec →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {}
      <section
        ref={archRef}
        className={`relative z-10 px-6 py-24 md:px-10 lg:px-16 transition-all duration-700 ${
          archRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-[#10182a]/95 to-[#0b111d]/95 p-7 md:p-12 backdrop-blur-2xl shadow-2xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                  <Database size={28} />
                </div>

                <h2 className="mt-6 text-3xl font-black">
                  One pipeline.
                  <br />
                  <span className="text-cyan-400">
                    Multiple security signals.
                  </span>
                </h2>

                <p className="mt-5 leading-8 text-slate-300">
                  Instead of treating voice cloning as an isolated problem,
                  Swaraksha combines several signals before generating its
                  security assessment.
                </p>

                {/* Live Dynamic Risk Meter */}
                <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Interactive Risk Fusion Meter
                    </span>
                    <button
                      onClick={resetSignals}
                      className="text-[11px] text-cyan-400 hover:underline inline-flex items-center gap-1"
                    >
                      <RotateCcw size={11} /> Reset
                    </button>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <div className="text-4xl font-extrabold text-white">
                      {currentRiskScore}
                      <span className="text-sm font-normal text-slate-500"> / 100</span>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2 py-1 rounded-md border ${riskStatus.border} ${riskStatus.bg} ${riskStatus.color}`}>
                      {riskStatus.label}
                    </span>
                  </div>

                  {/* Progress Bar with Color Transitions */}
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        currentRiskScore >= 70
                          ? "bg-gradient-to-r from-amber-500 to-rose-500"
                          : currentRiskScore >= 40
                          ? "bg-gradient-to-r from-cyan-400 to-amber-400"
                          : "bg-gradient-to-r from-teal-400 to-emerald-400"
                      }`}
                      style={{ width: `${currentRiskScore}%` }}
                    />
                  </div>

                  <p className="mt-3 text-xs text-slate-400 italic">
                    Recommendation: {riskStatus.action}
                  </p>
                </div>
              </div>

              {/* Toggleable Security Signal Badges */}
              <div>
                <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Toggle signals to simulate multi-factor score:</span>
                  <span>{activeSignals.filter((s) => s.active).length} of {activeSignals.length} active</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {activeSignals.map((signal) => (
                    <button
                      key={signal.label}
                      onClick={() => toggleSignal(signal.id)}
                      className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                        signal.active
                          ? "border-cyan-400/50 bg-cyan-950/30 text-white shadow-md shadow-cyan-500/10"
                          : "border-slate-800/80 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          signal.active ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-slate-700 bg-slate-900"
                        }`}>
                          {signal.active && <Check size={13} strokeWidth={3} />}
                        </div>
                        <span className="text-sm font-medium">{signal.label}</span>
                      </div>
                      <span className="font-mono text-xs text-slate-500">+{signal.weight}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {}
      <section
        ref={benefitsRef}
        className={`relative z-10 border-y border-slate-800/70 bg-[#0a101b]/90 backdrop-blur-xl px-6 py-24 md:px-10 lg:px-16 transition-all duration-700 ${
          benefitsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-bold tracking-[0.2em] text-cyan-400">
              BENEFITS
            </p>

            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              More than detection.
              <span className="text-cyan-400"> Real protection.</span>
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
            {benefits.map((benefit, idx) => (
              <div
                key={benefit}
                className="group flex items-start gap-4 rounded-xl border border-slate-800 bg-[#0d1421] p-5 transition-all duration-300 hover:border-emerald-500/40 hover:bg-[#101b2a] hover:-translate-y-0.5"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={18} />
                </div>

                <p className="text-sm leading-6 text-slate-300 group-hover:text-white transition-colors">
                  {benefit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {}
      <section
        ref={usesRef}
        className={`relative z-10 px-6 py-24 md:px-10 lg:px-16 transition-all duration-700 ${
          usesRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold tracking-[0.2em] text-cyan-400">
              WHERE IT CAN BE USED
            </p>

            <h2 className="mt-3 text-3xl font-black md:text-5xl">
              Protection across
              <span className="text-cyan-400"> real-world scenarios</span>
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {uses.map((item, idx) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-[#0c121e] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-cyan-400/40 hover:shadow-xl hover:shadow-cyan-500/10"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 group-hover:scale-110 transition-transform">
                        <Icon size={22} />
                      </div>
                      <span className="rounded-full bg-slate-900 border border-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                        {item.highlight}
                      </span>
                    </div>

                    <h3 className="mt-5 font-bold text-white text-lg group-hover:text-cyan-300 transition-colors">
                      {item.title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-slate-400">
                      {item.text}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-1 text-xs font-semibold text-cyan-400">
                    <span>Target Deployment</span>
                    <ChevronRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {}
      <section
        ref={trustRef}
        className={`relative z-10 border-y border-slate-800/70 bg-[#0a101b]/95 backdrop-blur-xl px-6 py-24 md:px-10 lg:px-16 transition-all duration-700 ${
          trustRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold tracking-[0.2em] text-cyan-400">
                WHY TRUST SWARAKSHA
              </p>

              <h2 className="mt-3 text-3xl font-black md:text-5xl">
                Security through
                <span className="text-cyan-400"> multiple layers</span>
              </h2>

              <p className="mt-6 leading-8 text-slate-300">
                Swaraksha is designed so that a single voice signal does not
                have to determine the entire security decision. Different
                analytical layers contribute evidence to the final assessment.
              </p>

              <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-950/20 p-5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={28} className="text-cyan-400" />
                  <div>
                    <h4 className="font-bold text-white text-sm">Resilient Defense Philosophy</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      No single point of failure in our acoustic identification or transcription pipeline.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: BrainCircuit,
                  title: "Research-inspired AI",
                  text: "Uses specialized models for voice deepfake detection, speaker verification and speech analysis.",
                },
                {
                  icon: ShieldCheck,
                  title: "Multi-signal security",
                  text: "Combines several independent signals rather than relying solely on caller ID or voice familiarity.",
                },
                {
                  icon: LockKeyhole,
                  title: "Security-first architecture",
                  text: "Designed around authentication, protected communication, access control and secure data handling.",
                },
                {
                  icon: Zap,
                  title: "Actionable results",
                  text: "The objective is not just to identify suspicious audio but to help users respond appropriately.",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="group flex gap-4 rounded-2xl border border-slate-800 bg-[#0d1421] p-5 transition-all duration-300 hover:border-cyan-400/40 hover:bg-[#101b2a] hover:-translate-y-0.5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 group-hover:scale-110 transition-transform">
                      <Icon size={20} />
                    </div>

                    <div>
                      <h3 className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {}
      <section
        ref={futureRef}
        className={`relative z-10 px-6 py-24 md:px-10 lg:px-16 transition-all duration-700 ${
          futureRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-5xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 shadow-[0_0_20px_rgba(6,182,212,0.2)] animate-float">
            <Globe2 size={30} />
          </div>

          <h2 className="mt-7 text-3xl font-black md:text-5xl">
            Building a safer future for
            <span className="text-cyan-400"> digital communication</span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl leading-8 text-slate-300">
            Voice-based attacks will continue to evolve as generative AI
            becomes more capable. Swaraksha is designed as a modular platform
            that can incorporate improved detection models, new languages,
            additional integrations and emerging threat intelligence over
            time.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {[
              "New AI Models",
              "More Indian Languages",
              "Telephony Integration",
              "Enterprise Security",
              "Threat Intelligence",
              "Continuous Improvement",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {}
      <section
        ref={ctaRef}
        className={`relative z-10 border-t border-slate-800/70 bg-[#0a101b] px-6 py-20 transition-all duration-700 ${
          ctaRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-4xl rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/10 via-slate-900 to-indigo-500/10 p-8 text-center md:p-14 backdrop-blur-2xl shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <ShieldCheck size={36} />
          </div>

          <h2 className="mt-5 text-3xl font-black md:text-4xl">
            Detect. Verify. Protect.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-300">
            Explore the Live Demo to see how Swaraksha analyzes voice signals
            and generates a real-time security assessment.
          </p>

          <a
            href="/live-demo"
            className="group mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 px-7 py-3.5 font-bold text-slate-950 shadow-lg shadow-cyan-400/20 transition-all duration-300 hover:scale-[1.03] hover:shadow-cyan-400/40 active:scale-95"
          >
            Try Live Demo
            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </div>
      </section>
    </div>
  );
}