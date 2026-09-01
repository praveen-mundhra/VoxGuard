import { Globe2, Lock, Phone, Server } from "lucide-react";
import Badge from "./Badge";

const features = [
  [Server, "Edge inference", "Keep sensitive audio close to the source."],
  [Lock, "Privacy-first", "Feature-only logging and minimal retention."],
  [Globe2, "Multilingual", "Language-agnostic features for Indian accents."],
  [Phone, "Telephony ready", "REST/gRPC integration for calls and workflows."],
];

export default function Technology() {
  return (
    <section id="technology" className="border-y border-slate-800/60 bg-[#081525]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 md:grid-cols-2">
        <div>
          <Badge>ENGINEERED FOR TRUST</Badge>
          <h2 className="mt-4 text-4xl font-black">Built for real communication environments</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {features.map(([Icon, title, description]) => (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5" key={title}>
              <Icon className="text-cyan-300" />
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-2 text-sm text-slate-400">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}