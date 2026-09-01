import { useState } from "react";
import { Menu, X, ShieldCheck } from "lucide-react";

const links = [
  ["Dashboard", "#dashboard"],
  ["How It Works", "#how-it-works"],
  ["Technology", "#technology"],
  ["Integrations", "#integrations"],
  ["Security", "#security"],
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/70 bg-[#07111f]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <a href="#" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 text-slate-950">
            <ShieldCheck />
          </span>
          <span>
            <b className="block text-lg">VoiceGuard</b>
            <small className="text-slate-400">AI Voice Integrity</small>
          </span>
        </a>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>

        <nav className={`${open ? "flex" : "hidden"} absolute left-0 top-full w-full flex-col gap-4 border-b border-slate-800 bg-[#07111f] p-5 md:static md:flex md:w-auto md:flex-row md:border-0 md:bg-transparent md:p-0`}>
          {links.map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="text-sm text-slate-300 transition hover:text-cyan-300"
            >
              {label}
            </a>
          ))}
          <a href="#demo" className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950">
            Live Demo
          </a>
        </nav>
      </div>
    </header>
  );
}