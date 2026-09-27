import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

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
import About from "./components/About";
import Blog from "./components/Blog";

import { API_BASE, authHeaders } from "./config";

import "./App.css";

/* =========================================================
   HOME PAGE
========================================================= */

function Home({ onAnalysisComplete }) {
  return (
    <main className="grid-bg">
      <Hero />

      <HowItWorks />

      <Technology />

      <Integrations />

      <Security />

      <LiveDemo
        onAnalysisComplete={onAnalysisComplete}
      />
    </main>
  );
}

/* =========================================================
   BLOG PAGE
========================================================= */

// function Blog() {
//   return (
//     <main className="grid-bg min-h-screen px-6 py-20 text-white">
//       <div className="mx-auto max-w-6xl">

//         <p className="text-sm font-bold tracking-[0.2em] text-cyan-400">
//           SWARAKSHA BLOG
//         </p>

//         <h1 className="mt-3 text-4xl font-black md:text-6xl">
//           Coming Soon
//         </h1>

//         <p className="mt-5 max-w-2xl text-slate-400">
//           Explore upcoming articles about AI voice cloning,
//           deepfake detection, cybersecurity and digital
//           communication safety.
//         </p>

//       </div>
//     </main>
//   );
// }

/* =========================================================
   SETTINGS PAGE
========================================================= */

function SettingsPage() {
  return (
    <main className="grid-bg min-h-screen px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">

        <p className="text-sm font-bold tracking-[0.2em] text-cyan-400">
          SWARAKSHA SETTINGS
        </p>

        <h1 className="mt-3 text-4xl font-black md:text-6xl">
          Settings
        </h1>

        <p className="mt-5 max-w-2xl text-slate-400">
          Manage your profile, security, appearance and
          other Swaraksha preferences.
        </p>

      </div>
    </main>
  );
}

/* =========================================================
   SECURITY PAGE
========================================================= */

function SecurityPage() {
  return (
    <main className="grid-bg min-h-screen px-6 py-20 text-white">
      <div className="mx-auto max-w-6xl">

        <p className="text-sm font-bold tracking-[0.2em] text-cyan-400">
          SWARAKSHA SECURITY
        </p>

        <h1 className="mt-3 text-4xl font-black md:text-6xl">
          Security & Privacy
        </h1>

        <p className="mt-5 max-w-2xl text-slate-400">
          Manage your privacy and protection preferences
          for your Swaraksha account.
        </p>

      </div>
    </main>
  );
}

/* =========================================================
   MAIN APP
========================================================= */

export default function App() {

  /* =======================================================
     AUTHENTICATION
  ======================================================= */

  const [authenticated, setAuthenticated] = useState(() =>
    Boolean(
      window.localStorage.getItem(
        "voxguard_access_token"
      )
    )
  );

  /* =======================================================
     SESSION CHECK
  ======================================================= */

  const [checkingSession, setCheckingSession] =
    useState(() =>
      Boolean(
        window.localStorage.getItem(
          "voxguard_access_token"
        )
      )
    );

  /* =======================================================
     PROFILE
  ======================================================= */

  const [profileView, setProfileView] =
    useState(false);

  /* =======================================================
     ANALYSIS RECORDS
  ======================================================= */

  const [records, setRecords] = useState([]);

  /* =======================================================
     SESSION VALIDATION
  ======================================================= */

  useEffect(() => {

    if (!authenticated) {
      setCheckingSession(false);
      return undefined;
    }

    let active = true;

    fetch(`${API_BASE}/auth/me`, {
      headers: authHeaders(),
    })
      .then((response) => {

        if (
          active &&
          response.status === 401
        ) {

          window.localStorage.removeItem(
            "voxguard_access_token"
          );

          setAuthenticated(false);
        }
      })

      .catch(() => {})

      .finally(() => {

        if (active) {
          setCheckingSession(false);
        }

      });

    return () => {
      active = false;
    };

  }, [authenticated]);

  /* =======================================================
     SESSION CHECK LOADING
  ======================================================= */

  if (checkingSession) {
    return null;
  }

  /* =======================================================
     AUTHENTICATION SCREEN
  ======================================================= */

  if (!authenticated) {

    return (
      <>
        <WelcomeAuth
          onAuthenticated={(session) => {

            window.localStorage.setItem(
              "voxguard_access_token",
              session.access_token
            );

            setAuthenticated(true);

          }}
        />

        <LanguageAssistant />

        <AIChatbot />
      </>
    );
  }

  /* =======================================================
     AUTHENTICATED APPLICATION
  ======================================================= */

  return (
    <BrowserRouter>

      {/* =================================================
          GLOBAL ASSISTANTS
      ================================================= */}

      <LanguageAssistant />

      <AIChatbot />

      <SeniorModeOverlay />

      {/* =================================================
          NAVBAR
      ================================================= */}

      <Navbar
        onProfileClick={() => {
          setProfileView(true);
        }}
        onLogout={() => {
          localStorage.removeItem(
            "voxguard_access_token"
          );

          setProfileView(false);

          setAuthenticated(false);
        }}
      />

      {/* =================================================
          PROFILE VIEW
      ================================================= */}

      {profileView ? (

        <ProfileDashboard
          records={records}
          onBack={() => {
            setProfileView(false);
          }}
        />

      ) : (

        /* =================================================
           APPLICATION ROUTES
        ================================================= */

        <Routes>

          {/* =================================================
              HOME — DEFAULT PAGE
          ================================================= */}

          <Route
            path="/"
            element={
              <Home
                onAnalysisComplete={(record) => {

                  setRecords((current) => [
                    record,
                    ...current,
                  ]);

                }}
              />
            }
          />

          {/* =================================================
              ABOUT US
          ================================================= */}

          <Route
            path="/about"
            element={<About />}
          />

          {/* =================================================
              BLOG
          ================================================= */}

          <Route
            path="/blog"
            element={<Blog />}
          />

          {/* =================================================
              LIVE DEMO
          ================================================= */}

          <Route
            path="/live-demo"
            element={
              <main className="grid-bg min-h-screen">

                <LiveDemo
                  onAnalysisComplete={(record) => {

                    setRecords((current) => [
                      record,
                      ...current,
                    ]);

                  }}
                />

              </main>
            }
          />

          {/* =================================================
              SETTINGS
          ================================================= */}

          <Route
            path="/settings"
            element={<SettingsPage />}
          />

          {/* =================================================
              SECURITY
          ================================================= */}

          <Route
            path="/security"
            element={<SecurityPage />}
          />

          {/* =================================================
              UNKNOWN ROUTE → HOME
          ================================================= */}

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />

        </Routes>
      )}

      {/* =================================================
          FOOTER
      ================================================= */}

      <Footer />

    </BrowserRouter>
  );
}