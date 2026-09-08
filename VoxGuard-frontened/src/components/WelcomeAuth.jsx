import { useRef, useState } from "react";
import { API_BASE } from "../config";
import {
  ArrowRight,
  Check,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react";

const MINIMUM_SECONDS = 55;

export default function WelcomeAuth({ onAuthenticated }) {
  const [mode, setMode] = useState("signup");
  const [audioFile, setAudioFile] = useState(null);
  const [audioError, setAudioError] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const checkAudioLength = (file) => {
    if (!file) return;
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      if (audio.duration < MINIMUM_SECONDS) {
        setAudioFile(null);
        setAudioError("Please choose a voice sample that is at least 55 seconds long.");
        return;
      }
      setAudioError("");
      setAudioFile(file);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      setAudioFile(null);
      setAudioError("That audio file could not be read. Try another recording.");
    };
    audio.src = URL.createObjectURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mode === "signup" && !audioFile) {
      setAudioError("Upload a voice sample that is at least 55 seconds long to create your profile.");
      return;
    }
    setBusy(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_BASE}/auth/${mode === "signup" ? "register" : "login"}`, {
        method: "POST",
        headers: mode === "login" ? { "Content-Type": "application/x-www-form-urlencoded" } : { "Content-Type": "application/json" },
        body: mode === "login"
          ? new URLSearchParams({ username: form.get("email"), password: form.get("password") })
          : JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Authentication failed.");
      onAuthenticated(data);
    } catch (error) {
      setAuthError(error.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-grid" />
      <section className="auth-shell">
        <div className="auth-intro">
          <a className="auth-brand" href="#welcome">
            <span className="auth-brand-mark"><ShieldCheck size={23} /></span>
            <span>VoxGuard</span>
          </a>
          <div className="auth-kicker"><span /> AI VOICE INTEGRITY</div>
          <h1>Make every voice<br /><em>verifiable.</em></h1>
          <p>Protect conversations from synthetic speech with an identity layer built for the way people communicate now.</p>
          <div className="auth-proof">
            <div className="proof-icon"><LockKeyhole size={18} /></div>
            <div><strong>Your voice stays yours.</strong><span>Encrypted analysis. Private by design.</span></div>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-panel-heading">
            <span className="auth-panel-label">WELCOME TO VOXGUARD</span>
            <h2>{mode === "signup" ? "Create your voice profile" : "Welcome back"}</h2>
            <p>{mode === "signup" ? "Start with a secure voice baseline." : "Sign in to your integrity dashboard."}</p>
          </div>

          <div className="auth-tabs" role="tablist">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} role="tab" type="button">Log in</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} role="tab" type="button">Sign up</button>
          </div>

          <div className="social-login">
            <p className="social-divider"><span>Continue with</span></p>
            <div className="social-grid">
              {[
                ["G", "Google", "social-google"],
                ["", "Apple", "social-apple"],
                ["f", "Facebook", "social-facebook"],
              ].map(([icon, provider, className]) => (
                    <button key={provider} className={`social-button ${className}`} onClick={() => setAuthError("Social sign-in is not configured yet. Use email and password.")} type="button">
                  <span className="social-icon">{icon}</span>
                  <span>{provider}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "signup" && <label>Full name<input name="name" type="text" placeholder="Alex Morgan" required /></label>}
            <label>Email address<input name="email" type="email" placeholder="you@company.com" required /></label>
            <label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength="8" required /></label>

            {mode === "signup" && (
              <div className="voice-upload-block">
                <div className="voice-upload-heading"><span>VOICE BASELINE</span><b>Required</b></div>
                <button className={`voice-dropzone ${audioFile ? "has-file" : ""}`} type="button" onClick={() => fileInputRef.current?.click()}>
                  {audioFile ? <Check size={22} /> : <Upload size={22} />}
                  <span>{audioFile ? audioFile.name : "Upload a 55+ second voice sample"}</span>
                  <small>{audioFile ? "Ready for secure analysis" : "WAV, MP3, M4A or WebM · minimum 55 sec"}</small>
                </button>
                <input ref={fileInputRef} className="sr-only" type="file" accept="audio/*" onChange={(event) => checkAudioLength(event.target.files[0])} />
                {audioError && <p className="audio-error">{audioError}</p>}
              </div>
            )}

            {authError && <p className="audio-error">{authError}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Securing access..." : mode === "signup" ? "Create secure profile" : "Enter VoxGuard"}<ArrowRight size={18} /></button>
          </form>
          <p className="auth-terms">By continuing, you agree to our Terms and Privacy Policy.</p>
        </div>
      </section>
    </main>
  );
}