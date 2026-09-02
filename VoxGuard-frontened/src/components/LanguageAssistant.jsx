import { useEffect, useRef, useState } from "react";
import { Languages, Mic, MicOff, Volume2, X } from "lucide-react";

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
const getRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;

async function translateText(text, language) {
  if (language === "en" || !text.trim()) return text;
  const key = `${language}:${text}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=en|${language}`);
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

  useEffect(() => {
    const root = document.body;
    const translatePage = async () => {
      const nodes = [...root.querySelectorAll("body *:not([data-language-ui]):not([data-language-ui] *)")]
        .flatMap((element) => [...element.childNodes])
        .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (language === "en") {
        nodes.forEach((node) => {
          const original = originalText.current.get(node);
          if (original) node.textContent = original;
        });
        return;
      }
      setIsTranslating(true);
      nodes.forEach((node) => {
        if (!originalText.current.has(node)) originalText.current.set(node, node.textContent);
      });
      await Promise.all(nodes.map(async (node) => {
        node.textContent = await translateText(originalText.current.get(node), language);
      }));
      setIsTranslating(false);
    };

    const observer = new MutationObserver(() => {
      if (!document.body.dataset.translationBusy) {
        document.body.dataset.translationBusy = "true";
        translatePage().finally(() => { delete document.body.dataset.translationBusy; });
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
    const selected = languages.find((item) => item[1] === language) || languages[0];
    const recognition = new Recognition();
    recognition.lang = selected[2];
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => setTranscript([...event.results].map((result) => result[0].transcript).join(""));
    recognition.onerror = () => { setSpeechError("Microphone access is needed for speech input."); setIsListening(false); };
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
    <div className="language-assistant" data-language-ui>
      {open && (
        <div className="language-panel" role="dialog" aria-label="Language and speech translator">
          <div className="language-panel-heading">
            <div><span className="language-eyebrow"><Languages size={13} /> VoxGuard language</span><h2>Translate your workspace</h2></div>
            <button className="language-close" type="button" onClick={() => setOpen(false)} aria-label="Close translator"><X size={17} /></button>
          </div>
          <label className="language-select-label">Choose a language<select value={language} onChange={(event) => setLanguage(event.target.value)}>{languages.map(([name, code]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <p className="language-status">{isTranslating ? "Translating the website..." : `${languages.length} Indian languages available`}</p>
          <div className="speech-box">
            <div className="speech-box-heading"><span>Speech to text</span><Volume2 size={15} /></div>
            <p>{transcript || "Speak to see your words here"}</p>
            <button className={`speech-button ${isListening ? "listening" : ""}`} type="button" onClick={isListening ? stopListening : startListening}>
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}{isListening ? "Stop listening" : "Start speaking"}
            </button>
            {speechError && <small>{speechError}</small>}
          </div>
          <p className="language-note">Selected language: <strong>{selectedLanguage}</strong>. Website text updates automatically.</p>
        </div>
      )}
      <button className="language-trigger" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Open language translator" title="Translate website">
        <Languages size={18} /><span>{language === "en" ? "EN" : language.toUpperCase()}</span>
      </button>
    </div>
  );
}