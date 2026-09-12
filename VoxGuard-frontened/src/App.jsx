import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Technology from "./components/Technology";
import Integrations from "./components/Integrations";
import Security from "./components/Security";
import LiveDemo from "./components/LiveDemo";
import Footer from "./components/Footer";
import WelcomeAuth from "./components/WelcomeAuth";
import ProfileDashboard from "./components/ProfileDashboard";
import LanguageAssistant from "./components/LanguageAssistant";
import SeniorModeOverlay from "./components/SeniorModeOverlay";
import AIChatbot from "./components/AIChatbot";
import { useEffect, useState } from "react";
import { API_BASE, authHeaders } from "./config";
import './App.css';

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(window.localStorage.getItem("voxguard_access_token")));
  const [checkingSession, setCheckingSession] = useState(() => Boolean(window.localStorage.getItem("voxguard_access_token")));
  const [profileView, setProfileView] = useState(false);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    if (!authenticated) {
      setCheckingSession(false);
      return undefined;
    }

    let active = true;
    fetch(`${API_BASE}/auth/me`, { headers: authHeaders() })
      .then((response) => {
        if (active && response.status === 401) {
          window.localStorage.removeItem("voxguard_access_token");
          setAuthenticated(false);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [authenticated]);

  if (checkingSession) return null;

  if (!authenticated) {
    return <><WelcomeAuth onAuthenticated={(session) => {
      window.localStorage.setItem("voxguard_access_token", session.access_token);
      setAuthenticated(true);
    }} /><LanguageAssistant /><AIChatbot /></>;
  }

  return (
    <>
      <LanguageAssistant />
      <AIChatbot />
      <SeniorModeOverlay />
      <Navbar onProfileClick={() => setProfileView(true)} />
      {profileView ? (
        <ProfileDashboard records={records} onBack={() => setProfileView(false)} />
      ) : (
        <main className="grid-bg">
          <Hero />
          <HowItWorks />
          <Technology />
          <Integrations />
          <Security />
          <LiveDemo onAnalysisComplete={(record) => setRecords((current) => [record, ...current])} />
        </main>
      )}
      <Footer />
    </>
  );
}