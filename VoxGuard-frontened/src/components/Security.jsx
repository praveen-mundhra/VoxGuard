import { ShieldAlert, ArrowRight, Sparkles, Lock } from "lucide-react";
import Badge from "./Badge";

export default function Security() {
  return (
    <section id="security" className="relative mx-auto max-w-7xl px-5 pb-24 overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute -bottom-10 left-1/3 h-64 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />

      <div className="group relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 via-[#0c121e]/90 to-[#080d16] p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-cyan-400/40 hover:shadow-cyan-500/10 md:p-14">
        
        {/* Subtle Decorative Background Shield Watermark */}
        <ShieldAlert className="pointer-events-none absolute -bottom-10 -right-8 h-64 w-64 text-cyan-400/[0.03] transition-transform duration-700 group-hover:scale-105 group-hover:text-cyan-400/[0.05]" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          
          {/* Left Context */}
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <Badge>FRAUD PREVENTION</Badge>
              <span className="hidden items-center gap-1.5 text-xs font-semibold text-cyan-400 sm:inline-flex">
                <Lock className="h-3.5 w-3.5" /> Zero-Trust Audio
              </span>
            </div>

            <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              Never approve a high-risk transaction on{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                voice alone.
              </span>
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-300">
              Use VoxGuard as an automated defensive signal—not a single point of failure. Combine real-time voice verification with step-up MFA, callback protocols, and organizational policy controls.
            </p>
          </div>

          {/* Right Action CTA */}
          <div className="flex shrink-0 items-center">
            <a
              href="#demo"
              className="group/btn inline-flex w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-white via-slate-100 to-slate-200 px-7 py-4 text-sm font-extrabold text-slate-950 shadow-lg shadow-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-400/20 active:translate-y-0 sm:w-auto"
            >
              <Sparkles className="h-4 w-4 text-cyan-600 transition-transform duration-300 group-hover/btn:rotate-12" />
              <span>Run Live Demo</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}