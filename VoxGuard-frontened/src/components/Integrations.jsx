import { CheckCircle2, ShieldCheck, ArrowUpRight, Cpu } from "lucide-react";
import Badge from "./Badge";

const integrations = [
  { name: "REST API", status: "Zero-Config Ingestion", latency: "<45ms" },
  { name: "gRPC Streaming", status: "Auto-Interception", latency: "<15ms" },
  { name: "WebSocket Feed", status: "Real-time Stream", latency: "<20ms" },
  { name: "Direct Telephony SIP", status: "Inline Gateway", latency: "<30ms" },
  { name: "Frontend Hook", status: "Auto-Sync", latency: "Instant" },
  { name: "Automated Webhooks", status: "Instant Alert Trigger", latency: "Async" },
];

export default function Integrations() {
  return (
    <section id="integrations" className="relative mx-auto max-w-7xl px-5 py-24 overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute left-1/4 top-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-cyan-500/10 blur-[130px]" />

      <div className="group relative rounded-3xl border border-indigo-500/20 bg-[#0c121e]/85 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-cyan-400/30 md:p-14">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          
          {/* Left Column: Context & Automation Spotlight */}
          <div className="lg:col-span-5">
            <Badge>INTEGRATIONS</Badge>
            
            <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              Plug into existing{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                security workflows.
              </span>
            </h2>

            <p className="mt-5 text-base leading-7 text-slate-400">
              Just provide the audio input. VoxGuard automatically performs feature extraction, neural scoring, and artifact detection end-to-end.
            </p>

            {/* Handled by VoxGuard Feature Spotlight */}
            <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4.5 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  <Cpu className="h-4 w-4 animate-pulse" /> Autonomous Pipeline
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                  <ShieldCheck className="h-3 w-3 text-cyan-400" />
                  Handled by VoxGuard
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-300">
                Audio streams pass directly into our neural inference engine. No complex client setup or manual feature tuning required.
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Protocol Grid */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:col-span-7">
            {integrations.map(({ name, status, latency }) => (
              <div
                key={name}
                className="group/item flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-slate-800/60 hover:shadow-md hover:shadow-cyan-500/10 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all duration-300 group-hover/item:scale-110 group-hover/item:bg-emerald-500/20">
                    <CheckCircle2 size={16} className="stroke-[2.5]" />
                  </span>
                  <div>
                    <b className="block text-sm font-semibold text-slate-200 transition-colors group-hover/item:text-white">
                      {name}
                    </b>
                    <span className="text-[11px] text-slate-500 group-hover/item:text-slate-400">
                      {status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="rounded-full border border-slate-800 bg-slate-950/70 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                    {latency}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-600 transition-all duration-300 group-hover/item:text-cyan-400 group-hover/item:translate-x-0.5 group-hover/item:-translate-y-0.5" />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}