import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Check, ChevronDown, Languages, Loader2, MessageCircle,
  Mic, MicOff, Send, ShieldCheck, Sparkles, Volume2, VolumeX, X
} from "lucide-react";

// 25+ Indian/regional languages. TTS/STT availability depends on the browser/OS voice pack.
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

const API = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const recognitionFactory = () =>
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const languageByCode = (code) => INDIAN_LANGUAGES.find((l) => l[1] === code) || INDIAN_LANGUAGES[0];

async function translateText(text, target) {
  if (!text?.trim() || target === "en") return text;
  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=en|${encodeURIComponent(target)}`
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
      const response = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language, system: "You are VoxGuard AI, a concise multilingual voice-security assistant. Prioritize safe anti-fraud advice. Never request OTP, PIN, password or banking credentials." })
      });
      if (!response.ok) throw new Error("chat endpoint unavailable");
      const data = await response.json();
      const answer = data.reply || data.response || data.message || localAssistant(text);
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: answer }]);
    } catch {
      // Keeps the demo usable before the AI backend is configured.
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: localAssistant(text), fallback: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-language-ui className="fixed bottom-6 left-6 z-[60] font-sans">
      {open && (
        <div className="mb-3 flex h-[610px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#070d19]/95 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:w-[400px]">
          <div className="border-b border-slate-800 bg-gradient-to-r from-cyan-500/10 to-transparent px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-2 text-cyan-300"><Bot size={19} /></div>
                <div><p className="text-sm font-extrabold text-white">VoxGuard AI Assistant</p><p className="text-[10px] text-emerald-400">● Voice security assistant online</p></div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={17} /></button>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-2">
              <Languages size={14} className="text-cyan-400" />
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-transparent text-xs font-semibold text-slate-200 outline-none">
                {INDIAN_LANGUAGES.map(([name, code]) => <option key={code} value={code} className="bg-slate-900">{name}</option>)}
              </select>
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">{INDIAN_LANGUAGES.length} LANG</span>
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${message.role === "user" ? "rounded-br-md bg-cyan-500 text-slate-950" : "rounded-bl-md border border-slate-800 bg-slate-900/80 text-slate-200"}`}>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.text}</p>
                  {message.role === "assistant" && (
                    <div className="mt-2 flex items-center gap-2 border-t border-slate-700/60 pt-2">
                      <button onClick={() => speak(message)} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-300 hover:text-white">
                        {speakingId === message.id ? <VolumeX size={12} /> : <Volume2 size={12} />} {speakingId === message.id ? "Stop" : "Speak"}
                      </button>
                      {message.fallback && <span className="text-[9px] text-slate-500">offline-safe fallback</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 px-2 text-[11px] text-cyan-300"><Loader2 size={14} className="animate-spin" /> VoxGuard AI is thinking…</div>}
          </div>

          {voiceError && <div className="border-t border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[10px] text-rose-300">{voiceError}</div>}
          <form onSubmit={sendMessage} className="border-t border-slate-800 bg-slate-950/70 p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-1.5 focus-within:border-cyan-400/50">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }} rows={2} placeholder={`Ask in ${selected[0]}…`} className="max-h-24 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600" />
              <button type="button" onClick={listening ? stopListening : startListening} className={`rounded-xl p-2.5 ${listening ? "bg-rose-500 text-white" : "bg-slate-800 text-cyan-300 hover:bg-slate-700"}`} title="Voice input">
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button type="submit" disabled={!input.trim() || busy} className="rounded-xl bg-cyan-500 p-2.5 text-slate-950 disabled:cursor-not-allowed disabled:opacity-30" title="Send"><Send size={16} /></button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] text-slate-600"><span className="flex items-center gap-1"><ShieldCheck size={11} /> Never share OTP/PIN/password</span><span className="flex items-center gap-1"><Check size={10} /> TTS enabled</span></div>
          </form>
        </div>
      )}

      <button onClick={() => setOpen(!open)} className="group relative flex items-center gap-2 overflow-hidden rounded-full border border-cyan-400/40 bg-[#08101f] px-4 py-3 text-xs font-extrabold text-white shadow-xl shadow-cyan-950/40 transition hover:-translate-y-0.5 hover:border-cyan-300">
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <MessageCircle size={17} className="text-cyan-300" /><span>VoxGuard AI</span><Sparkles size={13} className="text-cyan-400" />
      </button>
    </div>
  );
}
