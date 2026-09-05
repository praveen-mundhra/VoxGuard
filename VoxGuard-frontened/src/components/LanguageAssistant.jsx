import { useEffect, useRef, useState } from "react";
import { Languages, Mic, MicOff, Volume2, X, Loader2, Sparkles, Check } from "lucide-react";

const languages = [
  ["English", "en", "en-IN"], ["हिन्दी", "hi", "hi-IN"], ["বাংলা", "bn", "bn-IN"],
  ["मराठी", "mr", "mr-IN"], ["తెలుగు", "te", "te-IN"], ["தமிழ்", "ta", "ta-IN"],
  ["ગુજરાતી", "gu", "gu-IN"], ["ಕನ್ನಡ", "kn", "kn-IN"], ["മലയാളം", "ml", "ml-IN"],
  ["ਪੰਜਾਬੀ", "pa", "pa-IN"], ["ଓଡ଼ିଆ", "or", "or-IN"], ["অসমীয়া", "as", "as-IN"],
  ["भोजपुरी", "bho", "hi-IN"], ["हरियाणवी", "bgc", "hi-IN"], ["اردو", "ur", "ur-IN"],
  ["संस्कृत", "sa", "sa-IN"], ["नेपाली", "ne", "ne-NP"], ["कोंकणी", "gom", "kok-IN"],
  ["मैथिली", "mai", "hi-IN"], ["डोगरी", "doi", "hi-IN"], ["कश्मीरी", "ks", "hi-IN"],
  ["सिंधी", "sd", "hi-IN"], ["संताली", "sat", "hi-IN"], ["मणिपुरी", "mni", "hi-IN"],
  ["छत्तीसगढ़ी", "hne", "hi-IN"], ["राजस्थानी", "raj", "hi-IN"], ["मगही", "mag", "hi-IN"],
  ["गढ़वाली", "gbm", "hi-IN"], ["कुमाऊँनी", "kfy", "hi-IN"], ["तुलु", "tcy", "kn-IN"],
];

const cache = new Map();
const getRecognition = () =>
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

async function translateText(text, language) {
  if (language === "en" || !text.trim()) return text;
  const key = `${language}:${text}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        text.slice(0, 450)
      )}&langpair=en|${language}`
    );
    const data = await response.json();
    const translated = data.responseData?.translatedText || text;
    cache.set(key, translated);
    return translated;
  } catch {
    return text;
  }
}

