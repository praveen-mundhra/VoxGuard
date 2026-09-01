import { ChevronRight, Radio } from "lucide-react";
import Badge from "./Badge";
import RiskGauge from "./RiskGauge";

export default function Hero() {
  return (
    <section id="dashboard" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:grid-cols-2 md:items-center md:py-28">
      <div>
        <Badge>AI-DRIVEN VOICE SECURITY</Badge>
        <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight md:text-7xl">
          Stop voice cloning <span className="text-cyan-300">before it becomes fraud.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
          VoiceGuard analyzes live voice signals, detects synthetic speech and impersonation patterns,
          and delivers an actionable risk score before sensitive decisions are made.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#demo" className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-slate-950">
            Try Live Detection <ChevronRight className="ml-1 inline" size={18} />
          </a>
          <a href="#how-it-works" className="rounded-xl border border-slate-700 px-6 py-3 font-semibold">
            Explore Platform
          </a>
        </div>

        <div className="mt-10 grid max-w-lg grid-cols-3 gap-4">
          {[
            ["<1s", "Near-real-time"],
            ["4-Layer", "Analysis"],
            ["10+", "Languages ready"],
          ].map(([a, b]) => (
            <div key={a}>
              <b className="text-xl">{a}</b>
              <p className="text-xs text-slate-500">{b}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-3xl p-6 md:p-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-400/10 text-rose-300">
              <Radio />
            </span>
            <div>
              <b>LIVE CALL MONITOR</b>
              <p className="text-xs text-slate-500">Enterprise secure channel</p>
            </div>
          </div>
          <span className="flex items-center gap-2 text-xs text-emerald-300">
            <i className="h-2 w-2 rounded-full bg-emerald-400" />ACTIVE
          </span>
        </div>

        <RiskGauge score={18} />

        <div className="mt-7 grid grid-cols-2 gap-3">
          {[
            ["Voice authenticity", "98.2%"],
            ["Speaker match", "96.8%"],
            ["Prosody", "94.1%"],
            ["Context risk", "LOW"],
          ].map(([a, b]) => (
            <div className="rounded-xl border border-slate-800 p-4" key={a}>
              <p className="text-xs text-slate-500">{a}</p>
              <b className="mt-1 block">{b}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}