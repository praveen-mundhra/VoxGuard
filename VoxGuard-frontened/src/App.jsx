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
import { useState } from "react";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [profileView, setProfileView] = useState(false);
  const [records, setRecords] = useState([]);

  if (!authenticated) {
    return <WelcomeAuth onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <>
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