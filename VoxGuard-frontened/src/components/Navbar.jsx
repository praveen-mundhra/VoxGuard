import { useState } from "react";
import { Menu, X, ShieldCheck, Sparkles } from "lucide-react";

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
    <header className="sticky top-0 z-50 border-b border-indigo-500/20 bg-[#0a0d14]/80 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Brand Logo */}
        <a href="#" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 text-slate-950 shadow-lg shadow-cyan-500/25 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-cyan-500/40">
            <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
          </span>
          <div className="flex flex-col">
            <b className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
              VoiceGuard
            </b>
            <span className="flex items-center gap-1.5 text-xs font-medium text-cyan-400/80">
              <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-cyan-400" />
              AI Voice Integrity
            </span>
          </div>
        </a>

        {/* Mobile Menu Toggle Button */}
        <button
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800/60 hover:text-white md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle Navigation"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Navigation Links */}
        <nav
          className={`${
            open ? "flex translate-y-0 opacity-100" : "hidden -translate-y-2 opacity-0 md:flex md:translate-y-0 md:opacity-100"
          } absolute left-0 top-full w-full flex-col gap-5 border-b border-indigo-500/20 bg-[#0a0d14]/95 p-6 backdrop-blur-2xl transition-all duration-200 md:static md:w-auto md:flex-row md:items-center md:gap-7 md:border-0 md:bg-transparent md:p-0`}
        >
          {links.map(([label, href]) => (
            <a
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="group relative text-sm font-medium text-slate-300 transition-colors duration-200 hover:text-white"
            >
              {label}
              {/* Hover Underline Accent */}
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-300 group-hover:w-full" />
            </a>
          ))}

          {/* CTA Button */}
          <a
            href="#demo"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-400 via-cyan-300 to-indigo-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-md shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-400/40 active:translate-y-0"
          >
            <Sparkles className="h-4 w-4" />
            Live Demo
          </a>
        </nav>
      </div>
    </header>
  );
}