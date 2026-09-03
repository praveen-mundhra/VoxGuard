import { useState } from "react";
import { BellRing, PhoneCall, ShieldAlert, Volume2, X } from "lucide-react";

const prompts = {
  hi: "सावधान। कोई भी व्यक्ति OTP या UPI पिन नहीं मांग सकता। कॉल बंद करें और परिवार को बताएं।",
  ta: "எச்சரிக்கை. OTP அல்லது UPI PIN யாரிடமும் பகிர வேண்டாம். அழைப்பை நிறுத்தி குடும்பத்தினரிடம் சொல்லுங்கள்.",
  bn: "সতর্কতা। OTP বা UPI PIN কাউকে দেবেন না। কলটি বন্ধ করে পরিবারের সদস্যকে জানান।",
};

export default function SeniorModeOverlay() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState("hi");
  const [guardian, setGuardian] = useState("");
  const [sosState, setSosState] = useState("");

  const speakPrompt = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(prompts[language]);
    utterance.lang = `${language}-IN`;
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  };

  const sendSos = async () => {
    if (!guardian.trim()) {
      setSosState("Enter a guardian phone number first.");
      return;
    }
    setSosState("Preparing SOS...");
    try {
      const response = await fetch("http://localhost:8000/api/family/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardian_contact: guardian.trim(),
          language,
          call_details: { reported_at: new Date().toISOString(), reason: "VoxGuard senior-mode alert" },
        }),
      });
      if (!response.ok) throw new Error("SOS service unavailable");
      setSosState("SOS payload ready for SMS / WhatsApp dispatch.");
    } catch {
      setSosState("Could not reach the SOS service. Call your guardian directly.");
    }
  };

  return (
    <div className="senior-mode" data-language-ui>
      {open && (
        <div className="senior-overlay" role="dialog" aria-modal="true" aria-labelledby="senior-title">
          <div className="senior-panel">
            <button className="senior-close" type="button" onClick={() => setOpen(false)} aria-label="Close senior mode"><X size={26} /></button>
            <div className="senior-alert-icon"><ShieldAlert size={38} /></div>
            <p className="senior-kicker">VoxGuard protection</p>
            <h2 id="senior-title">This call may be a fraud</h2>
            <p className="senior-copy">Stop. Do not share OTP, UPI PIN, Aadhaar details, or screen access.</p>
            <div className="senior-actions">
              <a className="senior-call-button" href="tel:1930"><PhoneCall size={26} /> Dial 1930</a>
              <button className="senior-speak-button" type="button" onClick={speakPrompt}><Volume2 size={26} /> Hear warning</button>
            </div>
            <label className="senior-language">Warning language
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="hi">हिन्दी</option>
                <option value="ta">தமிழ்</option>
                <option value="bn">বাংলা</option>
              </select>
            </label>
            <div className="senior-sos">
              <div><strong>Tell your family</strong><span>Send call details to your guardian.</span></div>
              <input value={guardian} onChange={(event) => setGuardian(event.target.value)} placeholder="Guardian phone number" aria-label="Guardian phone number" inputMode="tel" />
              <button type="button" onClick={sendSos}><BellRing size={21} /> Send SOS</button>
              {sosState && <p role="status">{sosState}</p>}
            </div>
          </div>
        </div>
      )}
      <button className="senior-trigger" type="button" onClick={() => setOpen(true)} aria-label="Open senior mode" title="Open senior mode"><ShieldAlert size={20} /><span>Senior mode</span></button>
    </div>
  );
}
