import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Check, Languages, Loader2, MessageCircle,
  Mic, MicOff, Send, ShieldCheck, Sparkles, Volume2, VolumeX, X
} from "lucide-react";
import { API_BASE, authHeaders } from "../config";

export const INDIAN_LANGUAGES = [
  ["English", "en", "en-IN"], ["हिन्दी", "hi", "hi-IN"], ["বাংলা", "bn", "bn-IN"],
  ["मराठी", "mr", "mr-IN"], ["తెలుగు", "te", "te-IN"], ["தமிழ்", "ta", "ta-IN"],
  ["ગુજરાતી", "gu", "gu-IN"], ["ಕನ್ನಡ", "kn", "kn-IN"], ["മലയാളം", "ml", "ml-IN"],
  ["ਪੰਜਾਬੀ", "pa", "pa-IN"], ["ଓଡ଼ିଆ", "or", "or-IN"], ["অসমীয়া", "as", "as-IN"],
  ["اردو", "ur", "ur-IN"], ["संस्कृतम्", "sa", "sa-IN"], ["नेपाली", "ne", "ne-NP"],
  ["कोंकणी", "gom", "kok-IN"], ["मैथिली", "mai", "hi-IN"], ["डोगरी", "doi", "hi-IN"],
  ["कश्मीरी", "ks", "hi-IN"], ["सिंधी", "sd", "hi-IN"], ["संताली", "sat", "hi-IN"],
  ["মৈতৈলোন্", "mni", "hi-IN"], ["छत्तीसगढ़ी", "hne", "hi-IN"], ["राजस्थानी", "raj", "hi-IN"],
  ["मगही", "mag", "hi-IN"], ["गढ़वाली", "gbm", "hi-IN"], ["कुमाऊँनी", "kfy", "hi-IN"],
  ["तुलु", "tcy", "kn-IN"], ["भोजपुरी", "bho", "hi-IN"], ["हरियाणवी", "bgc", "hi-IN"]
];

const recognitionFactory = () =>
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const languageByCode = (code) => INDIAN_LANGUAGES.find((l) => l[1] === code) || INDIAN_LANGUAGES[0];

