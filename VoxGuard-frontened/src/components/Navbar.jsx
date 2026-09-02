import { useState } from "react";
import {
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

const links = [
  ["Dashboard", "#dashboard"],
  ["How It Works", "#how-it-works"],
  ["Technology", "#technology"],
  ["Integrations", "#integrations"],
  ["Security", "#security"],
];

export default function Navbar({ onProfileClick }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-indigo-500/20 bg-[#0a0d14]/80 backdrop-blur-xl transition-all duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Brand Logo */}
        <a href="#" className="group flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 text-slate-950 shadow-lg shadow-cyan-500/25 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-cyan-500/40">
            <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
          </span>
          <div className="flex flex-col">
            <b className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
              VoxGuard
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

          <div className="relative border-t border-slate-700/60 pt-5 md:border-0 md:pt-0">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-slate-800/70 md:w-auto"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-indigo-500 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20">
                AM
              </span>
              <span className="min-w-0 flex-1 md:max-w-[92px]">
                <span className="block truncate text-sm font-semibold text-white">Alex Morgan</span>
                <span className="flex items-center gap-1.5 text-[11px] text-cyan-300/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Protected
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full z-10 mt-3 w-full min-w-[220px] rounded-xl border border-slate-700/80 bg-[#111827] p-2 shadow-2xl shadow-slate-950/50 md:w-56">
                <div className="border-b border-slate-700/70 px-3 pb-3 pt-2">
                  <p className="m-0 text-xs font-medium text-slate-400">SIGNED IN AS</p>
                  <p className="mt-1 truncate text-sm text-slate-100">alex@voxguard.ai</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setOpen(false);
                    onProfileClick?.();
                  }}
                  className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <UserRound className="h-4 w-4 text-cyan-400" />
                  Voice profile
                </button>
                <a
                  href="#settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  Settings
                </a>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-rose-300 transition-colors hover:bg-rose-400/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}