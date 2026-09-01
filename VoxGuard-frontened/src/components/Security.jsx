import Badge from "./Badge";

export default function Security() {
  return (
    <section id="security" className="mx-auto max-w-7xl px-5 pb-20">
      <div className="rounded-3xl border border-cyan-400/10 bg-gradient-to-br from-cyan-400/10 to-transparent p-8 md:p-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <Badge>FRAUD PREVENTION</Badge>
            <h2 className="mt-4 text-3xl font-black">Never approve a high-risk call on voice alone.</h2>
            <p className="mt-3 max-w-2xl text-slate-400">
              Use VoiceGuard as a security signal—not a replacement for MFA, callback verification or organizational controls.
            </p>
          </div>
          <a href="#demo" className="whitespace-nowrap rounded-xl bg-white px-6 py-3 font-bold text-slate-950">
            Run Demo
          </a>
        </div>
      </div>
    </section>
  );
}