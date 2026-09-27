import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronRight,
  ExternalLink,
  FileText,
  Landmark,
  Languages,
  Mic,
  PhoneCall,
  Search,
  ShieldCheck,
  Brain,
  X,
  Sparkles,
  Bookmark,
  Share2,
  Check,
  Volume2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  SlidersHorizontal,
  RotateCcw
} from "lucide-react";

const blogPosts = [
  {
    id: 1,
    category: "Voice Fraud",
    title: "Hyderabad Woman Loses ₹1.97 Lakh in an AI Voice-Cloning Scam",
    source: "The Indian Express",
    date: "September 2025",
    location: "Hyderabad, India",
    icon: PhoneCall,
    featured: true,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80",
    excerpt: "A reported Hyderabad case shows how a familiar voice and an urgent money request can be combined to make an impersonation scam more convincing.",
    content: `A 2025 report by The Indian Express described a case involving a 72-year-old woman in Hyderabad who lost ₹1.97 lakh in a suspected AI voice-cloning fraud.\n\nAccording to the report, the victim first received a WhatsApp message that appeared to come from her sister-in-law in New Jersey and urgently requested money. When she called the number to verify the request, the voice on the other end sounded familiar. She then transferred the money through Google Pay.\n\nThe report said investigators believed the fraudsters had used AI-generated voice technology to imitate the relative. The Hyderabad cybercrime unit was reported to be tracing the digital trail.\n\nWhy this matters for Swaraksha:\nThe case illustrates the danger of treating a familiar voice as sufficient proof of identity. A safer approach is to combine voice-analysis signals with independent verification and contextual risk signals before a sensitive transaction is made.\n\nSafety takeaway:\nIf a caller requests urgent money, independently contact the person using a known number or another trusted channel rather than relying only on the incoming call.`,
    sourceUrl: "https://indianexpress.com/article/technology/artificial-intelligence/ai-scams-surge-in-india-voice-cloning-deepfakes-and-otp-frauds-leave-victims-helpless-10232064/",
  },
  {
    id: 2,
    category: "Voice Fraud",
    title: "Mumbai Businessman Duped of ₹80,000 Using a Cloned Voice",
    source: "The Times of India",
    date: "April 2024",
    location: "Mumbai, India",
    icon: Mic,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=800&q=80",
    excerpt: "A Mumbai case reported in 2024 involved a fraudster allegedly using a cloned version of a son's voice to create a fake emergency and demand bail money.",
    content: `The Times of India reported that a 68-year-old businessman in Powai, Mumbai, lost ₹80,000 in an AI voice-cloning scam.\n\nAccording to the report, the victim received a call that purportedly came from the Indian Embassy in Dubai. The caller claimed that his son had been arrested and needed bail. The fraudster then played a voice that resembled the son's voice and pressured the victim to transfer money immediately.\n\nAfter the transfer, the victim contacted his son and learned that the son was actually at home in Dubai and had not been arrested.\n\nThe case demonstrates a classic social-engineering pattern: authority + urgency + a familiar voice + an immediate financial request.\n\nWhy this matters for Swaraksha:\nA voice can be one signal in an authentication process, but it should not be the only signal. Real-time analysis can provide an additional warning layer while independent verification remains essential.`,
    sourceUrl: "https://timesofindia.indiatimes.com/city/mumbai/mumbai-businessman-falls-victim-to-ai-voice-cloning-loses-rs-80000/articleshow/109225530.cms",
  },
  {
    id: 3,
    category: "Voice Fraud",
    title: "Mumbai Man Loses ₹50,000 After Caller Impersonates His US-Based Brother",
    source: "Free Press Journal",
    date: "August 2025",
    location: "Mumbai, India",
    icon: PhoneCall,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80",
    excerpt: "A Juhu businessman was reportedly tricked after a WhatsApp caller used his US-based brother's identity and a voice that sounded like him.",
    content: `The Free Press Journal reported in August 2025 that a 56-year-old businessman in Mumbai's Juhu area was allegedly duped of ₹50,000 after receiving a WhatsApp call from a US-based number.\n\nAccording to the report, the caller used the photograph of the victim's brother and sounded like the brother. The caller claimed to be unwell and urgently requested ₹50,000.\n\nThe victim first attempted a Google Pay transfer, which failed, and then transferred the amount to a bank account provided by the caller. When another ₹50,000 was requested, he became suspicious and contacted his actual brother, discovering that the earlier call was fraudulent.\n\nWhy this matters for Swaraksha:\nThis case combines several trust signals that can be manipulated together: a familiar photograph, an overseas number, a known person's identity and a convincing voice. A voice-security layer should therefore be considered as part of a broader risk engine rather than as a standalone identity decision.`,
    sourceUrl: "https://www.freepressjournal.in/mumbai/mumbai-news-juhu-man-duped-of-50000-by-ai-cloned-voice-of-us-based-brother-fir-registered",
  },
  {
    id: 4,
    category: "Impersonation",
    title: "Delhi Case Shows How AI Voice Impersonation Can Be Combined With Fear",
    source: "The Indian Express",
    date: "May 2025",
    location: "Delhi, India",
    icon: ShieldCheck,
    readTime: "4 min read",
    image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
    excerpt: "A reported Delhi incident involved a caller claiming to be a police officer and saying that the victim's nephew had been detained.",
    content: `The Indian Express reported on an AI voice-cloning scam involving a Delhi resident.\n\nAccording to the report, the victim received a call from a person claiming to be a police officer. The caller said that the victim's nephew had been taken into custody in connection with a serious case. The incident was presented as an urgent situation requiring immediate action.\n\nThe report discussed how cybercriminals can combine impersonation, emotional pressure and AI-generated voices to make fraudulent calls appear more credible.\n\nWhy this matters:\nVoice cloning does not have to operate alone. It can be combined with personal information gathered from social media, messaging platforms and other sources. That is why Swaraksha is designed around multiple signals: voice authenticity, speaker consistency, contextual indicators and the nature of the requested action.`,
    sourceUrl: "https://indianexpress.com/article/technology/tech-news-technology/the-safe-side-ai-voice-cloning-scams-10023971/",
  },
  {
    id: 5,
    category: "Awareness",
    title: "AI Voice Scams Are Becoming a Growing Security Concern in India",
    source: "The Indian Express",
    date: "September 2025",
    location: "India",
    icon: Brain,
    readTime: "4 min read",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    excerpt: "An Indian Express report examined the growing use of AI in voice cloning, deepfakes, OTP fraud and social engineering targeting Indian users.",
    content: `The Indian Express published a 2025 overview of AI-enabled scams affecting Indian users.\n\nThe report discussed voice cloning, deepfake content and OTP-related fraud, and highlighted how familiar voices can be used to make impersonation more convincing. It also described a Hyderabad case in which a victim lost ₹1.97 lakh after receiving a request that appeared to come from a relative.\n\nThe broader lesson is that AI can strengthen traditional social-engineering techniques. Fraudsters do not necessarily need to invent a completely new scam; they can use AI to make an existing impersonation story more believable.\n\nSwaraksha is intended to address this problem at the communication layer by providing an additional signal when suspicious voice characteristics are detected.`,
    sourceUrl: "https://indianexpress.com/article/technology/artificial-intelligence/ai-scams-surge-in-india-voice-cloning-deepfakes-and-otp-frauds-leave-victims-helpless-10232064/",
  },
  {
    id: 6,
    category: "Legal Protection",
    title: "Indian Court Addresses Unauthorised AI Voice Cloning",
    source: "WIPO Magazine",
    date: "April 2025",
    location: "India",
    icon: Landmark,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?auto=format&fit=crop&w=800&q=80",
    excerpt: "A WIPO report examined an Indian legal case involving unauthorised AI replication of a public figure's voice and the broader personality-rights implications.",
    content: `AI voice cloning is not limited to financial scams. It can also raise questions about identity, consent and unauthorised commercial use.\n\nWIPO Magazine reported on an Indian legal case involving the cloning of singer Arijit Singh's voice. The article discusses how the case highlighted concerns around AI, intellectual property and personality rights.\n\nThese cases show that a person's voice can have value beyond ordinary speech. It can be part of their identity and can potentially be manipulated for commercial or deceptive purposes.\n\nFor a security platform such as Swaraksha, this reinforces the importance of treating voice as sensitive biometric-like information and considering privacy, consent and responsible processing.`,
    sourceUrl: "https://www.wipo.int/en/web/wipo-magazine/articles/ai-voice-cloning-how-a-bollywood-veteran-set-a-legal-precedent-73631",
  },
  {
    id: 7,
    category: "Government",
    title: "Government of India Highlights Synthetic Audio and Deepfake Risks",
    source: "Press Information Bureau • Ministry of Electronics & IT",
    date: "August 2026",
    location: "India",
    icon: Landmark,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80",
    excerpt: "The Government of India has documented synthetic audio, video and text as part of the wider deepfake challenge and described legal and regulatory measures.",
    content: `The Ministry of Electronics & IT, through the Press Information Bureau, published an August 2026 update describing government measures addressing AI-generated deepfakes.\n\nThe release explicitly includes synthetic audio among the deepfake-related risks being addressed. It also references provisions of the Information Technology Act covering areas such as identity theft and impersonation.\n\nThis is important for Swaraksha because the problem is not only a research topic. Synthetic voice and impersonation are increasingly being treated as practical cybersecurity and digital-trust concerns.\n\nSwaraksha complements this wider ecosystem by focusing on the communication stage, where suspicious voice activity can potentially be identified before a user acts on a fraudulent request.`,
    sourceUrl: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2295500&lang=1&reg=1",
  },
  {
    id: 8,
    category: "World • AI Fraud",
    title: "FBI Warns That Criminals Are Using AI-Generated Audio for Financial Fraud",
    source: "FBI Internet Crime Complaint Center (IC3)",
    date: "December 2024",
    location: "United States",
    icon: ShieldCheck,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=800&q=80",
    excerpt: "The FBI warned that criminals can use AI-generated audio to impersonate relatives and public figures and to facilitate financial fraud.",
    content: `In December 2024, the FBI's Internet Crime Complaint Center published an advisory on criminals using generative AI to facilitate financial fraud.\n\nThe advisory specifically describes AI-generated audio, also known as vocal cloning. It says criminals can create audio of a loved one's voice to request emergency financial assistance or demand a ransom. The FBI also warned that criminals may use AI-generated audio to impersonate individuals and attempt to gain access to bank accounts.\n\nThe advisory recommends independently verifying requests and using a secret word or phrase with family members.\n\nWhy this matters for Swaraksha:\nThe FBI warning directly demonstrates why voice familiarity alone is no longer a sufficient trust signal for high-risk requests.`,
    sourceUrl: "https://www.ic3.gov/PSA/2024/PSA241203",
  },
  {
    id: 9,
    category: "World • Consumer Protection",
    title: "FTC Warns: Do Not Trust a Familiar Voice During an Emergency Money Request",
    source: "Federal Trade Commission (FTC)",
    date: "March 2023",
    location: "United States",
    icon: PhoneCall,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1534536281715-e28d76689b4d?auto=format&fit=crop&w=800&q=80",
    excerpt: "The FTC documented how scammers can clone a loved one's voice from a short audio clip and use it in family-emergency scams.",
    content: `The US Federal Trade Commission has repeatedly warned about voice-cloning-enabled family emergency scams.\n\nThe FTC explains that a scammer may obtain a short audio clip from content posted online and use voice-cloning software to imitate a family member. The caller can then create an urgent story and ask for money.\n\nThe FTC's recommended response is particularly relevant to Swaraksha: do not rely on the voice alone. Hang up and call the person back using a phone number that you already know.\n\nThis provides an important principle for voice-security systems: detection can provide an additional warning, but independent identity verification remains important.`,
    sourceUrl: "https://consumer.ftc.gov/comment/180311",
  },
  {
    id: 10,
    category: "World • Regulation",
    title: "FCC Declares AI-Generated Voices in Robocalls Illegal Under US Telecom Rules",
    source: "Federal Communications Commission (FCC)",
    date: "February 2024",
    location: "United States",
    icon: Landmark,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80",
    excerpt: "The FCC announced that calls using AI-generated voices fall under the artificial-voice provisions of the Telephone Consumer Protection Act.",
    content: `In February 2024, the US Federal Communications Commission announced a ruling concerning AI-generated voices in robocalls.\n\nThe FCC said that calls made with AI-generated voices are considered artificial voices under the Telephone Consumer Protection Act. The announcement specifically connected the decision to voice-cloning scams.\n\nThis shows that the voice-cloning problem has moved beyond individual consumer warnings and into regulatory action.\n\nFor Swaraksha, this reinforces the importance of prevention and detection at the point where suspicious calls reach users.`,
    sourceUrl: "https://docs.fcc.gov/public/attachments/DOC-400393A1.pdf",
  },
  {
    id: 11,
    category: "World • Corporate Fraud",
    title: "Europol Reports Deepfake Audio Being Used in CEO Fraud",
    source: "Europol",
    date: "2024",
    location: "Europe",
    icon: Landmark,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    excerpt: "Europol has documented the use of deepfake technology in serious crimes and highlighted a case involving deepfake audio used to impersonate a CEO.",
    content: `Europol's reporting on deepfakes describes the growing criminal use of synthetic media. A later Europol online-fraud report referenced a case in which criminals used deepfake audio to impersonate a company's CEO and elicit a transfer equivalent to approximately €35 million.\n\nThe example demonstrates that synthetic voice threats are not limited to family scams. High-value business transactions can also be targeted.\n\nThis is one reason Swaraksha considers a risk-engine approach: a suspicious voice signal can become more important when combined with a high-risk transaction request or unusual caller context.`,
    sourceUrl: "https://www.europol.europa.eu/publications-events/publications/facing-reality-law-enforcement-and-challenge-of-deepfakes",
  },
  {
    id: 12,
    category: "Research • Detection",
    title: "FTC Voice Cloning Challenge: Real-Time Detection Is a Research Direction",
    source: "Federal Trade Commission (FTC)",
    date: "2024",
    location: "United States",
    icon: Brain,
    readTime: "4 min read",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80",
    excerpt: "The FTC's Voice Cloning Challenge encouraged technical approaches for detecting, authenticating and disrupting harmful voice cloning.",
    content: `The FTC created a Voice Cloning Challenge to encourage solutions addressing harms caused by voice cloning.\n\nThe FTC later highlighted several winning approaches. One approach focused on detecting whether voice patterns are human or synthetic. Another proposed real-time detection of voice cloning and deepfakes in incoming calls or digital audio in short chunks and assigning a liveness score.\n\nThis research direction is particularly relevant to Swaraksha's design goal of analysing calls continuously rather than waiting until the entire conversation has ended.\n\nSwaraksha applies the same general security principle to its workflow: analyse incoming audio in windows, update the risk assessment and provide an actionable warning when suspicious signals accumulate.`,
    sourceUrl: "https://consumer.ftc.gov/comment/200215",
  },
  {
    id: 13,
    category: "Research • AASIST",
    title: "AASIST: Audio Anti-Spoofing for Synthetic Speech Detection",
    source: "AASIST Open-Source Research Repository",
    date: "Research implementation",
    location: "Research",
    icon: Mic,
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80",
    excerpt: "AASIST is an audio anti-spoofing approach used in research for detecting spoofed or synthetic speech.",
    content: `AASIST is an audio anti-spoofing model designed to capture spectro-temporal information for detecting spoofed speech.\n\nSwaraksha uses an AASIST-based component as one signal in its voice-analysis pipeline.\n\nIt is important to distinguish between a research model and a complete security system. A detector can produce useful evidence, but real-world communication also contains network compression, background noise, microphones and other sources of variation.\n\nFor that reason, Swaraksha combines voice analysis with speaker-related and contextual signals rather than treating a single model output as an absolute decision.`,
    sourceUrl: "https://github.com/clovaai/aasist",
  },
  {
    id: 14,
    category: "Research • Speaker Verification",
    title: "ECAPA-TDNN and Speaker Verification",
    source: "Research Paper • arXiv",
    date: "2020",
    location: "Research",
    icon: Brain,
    readTime: "4 min read",
    image: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80",
    excerpt: "ECAPA-TDNN is a neural architecture for speaker verification and can provide speaker-consistency information as part of a broader voice-security pipeline.",
    content: `Speaker verification and deepfake detection answer different questions. A deepfake detector asks whether the speech contains characteristics associated with spoofed or synthetic audio. Speaker verification instead compares a voice against a reference representation to determine whether the speaker is consistent with the enrolled identity.\n\nECAPA-TDNN is a well-known speaker-verification architecture described in the research literature.\n\nSwaraksha can combine speaker-consistency information with synthetic-speech detection and contextual risk signals to produce a broader assessment.`,
    sourceUrl: "https://arxiv.org/abs/2005.07143",
  },
];