export default function LanguageAssistant() {
  const [language, setLanguage] = useState("en");
  const [open, setOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [speechError, setSpeechError] = useState("");
  const originalText = useRef(new WeakMap());
  const recognitionRef = useRef(null);
  const panelRef = useRef(null);

  // Click outside to dismiss floating panel
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    const root = document.body;
    const translatePage = async () => {
      const nodes = [
        ...root.querySelectorAll(
          "body *:not([data-language-ui]):not([data-language-ui] *)"
        ),
      ]
        .flatMap((element) => [...element.childNodes])
        .filter(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
        );

      if (language === "en") {
        nodes.forEach((node) => {
          const original = originalText.current.get(node);
          if (original) node.textContent = original;
        });
        return;
      }

      setIsTranslating(true);
      nodes.forEach((node) => {
        if (!originalText.current.has(node))
          originalText.current.set(node, node.textContent);
      });

      await Promise.all(
        nodes.map(async (node) => {
          node.textContent = await translateText(
            originalText.current.get(node),
            language
          );
        })
      );
      setIsTranslating(false);
    };

    const observer = new MutationObserver(() => {
      if (!document.body.dataset.translationBusy) {
        document.body.dataset.translationBusy = "true";
        translatePage().finally(() => {
          delete document.body.dataset.translationBusy;
        });
      }
    });

    observer.observe(root, { childList: true, subtree: true });
    translatePage();
    return () => observer.disconnect();
  }, [language]);

  const startListening = () => {
    const Recognition = getRecognition();
    if (!Recognition) {
      setSpeechError("Speech recognition is not supported in this browser.");
      return;
    }
    const selected =
      languages.find((item) => item[1] === language) || languages[0];
    const recognition = new Recognition();
    recognition.lang = selected[2];
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) =>
      setTranscript(
        [...event.results].map((result) => result[0].transcript).join("")
      );
    recognition.onerror = () => {
      setSpeechError("Microphone access is required for speech input.");
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setSpeechError("");
    setTranscript("");
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => recognitionRef.current?.stop();
  const selectedLanguage = languages.find((item) => item[1] === language)?.[0];

  return (
    <div
      ref={panelRef}
      data-language-ui
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans"
    >
      {/* Animated Floating Modal */}
      <div
        role="dialog"
        aria-label="Language and speech translator"
        className={`mb-3 w-[340px] origin-bottom-right rounded-3xl border border-cyan-500/30 bg-[#090f1d]/95 p-5 shadow-2xl shadow-slate-950/80 backdrop-blur-2xl transition-all duration-300 ease-out sm:w-[380px] ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-95 opacity-0"
        }`}
      >
        {/* Subtle Top Accent Horizon */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-3.5">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
              <Languages size={13} className="animate-pulse" /> VoxGuard Localize
            </span>
            <h2 className="mt-0.5 text-base font-extrabold text-white">
              Translate your workspace
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close translator"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Language Selection Field */}
        <div className="mt-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Target Language
          </label>
          <div className="relative mt-1.5">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="w-full cursor-pointer appearance-none rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs font-semibold text-slate-100 shadow-inner outline-none transition-all duration-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
            >
              {languages.map(([name, code]) => (
                <option key={code} value={code} className="bg-slate-900 text-slate-100">
                  {name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-cyan-400">
              <Sparkles size={13} />
            </div>
          </div>
        </div>

        {/* Translation Feedback Status */}
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
          {isTranslating ? (
            <span className="inline-flex items-center gap-1.5 text-cyan-300">
              <Loader2 size={13} className="animate-spin text-cyan-400" />
              Applying neural translations across elements...
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Check size={13} className="text-emerald-400" />
              {languages.length} regional acoustic & text models synced
            </span>
          )}
        </div>

        {/* Speech to Text Terminal Card */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/60 p-3.5 backdrop-blur-sm shadow-inner">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span className="flex items-center gap-1.5">
              <Volume2 size={14} className="text-cyan-400" /> Speech to text
            </span>
            {isListening && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-rose-400">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-rose-500" /> LIVE
              </span>
            )}
          </div>

          <p className="mt-2.5 min-h-[44px] rounded-xl border border-slate-900 bg-slate-900/40 p-2.5 font-mono text-xs leading-relaxed text-slate-300">
            {transcript || (
              <span className="italic text-slate-600">
                Tap the button below and speak into your microphone...
              </span>
            )}
          </p>

          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`group mt-3 relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-2.5 text-xs font-bold transition-all duration-300 ${
              isListening
                ? "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)] hover:bg-rose-600"
                : "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)]"
            }`}
          >
            {isListening ? (
              <>
                <MicOff size={15} className="animate-pulse" />
                <span>Stop Listening</span>
              </>
            ) : (
              <>
                <Mic size={15} className="transition-transform group-hover:scale-110" />
                <span>Start Speaking</span>
              </>
            )}
          </button>

          {speechError && (
            <p className="mt-2 text-[11px] font-medium text-rose-400">
              {speechError}
            </p>
          )}
        </div>

        {/* Bottom Note */}
        <p className="mt-3.5 text-center text-[10px] text-slate-500">
          Current language: <strong className="text-slate-300">{selectedLanguage}</strong>. Page updates in real time.
        </p>
      </div>

      {/* Floating Trigger Bubble */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Open language translator"
        title="Translate workspace"
        className="group relative flex items-center gap-2 overflow-hidden rounded-full border border-cyan-500/40 bg-gradient-to-tr from-[#0b1324] to-[#070b14] px-4 py-2.5 text-xs font-bold text-slate-200 shadow-xl shadow-cyan-950/50 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400 hover:text-white hover:shadow-[0_0_25px_rgba(6,182,212,0.35)] active:translate-y-0"
      >
        {/* Shimmer sweep effect on trigger */}
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        <Languages
          size={16}
          className="text-cyan-400 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
        />
        <span className="font-mono tracking-wider text-cyan-300">
          {language === "en" ? "EN" : language.toUpperCase()}
        </span>
      </button>
    </div>
  );
}