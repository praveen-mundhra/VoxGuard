import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileAudio,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export default function ProfileDashboard({ records, onBack }) {
  const authenticCount = records.filter((record) => !record.result.is_spoof).length;
  const averageRisk = records.length
    ? Math.round(records.reduce((total, record) => total + Number(record.result.risk_score || 0), 0) / records.length)
    : 0;

  return (
    <main className="grid-bg min-h-[calc(100vh-81px)] px-5 py-10 md:px-8 md:py-14">
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </button>

        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
              <UserRound className="h-4 w-4" />
              Voice identity profile
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">Your voice records</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Review every voice input and the integrity result returned by VoxGuard.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 py-4 text-sm text-cyan-100">
            <span className="block text-xs uppercase tracking-wider text-cyan-300/70">Profile status</span>
            <span className="mt-1 flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Protected</span>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <SummaryCard icon={FileAudio} label="Voice tests" value={records.length} />
          <SummaryCard icon={BarChart3} label="Average risk" value={`${averageRisk}%`} />
          <SummaryCard icon={CheckCircle2} label="Authentic results" value={authenticCount} />
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Test history</h2>
            <span className="text-xs uppercase tracking-wider text-slate-500">Newest first</span>
          </div>

          {records.length === 0 ? (
            <div className="glass flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-dashed p-8 text-center">
              <FileAudio className="h-10 w-10 text-slate-600" />
              <h3 className="mt-5 font-bold text-white">No voice tests yet</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">Run a recording or upload a sample from the live demo to build your history.</p>
              <button type="button" onClick={onBack} className="mt-6 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">Run a voice test</button>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => <RecordCard key={record.id} record={record} />)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="glass rounded-2xl p-5">
      <Icon className="h-5 w-5 text-cyan-300" />
      <p className="mt-5 text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function RecordCard({ record }) {
  const { result } = record;
  const isSpoof = result.is_spoof;
  const date = new Date(record.createdAt);

  return (
    <article className="glass rounded-2xl p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${isSpoof ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {isSpoof ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-white">{record.fileName}</h3>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{date.toLocaleString()}</p>
            <p className={`mt-3 text-sm font-semibold ${isSpoof ? "text-rose-300" : "text-emerald-300"}`}>{isSpoof ? "Potential AI-generated voice" : "Voice appears authentic"}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 lg:min-w-[280px] lg:justify-end">
          <div><span className="block text-xs uppercase tracking-wider text-slate-500">Risk</span><strong className={`mt-1 block text-2xl ${isSpoof ? "text-rose-300" : "text-emerald-300"}`}>{Math.round(result.risk_score || 0)}%</strong></div>
          <div><span className="block text-xs uppercase tracking-wider text-slate-500">Confidence</span><strong className="mt-1 block text-2xl text-white">{Number(result.confidence || 0).toFixed(1)}%</strong></div>
        </div>
      </div>
      {record.audioUrl && <audio className="mt-5 h-9 w-full" controls src={record.audioUrl} />}
      <div className="mt-5 border-t border-slate-800 pt-4">
        <span className="text-xs uppercase tracking-wider text-slate-500">Recommended action</span>
        <p className="mt-1 text-sm text-slate-300">{result.recommendation || result.message}</p>
      </div>
    </article>
  );
}
