import { CheckCircle2 } from "lucide-react";
import Badge from "./Badge";

const integrations = ["REST API", "gRPC", "WebSocket", "Python SDK", "React SDK", "Webhook Alerts"];

export default function Integrations() {
  return (
    <section id="integrations" className="mx-auto max-w-7xl px-5 py-20">
      <div className="glass rounded-3xl p-8 md:p-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <Badge>INTEGRATIONS</Badge>
            <h2 className="mt-4 text-4xl font-black">Plug into existing security workflows.</h2>
            <p className="mt-4 text-slate-400">
              Expose a clean API to banking, contact-center, enterprise communication and telecom systems.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {integrations.map((item) => (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 p-4 text-sm" key={item}>
                <CheckCircle2 size={17} className="text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}