async function translateText(text, target) {
  if (!text?.trim() || target === "en") return text;
  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=en\vert{}${encodeURIComponent(target)}`
    );
    const data = await r.json();
    return data.responseData?.translatedText || text;
  } catch {
    return text;
  }
}

function localAssistant(text) {
  const q = text.toLowerCase();
  if (/(hello|hi|hey|namaste|नमस्ते)/i.test(q)) return "Hello! I am VoxGuard AI. I can help you understand voice-clone risks, scam calls, speaker verification, and safe transaction practices.";
  if (q.includes("voice clone") || q.includes("deepfake") || q.includes("fake voice")) return "A voice clone is synthetic speech designed to imitate a real person. VoxGuard checks deepfake signals, speaker similarity, conversation intent, caller context, and transaction risk before recommending an action.";
  if (q.includes("scam") || q.includes("fraud") || q.includes("otp") || q.includes("pin")) return "Never share OTPs, PINs, passwords or remote-access codes during an unexpected call. If the caller creates urgency, stop the transaction and verify through an independent official channel.";
  if (q.includes("how") && q.includes("work")) return "VoxGuard combines speech-to-text, voice deepfake detection, speaker verification, scam-intent analysis and a risk engine. The signals are fused into a risk score and a preventive recommendation.";
  if (q.includes("language") || q.includes("translate")) return "You can select from 30 Indian and regional language options. Type or speak in the selected language, then use the speaker button to hear the assistant response.";
  return "I can help with VoxGuard, voice-cloning detection, scam prevention, speaker verification, suspicious calls, and safe digital transactions. Ask me a question or tap the microphone.";
}

export default function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("en");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { id: 1, role: "assistant", text: "Namaste! I’m VoxGuard AI. Ask me about a suspicious call, voice cloning, scam prevention, or how VoxGuard protects you." }
  ]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [voiceError, setVoiceError] = useState("");
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  const selected = useMemo(() => languageByCode(language), [language]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speak = async (message) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeakingId(message.id);
    const translated = await translateText(message.text, language);
    const utterance = new SpeechSynthesisUtterance(translated);
    utterance.lang = selected[2];
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const Recognition = recognitionFactory();
    if (!Recognition) {
      setVoiceError("Voice input is not supported by this browser. Try Chrome or Edge.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = selected[2];
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onstart = () => { setListening(true); setVoiceError(""); };
    recognition.onresult = (event) => {
      const value = [...event.results].map((r) => r[0].transcript).join("");
      setInput(value);
    };
    recognition.onerror = (event) => {
      setVoiceError(event.error === "not-allowed" ? "Microphone permission was denied." : "Could not capture speech. Please try again.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => recognitionRef.current?.stop();

  const sendMessage = async (event) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const userMessage = { id: crypto.randomUUID(), role: "user", text };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message: text, language, system: "You are VoxGuard AI, a concise multilingual voice-security assistant. Prioritize safe anti-fraud advice. Never request OTP, PIN, password or banking credentials." })
      });
      if (!response.ok) throw new Error("chat endpoint unavailable");
      const data = await response.json();
      const answer = data.reply || data.response || data.message || localAssistant(text);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: answer }]);
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: localAssistant(text), fallback: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-language-ui className="fixed bottom-6 left-6 z-[60] font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Main Chat Panel */}
      <div
        className={`mb-3 flex h-[620px] w-[370px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-cyan-500/20 bg-slate-950/80 shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-2xl transition-all duration-300 origin-bottom-left sm:w-[410px] ${
          open
            ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
            : "scale-90 opacity-0 translate-y-4 pointer-events-none absolute bottom-12"
        }`}
      >
        {/* Header */}
        <div className="relative border-b border-slate-800/80 bg-gradient-to-b from-cyan-950/40 via-slate-900/60 to-transparent px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 p-2.5 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                <Bot size={20} className="text-cyan-300 transition-transform duration-300 hover:rotate-12" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
                </span>
              </div>
              <div>
                <p className="text-sm font-black tracking-wide text-white drop-shadow-sm">VoxGuard AI</p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[10px] font-medium text-emerald-400/90 tracking-wide uppercase">Anti-Fraud Engine Active</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl border border-transparent p-1.5 text-slate-400 transition-all duration-200 hover:border-slate-700/60 hover:bg-slate-800/60 hover:text-white active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Language Selector */}
          <div className="group mt-3 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 transition-all duration-200 hover:border-cyan-500/30 focus-within:border-cyan-400/60 focus-within:ring-1 focus-within:ring-cyan-400/30">
            <Languages size={15} className="text-cyan-400 transition-transform group-hover:scale-110" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full cursor-pointer bg-transparent text-xs font-semibold text-slate-200 outline-none"
            >
              {INDIAN_LANGUAGES.map(([name, code]) => (
                <option key={code} value={code} className="bg-slate-900 text-slate-200 font-medium">
                  {name}
                </option>
              ))}
            </select>
            <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-emerald-400">
              {INDIAN_LANGUAGES.length} LANG
            </span>
          </div>
        </div>

        {/* Message Feed */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800">
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div
                  className={`relative max-w-[86%] px-4 py-3 text-xs leading-relaxed transition-all shadow-md ${
                    isUser
                      ? "rounded-2xl rounded-br-sm bg-gradient-to-r from-cyan-500 to-cyan-400 font-semibold text-slate-950 shadow-cyan-500/20"
                      : "rounded-2xl rounded-bl-sm border border-slate-800/80 bg-slate-900/90 text-slate-200 backdrop-blur-md shadow-black/40 hover:border-slate-700/80"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {!isUser && (
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2">
                      <button
                        onClick={() => speak(message)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold transition-all duration-200 ${
                          speakingId === message.id
                            ? "bg-cyan-400/20 text-cyan-300 ring-1 ring-cyan-400/30"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-cyan-300"
                        }`}
                      >
                        {speakingId === message.id ? (
                          <>
                            <VolumeX size={12} className="animate-pulse text-cyan-400" /> Stop
                          </>
                        ) : (
                          <>
                            <Volume2 size={12} /> Speak
                          </>
                        )}
                      </button>
                      {message.fallback && (
                        <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                          cached
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {busy && (
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-[11px] text-cyan-300 w-fit backdrop-blur-sm animate-pulse">
              <Loader2 size={13} className="animate-spin text-cyan-400" />
              <span>Analyzing threat pattern…</span>
            </div>
          )}
        </div>

        {/* Error Notification */}
        {voiceError && (
          <div className="border-t border-rose-500/20 bg-rose-950/40 px-3.5 py-2 text-[10px] font-medium text-rose-300 animate-in fade-in duration-200">
            {voiceError}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={sendMessage} className="border-t border-slate-800/80 bg-slate-950/90 p-3 backdrop-blur-md">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-800/90 bg-slate-900/70 p-2 transition-all duration-200 focus-within:border-cyan-500/50 focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-cyan-500/20">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              rows={2}
              placeholder={`Ask in ${selected[0]}…`}
              className="max-h-24 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-1 text-xs text-slate-100 outline-none placeholder:text-slate-500"
            />
            
            {/* Mic Toggle Button */}
            <div className="relative">
              {listening && (
                <span className="absolute -inset-1 rounded-xl bg-rose-500/40 animate-ping" />
              )}
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                className={`relative rounded-xl p-2.5 transition-all duration-200 active:scale-95 ${
                  listening
                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                    : "border border-slate-700/60 bg-slate-800/80 text-cyan-300 hover:border-cyan-400/40 hover:bg-slate-800 hover:text-white"
                }`}
                title="Voice input"
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 p-2.5 text-slate-950 transition-all duration-200 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:brightness-100 shadow-md shadow-cyan-500/20"
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>

          <div className="mt-2.5 flex items-center justify-between px-1 text-[9px] font-medium text-slate-500">
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck size={12} className="text-cyan-400" /> Never share OTP / PIN
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <Check size={11} className="text-emerald-400" /> Multilingual TTS
            </span>
          </div>
        </form>
      </div>

      {/* Floating Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="group relative flex items-center gap-2.5 overflow-hidden rounded-full border border-cyan-400/30 bg-slate-900/90 px-5 py-3.5 text-xs font-black tracking-wide text-white shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(6,182,212,0.2)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-[0_15px_35px_rgba(0,0,0,0.6),0_0_30px_rgba(6,182,212,0.4)] active:scale-95"
      >
        {/* Shimmer Effect */}
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        
        <div className="relative flex items-center justify-center">
          <MessageCircle size={18} className="text-cyan-400 transition-transform duration-300 group-hover:scale-110" />
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
          </span>
        </div>
        
        <span className="tracking-wider">VoxGuard AI</span>
        <Sparkles size={14} className="text-cyan-300 transition-all duration-300 group-hover:rotate-45 group-hover:text-cyan-200" />
      </button>
    </div>
  );
}