const categories = [
  "All",
  "Voice Fraud",
  "Impersonation",
  "Awareness",
  "Legal Protection",
  "Government",
  "World • AI Fraud",
  "World • Consumer Protection",
  "World • Regulation",
  "World • Corporate Fraud",
  "Research • Detection",
  "Research • AASIST",
  "Research • Speaker Verification",
];

const INITIAL_PAGE_SIZE = 6;
const LOAD_MORE_STEP = 3;

const customStyles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(22px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.94);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes pulseGlow {
    0%, 100% {
      opacity: 0.35;
      transform: scale(1);
    }
    50% {
      opacity: 0.65;
      transform: scale(1.06);
    }
  }

  .animate-fade-in-up {
    animation: fadeInUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .animate-scale-in {
    animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .animate-pulse-glow {
    animation: pulseGlow 6s ease-in-out infinite;
  }

  /* Glassmorphism utility classes */
  .glass-card {
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .glass-card-hover {
    transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1),
                box-shadow 0.35s cubic-bezier(0.2, 0.8, 0.2, 1),
                border-color 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .glass-card-hover:hover {
    transform: translateY(-5px);
    border-color: rgba(34, 211, 238, 0.35);
    box-shadow: 0 16px 36px -10px rgba(6, 182, 212, 0.18),
                0 0 0 1px rgba(34, 211, 238, 0.15);
  }

  .glass-pill {
    background: rgba(30, 41, 59, 0.6);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  /* Accessibility: Respect Reduced Motion Preferences */
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.001s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001s !important;
      scroll-behavior: auto !important;
    }
    .glass-card-hover:hover {
      transform: none !important;
    }
    .animate-pulse-glow {
      animation: none !important;
    }
  }
`;

function useScrollReveal() {
  const [hasRevealed, setHasRevealed] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const node = elementRef.current;
    if (!node) return;

    // Fallback if browser prefers reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setHasRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasRevealed(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [elementRef, hasRevealed];
}

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPost, setSelectedPost] = useState(null);
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedPosts, setSavedPosts] = useState(() => [1]);

  // Scroll reveal references
  const [heroRef, heroRevealed] = useScrollReveal();
  const [featuredRef, featuredRevealed] = useScrollReveal();
  const [articlesSectionRef, articlesRevealed] = useScrollReveal();
  const [insightsRef, insightsRevealed] = useScrollReveal();
  const [safetyRef, safetyRevealed] = useScrollReveal();

  const categoryCounts = useMemo(() => {
    const counts = { All: blogPosts.length };
    blogPosts.forEach((post) => {
      counts[post.category] = (counts[post.category] || 0) + 1;
    });
    return counts;
  }, []);

  const filteredPosts = useMemo(() => {
    return blogPosts.filter((post) => {
      const categoryMatch =
        selectedCategory === "All" || post.category === selectedCategory;
      const normalizedSearch = search.trim().toLowerCase();
      if (!normalizedSearch) return categoryMatch;

      const searchableString = [
        post.title,
        post.excerpt,
        post.source,
        post.location,
        post.category,
      ]
        .join(" ")
        .toLowerCase();

      return categoryMatch && searchableString.includes(normalizedSearch);
    });
  }, [selectedCategory, search]);

  /* Reset pagination whenever filter or search query changes */
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [selectedCategory, search]);

  /* Paginated sub-slice of articles */
  const paginatedPosts = useMemo(() => {
    return filteredPosts.slice(0, visibleCount);
  }, [filteredPosts, visibleCount]);

  const hasMore = visibleCount < filteredPosts.length;
  const remainingCount = filteredPosts.length - visibleCount;

  /* Handle load more simulation */
  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + LOAD_MORE_STEP);
      setIsLoadingMore(false);
    }, 380);
  };

  /* Modal Keyboard accessibility (ESC to close) and body scroll lock */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedPost(null);
      }
    };

    if (selectedPost) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPost]);

  /* Toggle bookmark handler */
  const toggleSave = (id, e) => {
    e?.stopPropagation();
    setSavedPosts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  /* Copy active article link */
  const handleCopyLink = (e) => {
    e?.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const featuredPost = blogPosts.find((post) => post.featured);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950 font-sans">
      <style>{customStyles}</style>

      {}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 left-1/4 h-[480px] w-[480px] rounded-full bg-cyan-600/15 blur-[140px] animate-pulse-glow" />
        <div className="absolute top-1/2 -right-32 h-[520px] w-[520px] rounded-full bg-blue-600/15 blur-[150px] animate-pulse-glow" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-10 left-10 h-[440px] w-[440px] rounded-full bg-emerald-600/10 blur-[130px] animate-pulse-glow" style={{ animationDelay: "4s" }} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b10_1px,transparent_1px),linear-gradient(to_bottom,#1e293b10_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {}
      <header
        ref={heroRef}
        className={`relative z-10 border-b border-slate-800/80 px-6 pt-20 pb-24 md:pt-24 md:pb-28 transition-all duration-700 ${
          heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          {/* Badge indicator */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/30 bg-cyan-950/40 px-4 py-1.5 text-xs font-semibold tracking-wider text-cyan-300 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <BookOpen size={14} className="text-cyan-400" />
            <span>SWARAKSHA INTEL PLATFORM</span>
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          </div>

          <h1 className="mt-6 max-w-5xl text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-6xl lg:text-7xl text-white">
            Real-world intelligence on{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
              AI voice security
            </span>
          </h1>

          <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg md:text-xl">
            Real fraud cases, government advisories, research and cybersecurity reports explaining how voice cloning and AI impersonation are affecting people and organisations.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 backdrop-blur-md transition hover:border-cyan-500/40">
              <span className="text-base">🇮🇳</span> Indian fraud cases
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 backdrop-blur-md transition hover:border-cyan-500/40">
              <span className="text-base">🌍</span> Global incidents
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs sm:text-sm font-medium text-slate-300 backdrop-blur-md transition hover:border-cyan-500/40">
              <span className="text-base">🔬</span> Research & detection
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={() => document.getElementById("articles")?.scrollIntoView({ behavior: "smooth" })}
              className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:brightness-110 hover:shadow-cyan-400/40 active:scale-95"
            >
              Explore real-world cases
              <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("articles");
                el?.scrollIntoView({ behavior: "smooth" });
                setSelectedCategory("Research • Detection");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-5 py-3.5 text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:border-slate-700 hover:bg-slate-850 active:scale-95"
            >
              <Brain size={16} className="text-cyan-400" /> View Research Papers
            </button>
          </div>
        </div>
      </header>

      {}
      {featuredPost && (
        <section
          ref={featuredRef}
          className={`relative z-10 px-6 py-14 md:py-16 transition-all duration-700 ${
            featuredRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-400">
                <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
                Featured Indian case
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs text-slate-400">
                <Clock size={13} className="text-cyan-400" /> {featuredPost.readTime}
              </span>
            </div>

            <div className="group relative overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-xl shadow-2xl transition duration-500 hover:border-cyan-500/40 hover:shadow-[0_20px_50px_rgba(6,182,212,0.12)] md:grid md:grid-cols-12">
              {/* Image Container with Zoom */}
              <div className="relative min-h-[300px] overflow-hidden md:col-span-5 lg:col-span-5">
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <div className="absolute bottom-4 left-4 rounded-xl border border-white/20 bg-black/60 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                  📍 {featuredPost.location}
                </div>
              </div>

              {/* Story Content */}
              <div className="flex flex-col justify-between p-6 sm:p-8 md:col-span-7 lg:col-span-7 md:p-10">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-950/70 px-3 py-1 font-bold text-cyan-300">
                      {featuredPost.category}
                    </span>
                    <span>•</span>
                    <span className="text-slate-300 font-medium">{featuredPost.source}</span>
                    <span>•</span>
                    <span>{featuredPost.date}</span>
                  </div>

                  <h2 className="mt-3 text-2xl font-bold leading-snug text-white sm:text-3xl transition group-hover:text-cyan-200">
                    {featuredPost.title}
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                    {featuredPost.excerpt}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800/80">
                  <button
                    onClick={() => setSelectedPost(featuredPost)}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 transition hover:bg-cyan-300 active:scale-95"
                  >
                    Read case <ArrowRight size={16} />
                  </button>
                  <a
                    href={featuredPost.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-700"
                  >
                    Original article <ExternalLink size={15} />
                  </a>
                  <button
                    onClick={(e) => toggleSave(featuredPost.id, e)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition ${
                      savedPosts.includes(featuredPost.id)
                        ? "border-cyan-500/50 bg-cyan-950/50 text-cyan-300"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Bookmark size={14} className={savedPosts.includes(featuredPost.id) ? "fill-cyan-400" : ""} />
                    {savedPosts.includes(featuredPost.id) ? "Bookmarked" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {}
      <section
        id="articles"
        ref={articlesSectionRef}
        className={`relative z-10 border-t border-slate-800/80 bg-slate-950/70 px-6 py-16 md:py-20 transition-all duration-700 ${
          articlesRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          {/* Header & Animated Search Bar */}
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
                <ShieldCheck size={15} />
                <span>Verified sources</span>
              </div>
              <h2 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                Real-world cases & research
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                Real incidents are prioritised, followed by international cases, official advisories and research relevant to Swaraksha.
              </p>
            </div>

            {/* Focused / Expandable Search Box */}
            <div className="relative w-full md:w-80 lg:w-96 transition-all duration-300">
              <div
                className={`relative flex items-center rounded-2xl border transition-all duration-300 ${
                  isSearchFocused
                    ? "border-cyan-400 ring-2 ring-cyan-400/20 shadow-lg shadow-cyan-500/15 bg-slate-900"
                    : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                }`}
              >
                <Search
                  size={18}
                  className={`ml-3.5 transition-colors ${
                    isSearchFocused ? "text-cyan-400" : "text-slate-400"
                  }`}
                />
                <input
                  type="text"
                  placeholder="Search cases, cities, topics..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="w-full bg-transparent py-3 pl-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                    title="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-500">
                <span>Showing {filteredPosts.length} available</span>
                {selectedCategory !== "All" && (
                  <button
                    onClick={() => setSelectedCategory("All")}
                    className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw size={11} /> Reset Filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {}
          <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-slate-800">
            {categories.map((category) => {
              const isSelected = selectedCategory === category;
              const count = categoryCounts[category] || 0;

              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`group relative flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                    isSelected
                      ? "bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-400/20"
                      : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <span>{category}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isSelected
                        ? "bg-slate-950/20 text-slate-950"
                        : "bg-slate-800 text-slate-400 group-hover:text-slate-200"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {}
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedPosts.map((post, idx) => {
              const Icon = post.icon;
              const isSaved = savedPosts.includes(post.id);

              return (
                <article
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="group relative flex flex-col overflow-hidden rounded-2xl glass-card glass-card-hover cursor-pointer animate-fade-in-up"
                  style={{ animationDelay: `${(idx % 6) * 60}ms` }}
                >
                  {/* Article Thumbnail with Zoom */}
                  <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                    {/* Top Actions bar */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[11px] font-bold text-cyan-300 backdrop-blur-md">
                        {post.category}
                      </span>
                      <button
                        onClick={(e) => toggleSave(post.id, e)}
                        className={`rounded-full p-2 backdrop-blur-md transition ${
                          isSaved
                            ? "bg-cyan-500 text-slate-950"
                            : "bg-black/50 text-slate-300 hover:bg-black/80 hover:text-white"
                        }`}
                        title="Bookmark article"
                      >
                        <Bookmark size={13} className={isSaved ? "fill-current" : ""} />
                      </button>
                    </div>

                    {/* Bottom Metadata inside image */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-slate-950/70 text-cyan-400 backdrop-blur-sm">
                          <Icon size={16} />
                        </div>
                        <span className="text-xs text-slate-200">{post.location}</span>
                      </div>
                      <span className="text-[11px] text-slate-300 opacity-90">{post.readTime}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <h3 className="text-lg font-bold leading-snug text-white transition-colors duration-200 group-hover:text-cyan-300">
                      {post.title}
                    </h3>

                    <p className="mt-2.5 flex-1 text-xs sm:text-sm leading-relaxed text-slate-400 line-clamp-3">
                      {post.excerpt}
                    </p>

                    <div className="mt-5 border-t border-slate-800/80 pt-4">
                      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                        <FileText size={13} className="text-cyan-400 shrink-0" />
                        <span className="truncate">{post.source}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar size={13} />
                          <span>{post.date}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 transition-transform duration-200 group-hover:translate-x-1">
                          Read <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {}
          {hasMore && (
            <div className="mt-12 text-center">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="group relative inline-flex items-center gap-2.5 rounded-2xl border border-slate-700 bg-slate-900/80 px-8 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-md transition duration-300 hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white active:scale-95 disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                    <span>Loading more intelligence...</span>
                  </>
                ) : (
                  <>
                    <span>Load More Articles</span>
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-300">
                      +{remainingCount} more
                    </span>
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Empty Search Fallback */}
          {filteredPosts.length === 0 && (
            <div className="mt-8 rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center backdrop-blur-sm">
              <ShieldAlert className="mx-auto text-cyan-400" size={38} />
              <h3 className="mt-3 text-lg font-bold text-white">No intelligence reports found</h3>
              <p className="mt-1 text-sm text-slate-400">
                No matching results for "{search}" in category "{selectedCategory}".
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("All");
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition"
              >
                <RotateCcw size={13} /> Reset search & filters
              </button>
            </div>
          )}
        </div>
      </section>

      {}
      <section
        ref={insightsRef}
        className={`relative z-10 px-6 py-20 transition-all duration-700 ${
          insightsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Pattern recognition
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
              The threat is not only the cloned voice
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-300">
              Across the cases above, attackers combine voice impersonation with urgency, personal information, familiar identities and requests for money or sensitive actions.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="glass-card glass-card-hover rounded-2xl p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                <Mic size={24} />
              </div>
              <h3 className="mt-5 text-base font-bold text-white">Voice cloning</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                A familiar voice can make an impersonation attempt appear more credible.
              </p>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                <PhoneCall size={24} />
              </div>
              <h3 className="mt-5 text-base font-bold text-white">Social engineering</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Fear, urgency and authority are used to reduce the time available for verification.
              </p>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                <ShieldCheck size={24} />
              </div>
              <h3 className="mt-5 text-base font-bold text-white">Financial requests</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Many reported incidents involve requests for immediate transfers or other sensitive actions.
              </p>
            </div>

            <div className="glass-card glass-card-hover rounded-2xl p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                <Brain size={24} />
              </div>
              <h3 className="mt-5 text-base font-bold text-white">AI detection</h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
                Detection can add another security signal, but should work together with independent identity verification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {}
      <section
        ref={safetyRef}
        className={`relative z-10 px-6 pb-20 transition-all duration-700 ${
          safetyRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mx-auto max-w-6xl rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900/90 p-8 text-white shadow-2xl backdrop-blur-xl sm:p-12 md:p-14">
          <div className="max-w-3xl">
            <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase">
              Safety first
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl md:text-5xl">
              Never rely on the voice alone.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
              If a caller urgently requests money, OTPs, credentials or another sensitive action, pause and verify the person's identity through a trusted channel.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <ShieldCheck className="text-cyan-400" size={24} />
                <h3 className="mt-3 text-sm font-bold text-white">Independently verify</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Call back using a number you already know.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <PhoneCall className="text-cyan-400" size={24} />
                <h3 className="mt-3 text-sm font-bold text-white">Slow down urgent requests</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Urgency is often used to prevent independent verification.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <Languages className="text-cyan-400" size={24} />
                <h3 className="mt-3 text-sm font-bold text-white">Report suspicious activity</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Use the appropriate cybercrime or law-enforcement reporting channel in your jurisdiction.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {}
      <footer className="relative z-10 border-t border-slate-800/80 px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            See how Swaraksha approaches the problem
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Explore the live voice-analysis workflow and see how voice signals can be combined with risk indicators.
          </p>
          <a
            href="/live-demo"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-white/10 transition-all duration-200 hover:bg-cyan-300 hover:text-slate-950 active:scale-95"
          >
            Open Live Demo <ArrowRight size={18} />
          </a>
        </div>
      </footer>

      {}
      {selectedPost && (
        <div
          onClick={() => setSelectedPost(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 sm:p-6 backdrop-blur-md animate-scale-in"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-[0_25px_70px_rgba(0,0,0,0.85)]"
          >
            {/* Modal Close Floating Button */}
            <button
              onClick={() => setSelectedPost(null)}
              className="absolute right-4 top-4 z-20 rounded-full border border-white/20 bg-slate-950/70 p-2 text-slate-300 backdrop-blur-md transition hover:bg-white hover:text-slate-950"
              aria-label="Close article modal"
            >
              <X size={18} />
            </button>

            {/* Modal Hero Banner with Image */}
            <div className="relative h-60 w-full overflow-hidden sm:h-72">
              <img
                src={selectedPost.image}
                alt={selectedPost.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-cyan-400/30 bg-cyan-950/80 px-2.5 py-1 text-xs font-bold text-cyan-300 backdrop-blur-md">
                    {selectedPost.category}
                  </span>
                  <span className="text-xs text-slate-300 bg-black/40 px-2.5 py-1 rounded-md backdrop-blur-sm">
                    {selectedPost.location}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-bold leading-tight sm:text-2xl md:text-3xl text-white">
                  {selectedPost.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">{selectedPost.source}</span>
                  <span>•</span>
                  <span>{selectedPost.date}</span>
                  <span>•</span>
                  <span>{selectedPost.readTime}</span>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="whitespace-pre-line px-6 py-8 text-sm leading-relaxed text-slate-300 sm:px-10 sm:text-base">
              {selectedPost.content}
            </div>

            {/* Modal Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/60 px-6 py-5 sm:px-10">
              <div className="flex items-center gap-3">
                <a
                  href={selectedPost.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 active:scale-95"
                >
                  Read original source <ExternalLink size={14} />
                </a>
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                >
                  {copiedLink ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={14} />
                      <span>Share</span>
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={() => setSelectedPost(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}