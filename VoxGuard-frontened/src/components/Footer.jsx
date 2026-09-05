import { ShieldCheck, Lock, Activity, ArrowUp } from "lucide-react";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative border-t border-indigo-500/20 bg-[#060a12] text-slate-400 overflow-hidden">
      {/* Background Ambience & Lighting */}
      <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 h-48 w-[650px] rounded-full bg-cyan-500/10 blur-[130px]" />
      
      {/* Top Hairline Horizon Glow */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          
          {/* Brand & Micro Badge */}
          <div className="flex flex-col gap-2">
            <a href="#" className="group inline-flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-tr from-cyan-400 to-indigo-500 text-slate-950 shadow-md shadow-cyan-500/20 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                <ShieldCheck className="h-4 w-4 stroke-[2.2]" />
              </span>
              <span className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-base font-extrabold tracking-tight text-transparent">
                VoxGuard
              </span>
            </a>
            
            <p className="text-xs text-slate-500">
              Autonomous acoustic defense against synthetic voice cloning and live fraud.
            </p>
          </div>

          {/* Operational Status Pill */}
          <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-slate-800/90 bg-slate-950/70 px-3.5 py-1.5 text-xs text-slate-300 backdrop-blur-md md:self-auto">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
              Inference Core
            </span>
            <span className="font-semibold text-emerald-400">99.98% Operational</span>
          </div>

        </div>

        {/* Feature Highlights Bar */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-800/80 pt-6 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 transition-colors hover:text-cyan-300">
            <Activity className="h-3.5 w-3.5 text-cyan-400" /> Real-time signal analysis
          </span>
          <span className="text-slate-700">•</span>
          <span className="flex items-center gap-1.5 transition-colors hover:text-cyan-300">
            <Lock className="h-3.5 w-3.5 text-indigo-400" /> Ephemeral zero-audio logging
          </span>
          <span className="text-slate-700">•</span>
          <span className="transition-colors hover:text-cyan-300">
            gRPC / SIP gateway ready
          </span>
          <span className="text-slate-700">•</span>
          <span className="transition-colors hover:text-cyan-300">
            Automated step-up MFA triggers
          </span>
        </div>

        {/* Bottom Copyright & Back-to-top */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-800/50 pt-6 text-xs text-slate-500 sm:flex-row">
          <span>© 2026 VoxGuard. All rights reserved.</span>

          <button
            type="button"
            onClick={scrollToTop}
            className="group flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-400 transition-all duration-300 hover:border-cyan-500/40 hover:bg-slate-800 hover:text-cyan-300"
          >
            <span>Back to top</span>
            <ArrowUp className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          </button>
        </div>

      </div>
    </footer>
  );
}