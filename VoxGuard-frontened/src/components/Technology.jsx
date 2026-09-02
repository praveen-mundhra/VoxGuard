import { Globe2, Lock, Phone, Server, CheckCircle2 } from "lucide-react";
import Badge from "./Badge";

const features = [
  {
    Icon: Server,
    title: "Edge inference",
    description: "Keep sensitive audio close to the source with sub-second processing latency.",
    tag: "High Throughput",
  },
  {
    Icon: Lock,
    title: "Privacy-first",
    description: "Zero-audio storage policy, feature-only logging, and ephemeral memory buffers.",
    tag: "GDPR Compliant",
  },
  {
    Icon: Globe2,
    title: "Multilingual",
    description: "Language-agnostic acoustic features tuned for Indian accents and regional dialects.",
    tag: "Dialect Resilient",
  },
  {
    Icon: Phone,
    title: "Telephony ready",
    description: "Drop-in REST and gRPC connectors for SIP trunks, PBX, and mobile SDK pipelines.",
    tag: "REST & gRPC",
  },
];

export default function Technology() {
  return (
    <section
      id="technology"
      className="relative border-y border-indigo-500/20 bg-[#08101e] py-24 overflow-hidden"
    >
      {/* Background Decorative Radial Gradient */}
      <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px]" />
      
      <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-12 md:items-center">
        
        {/* Left Column: Context & Overview */}
        <div className="md:col-span-5">
          <Badge>ENGINEERED FOR TRUST</Badge>
          
          <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Built for real-world{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              communication
            </span>{" "}
            environments.
          </h2>

          <p className="mt-5 text-base leading-7 text-slate-400">
            Deployed at the edge or in private cloud infrastructure. VoxGuard processes audio signals with minimal overhead, maintaining security without interrupting live conversations.
          </p>

          {/* Quick Checklist */}
          <ul className="mt-8 space-y-3.5 text-sm font-medium text-slate-300">
            {[
              "Sub-50ms tokenization pipeline",
              "End-to-end encrypted payloads",
              "Seamless SIP & WebRTC stream interception",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Column: Interactive Feature Cards */}
        <div className="grid gap-5 sm:grid-cols-2 md:col-span-7">
          {features.map(({ Icon, title, description, tag }) => (
            <div
              key={title}
              className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-cyan-400/40 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div>
                {/* Header Icon + Chip */}
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-400/10 text-cyan-300 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                    <Icon className="h-5 w-5 stroke-[2.2]" />
                  </span>
                  
                  <span className="rounded-full border border-slate-800 bg-slate-950/60 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 transition-colors group-hover:border-cyan-500/30 group-hover:text-cyan-300">
                    {tag}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="mt-5 text-lg font-bold text-white transition-colors group-hover:text-cyan-200">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {description}
                </p>
              </div>

              {/* Bottom Subtle Indicator Bar */}
              <div className="mt-5 h-0.5 w-0 bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-300 group-hover:w-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}