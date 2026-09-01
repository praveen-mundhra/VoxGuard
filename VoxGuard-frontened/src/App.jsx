import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Technology from "./components/Technology";
import Integrations from "./components/Integrations";
import Security from "./components/Security";
import LiveDemo from "./components/LiveDemo";
import Footer from "./components/Footer";

export default function App() {
  return (
    <>
      <Navbar />
      <main className="grid-bg">
        <Hero />
        <HowItWorks />
        <Technology />
        <Integrations />
        <Security />
        <LiveDemo />
      </main>
      <Footer />
    </>
  );
}