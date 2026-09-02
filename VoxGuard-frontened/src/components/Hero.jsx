import { ChevronRight, Radio, Activity, ShieldCheck } from "lucide-react";
import Badge from "./Badge";
import RiskGauge from "./RiskGauge";

export default function Hero() {
  return (
    <section
      id="dashboard"
      className="relative mx-auto grid max-w-7xl gap-12 overflow-hidden px-5 py-20 md:grid-cols-2 md:items-center md:py-28"
    >
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-indigo-500/10 blur-[120px]" />

      {/* Left Column - Hero Pitch */}
      <div className="relative z-10 transition-all duration-700">
        <Badge>AI-DRIVEN VOICE SECURITY</Badge>
        
        <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight text-white md:text-7xl">
          Stop voice cloning{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            before it becomes fraud.
          </span>
        </h1>
        
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
          VoiceGuard analyzes live voice signals, detects synthetic speech and impersonation patterns,
          and delivers an actionable risk score before sensitive decisions are made.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-6 py-3.5 font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-cyan-400/40 active:translate-y-0"
          >
            Try Live Detection
            <ChevronRight
              size={18}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </a>
          
          <a
            href="#how-it-works"
            className="inline-flex items-center rounded-xl border border-slate-700/80 bg-slate-900/40 px-6 py-3.5 font-semibold text-slate-200 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800/60"
          >
            Explore Platform
          </a>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-slate-800/80 pt-8">
          {[
            ["<1s", "Near-real-time"],
            ["4-Layer", "Analysis"],
            ["10+", "Languages ready"],
          ].map(([val, label]) => (
            <div key={val} className="group">
              <b className="bg-gradient-to-br from-white to-slate-300 bg-clip-text text-2xl font-black text-transparent transition-colors group-hover:text-cyan-300">
                {val}
              </b>
              <p className="mt-1 text-xs font-medium text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column - Interactive Live Monitor Glass Panel */}
      <div className="group relative z-10 rounded-3xl border border-indigo-500/20 bg-[#0c121e]/80 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl transition-all duration-500 hover:border-cyan-400/40 hover:shadow-cyan-500/10 md:p-10">
        
        {/* Panel Header */}
        <div className="mb-8 flex items-center justify-between border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3.5">
            <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-rose-500/10 text-rose-400">
              <Radio className="h-5 w-5 animate-pulse" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-ping rounded-full bg-rose-500" />
            </span>
            <div>
              <b className="block text-sm tracking-wide text-slate-200">LIVE CALL MONITOR</b>
              <p className="text-xs text-slate-400">Enterprise secure channel</p>
            </div>
          </div>

          {/* Active Status Badge */}
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-sm shadow-emerald-500/20">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            ACTIVE
          </span>
        </div>

        {/* Live Audio Equalizer Waveform */}
        <div className="mb-6 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-800/60 bg-slate-950/40 py-3.5 px-4">
          <span className="text-[11px] font-semibold text-slate-500 mr-2 flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" /> LIVE STREAM
          </span>
          {[
            "h-4 animate-[bounce_1s_infinite_100ms]",
            "h-7 animate-[bounce_1s_infinite_300ms]",
            "h-3 animate-[bounce_1s_infinite_150ms]",
            "h-8 animate-[bounce_1s_infinite_400ms]",
            "h-5 animate-[bounce_1s_infinite_250ms]",
            "h-6 animate-[bounce_1s_infinite_350ms]",
            "h-3 animate-[bounce_1s_infinite_200ms]"
          ].map((animClass, idx) => (
            <span
              key={idx}
              className={`w-1 rounded-full bg-gradient-to-t from-cyan-400 to-indigo-500 ${animClass}`}
            />
          ))}
        </div>

        {/* Gauge Component */}
        <div className="py-2">
          <RiskGauge score={18} />
        </div>

        {/* Diagnostics & Metric Cards Grid */}
        <div className="mt-8 grid grid-cols-2 gap-3.5">
          {[
            ["Voice authenticity", "98.2%", "text-cyan-400", "border-cyan-500/20"],
            ["Speaker match", "96.8%", "text-emerald-400", "border-emerald-500/20"],
            ["Prosody", "94.1%", "text-indigo-400", "border-indigo-500/20"],
            ["Context risk", "LOW", "text-emerald-300", "border-slate-800"],
          ].map(([label, val, textColor, borderColor]) => (
            <div
              key={label}
              className={`group/card rounded-xl border ${borderColor} bg-slate-900/50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-slate-800/60`}
            >
              <p className="text-xs font-medium text-slate-400">{label}</p>
              <b className={`mt-1.5 block text-lg font-bold tracking-tight ${textColor}`}>
                {val}
              </b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}