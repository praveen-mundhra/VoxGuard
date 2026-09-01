import { Activity, AlertTriangle, BrainCircuit, Mic } from "lucide-react";
import Badge from "./Badge";

const layers = [
  [Mic, "01", "Acoustic & spectral", "Detect synthesis artifacts, phase inconsistencies and spectral signatures."],
  [Activity, "02", "Prosody & behavior", "Model pitch, rhythm, pauses and micro-variations."],
  [BrainCircuit, "03", "Identity consistency", "Compare the live speaker against trusted historical samples."],
  [AlertTriangle, "04", "Risk intelligence", "Fuse voice and context into a configurable risk score."],
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-24">
      <div className="max-w-2xl">
        <Badge>HOW IT WORKS</Badge>
        <h2 className="mt-4 text-4xl font-black">Four layers. One decision.</h2>
        <p className="mt-4 text-slate-400">
          A defense-in-depth pipeline combines signal intelligence, speaker behavior and transaction context.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-4">
        {layers.map(([Icon, n, title, description]) => (
          <div className="glass rounded-2xl p-6" key={n}>
            <Icon className="text-cyan-300" />
            <span className="mt-6 block text-xs text-slate-500">{n}</span>
            <h3 className="mt-2 font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}