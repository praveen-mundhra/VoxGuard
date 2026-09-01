import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Play, RefreshCw, Square } from "lucide-react";
import Badge from "./Badge";
import RiskGauge from "./RiskGauge";

export default function LiveDemo() {
  const [score, setScore] = useState(18);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready to analyze");
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const start = () => {
    setRunning(true);
    setStatus("Analyzing live audio…");
    let current = 18;

    timer.current = setInterval(() => {
      current = Math.min(92, current + Math.floor(Math.random() * 13));
      setScore(current);

      if (current > 72) {
        clearInterval(timer.current);
        setRunning(false);
        setStatus("High-risk synthetic voice detected");
      }
    }, 650);
  };

  const reset = () => {
    clearInterval(timer.current);
    setRunning(false);
    setScore(18);
    setStatus("Ready to analyze");
  };

  return (
    <section id="demo" className="mx-auto max-w-7xl px-5 py-24">
      <div className="mb-10 text-center">
        <Badge>INTERACTIVE DEMO</Badge>
        <h2 className="mt-4 text-3xl font-black md:text-5xl">Real-time voice integrity monitor</h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-400">
          Frontend simulation of the detection workflow. Connect the Python API to analyze uploaded or streamed audio.
        </p>
      </div>

      <div className="glass grid gap-8 rounded-3xl p-6 md:grid-cols-[1fr_1.3fr] md:p-10">
        <div className="grid place-items-center">
          <RiskGauge score={score} />

          <div className="mt-6 flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${score > 72 ? "bg-rose-400" : "bg-cyan-400"}`} />
            {status}
          </div>

          <div className="mt-6 flex gap-3">
            {!running ? (
              <button onClick={start} className="flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950">
                <Play size={17} /> Start Analysis
              </button>
            ) : (
              <button
                onClick={() => {
                  clearInterval(timer.current);
                  setRunning(false);
                  setStatus("Analysis paused");
                }}
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-3 font-bold"
              >
                <Square size={16} /> Stop
              </button>
            )}

            <button onClick={reset} className="rounded-xl border border-slate-700 px-4">
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex justify-between">
              <span className="text-slate-400">Acoustic authenticity</span>
              <b>{Math.max(8, 100 - score)}%</b>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-cyan-400 transition-all"
                style={{ width: `${Math.max(8, 100 - score)}%` }}
              />
            </div>
          </div>

          {["Spectral artifacts", "Prosody consistency", "Speaker identity match", "Contextual fraud signal"].map(
            (item, index) => (
              <div className="flex items-center justify-between rounded-xl border border-slate-800 p-4" key={item}>
                <span className="flex items-center gap-3">
                  <Activity size={17} className="text-cyan-300" />
                  {item}
                </span>
                <span className="text-sm text-slate-400">{Math.max(42, 90 - score + index * 7)}%</span>
              </div>
            )
          )}

          <div className={`rounded-2xl border p-5 ${score > 72 ? "border-rose-400/30 bg-rose-400/10" : "border-emerald-400/20 bg-emerald-400/5"}`}>
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 text-amber-300" />
              <div>
                <b>Recommended action</b>
                <p className="mt-1 text-sm text-slate-400">
                  {score > 72
                    ? "Do not authorize sensitive action. Trigger callback + MFA verification."
                    : "Continue monitoring. Require secondary verification for high-value transactions."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}