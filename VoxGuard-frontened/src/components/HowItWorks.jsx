import { Activity, AlertTriangle, BrainCircuit, Mic } from "lucide-react";
import Badge from "./Badge";

const layers = [
  {
    Icon: Mic,
    n: "01",
    title: "Acoustic & spectral",
    description: "Detect synthesis artifacts, phase inconsistencies and spectral signatures.",
    glow: "group-hover:border-cyan-400/50 group-hover:shadow-cyan-500/10",
    badgeColor: "text-cyan-400 bg-cyan-400/10 border-cyan-500/20",
  },
  {
    Icon: Activity,
    n: "02",
    title: "Prosody & behavior",
    description: "Model pitch, rhythm, pauses and natural micro-variations.",
    glow: "group-hover:border-indigo-400/50 group-hover:shadow-indigo-500/10",
    badgeColor: "text-indigo-400 bg-indigo-400/10 border-indigo-500/20",
  },
  {
    Icon: BrainCircuit,
    n: "03",
    title: "Identity consistency",
    description: "Compare the live speaker against trusted historical voice samples.",
    glow: "group-hover:border-purple-400/50 group-hover:shadow-purple-500/10",
    badgeColor: "text-purple-400 bg-purple-400/10 border-purple-500/20",
  },
  {
    Icon: AlertTriangle,
    n: "04",
    title: "Risk intelligence",
    description: "Fuse voice and context signals into an actionable risk score.",
    glow: "group-hover:border-emerald-400/50 group-hover:shadow-emerald-500/10",
    badgeColor: "text-emerald-400 bg-emerald-400/10 border-emerald-500/20",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative mx-auto max-w-7xl px-5 py-24 overflow-hidden">
      {/* Background Decorative Gradient */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-[650px] rounded-full bg-indigo-500/5 blur-[140px]" />

      {/* Section Header */}
      <div className="max-w-2xl">
        <Badge>HOW IT WORKS</Badge>
        <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
          Four layers.{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            One decision.
          </span>
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-400 md:text-lg">
          A defense-in-depth pipeline combines signal intelligence, speaker behavior, and transaction context in real time.
        </p>
      </div>

      {/* Pipeline Process Grid */}
      <div className="relative mt-14 grid gap-3 md:grid-cols-4">
        {layers.map(({ Icon, n, title, description, glow, badgeColor }, index) => (
          <div
            key={n}
            className={`group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-[#0c121e]/80 p-6 backdrop-blur-xl shadow-xl transition-all duration-300 hover:-translate-y-1.5 ${glow}`}
          >
            {/* Top Indicator & Step */}
            <div>
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-12 w-12 place-items-center rounded-xl border transition-all duration-300 group-hover:scale-110 ${badgeColor}`}
                >
                  <Icon className="h-6 w-6 stroke-[2.2] transition-transform duration-300 group-hover:rotate-6" />
                </span>

                <span className="font-mono text-xs font-bold tracking-widest text-slate-500 transition-colors group-hover:text-cyan-400">
                  LAYER {n}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="mt-6 text-lg font-bold tracking-tight text-slate-100 transition-colors duration-200 group-hover:text-white">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
            </div>

            {/* Bottom Pipeline Progress Bar */}
            <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Step {index + 1} of 4
              </span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-500 group-hover:w-full"
                  style={{ width: `${(index + 1) * 25}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}