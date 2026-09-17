import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Play,
  RefreshCw,
  Square,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

import Badge from "./Badge";
import RiskGauge from "./RiskGauge";
import VoiceUploadAnalyzer from "./VoiceUploadAnalyzer";
import { WS_BASE } from "../config";

export default function LiveDemo({ onAnalysisComplete }) {
  const [score, setScore] = useState(18);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready to analyze");
  const [error, setError] = useState("");

  const socket = useRef(null);
  const audioContext = useRef(null);
  const microphone = useRef(null);
  const processor = useRef(null);
  const mediaStream = useRef(null);
  const LIVE_ANALYSIS_WINDOW_SECONDS = 5;

  const stop = () => {
    try {
      processor.current?.disconnect();
    } catch {}

    try {
      microphone.current?.disconnect();
    } catch {}

    try {
      mediaStream.current
        ?.getTracks()
        .forEach((track) => track.stop());
    } catch {}

    try {
      socket.current?.close();
    } catch {}

    try {
      audioContext.current?.close();
    } catch {}

    processor.current = null;
    microphone.current = null;
    mediaStream.current = null;
    audioContext.current = null;
    socket.current = null;

    setRunning(false);
  };

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  const start = async () => {
    setError("");
    setStatus("Requesting microphone access...");

    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.WebSocket
    ) {
      setError(
        "Live microphone analysis is not supported by this browser."
      );

      setStatus(
        "Use Chrome or Edge, or upload a recording below"
      );

      return;
    }

    let stream = null;
    let ws = null;
    let context = null;

    try {
      // --------------------------------------------------
      // 1. Get microphone
      // --------------------------------------------------

      stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      // --------------------------------------------------
      // 2. Create audio context
      // --------------------------------------------------

      context =
        new (
          window.AudioContext ||
          window.webkitAudioContext
        )();

      // Chrome sometimes creates a suspended AudioContext.
      await context.resume();

      // --------------------------------------------------
      // 3. Get authentication token
      // --------------------------------------------------

      const token =
        window.localStorage.getItem(
          "voxguard_access_token"
        );

      if (!token) {
        throw new Error(
          "Please log in before starting Live Analysis."
        );
      }

      // --------------------------------------------------
      // 4. Create WebSocket
      // --------------------------------------------------

      const wsUrl =
        `${WS_BASE}/api/stream?token=` +
        encodeURIComponent(token);

      console.log(
        "[VoxGuard] Connecting to:",
        wsUrl
      );

      ws = new WebSocket(wsUrl);

      ws.binaryType = "arraybuffer";

      // --------------------------------------------------
      // 5. WebSocket events
      // --------------------------------------------------

      ws.onopen = () => {
        console.log(
          "[VoxGuard] WebSocket connected"
        );

        setStatus(
          "Connected — listening for voice..."
        );

        // Tell backend how audio is encoded.
        ws.send(
          JSON.stringify({
            sample_rate: context.sampleRate,
            format: "float32",
            channels: 1,

            // Optional context signals
            caller_number: null,
            transaction_amount: 0,
            new_beneficiary: false,
            user_confirmed: false,
            language: "en",
            device_risk: 0,
          })
        );
      };

      ws.onerror = (event) => {
        console.error(
          "[VoxGuard] WebSocket error:",
          event
        );

        setError(
          "Could not connect to the live analysis service. Make sure the FastAPI backend is running."
        );
      };

      ws.onclose = (event) => {
        console.log(
          "[VoxGuard] WebSocket closed:",
          event.code,
          event.reason
        );

        if (socket.current === ws) {
          setRunning(false);

          if (event.code === 1008) {
            setError(
              "Live analysis authentication failed. Please log in again."
            );

            setStatus(
              "Authentication required"
            );
          } else {
            setStatus(
              "Analysis disconnected"
            );
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const result =
            JSON.parse(event.data);

          console.log(
            "[VoxGuard] Live result:",
            result
          );

          // Backend connection message
          if (
            result.type === "connected"
          ) {
            setStatus(
              "Listening — first analysis in about 5 seconds..."
            );

            return;
          }

          // Backend error
          if (result.error) {
            setError(result.error);

            return;
          }

          // Ignore unknown messages
          if (
            result.type !== "analysis"
          ) {
            return;
          }

          // ------------------------------------------------
          // Calculate risk
          // ------------------------------------------------

          const rawRisk =
            result.risk?.risk_score ??
            result.deepfake?.deepfake_risk ??
            0;

          const nextScore = Math.round(
            Number(rawRisk) || 0
          );

          const safeScore = Math.max(
            0,
            Math.min(100, nextScore)
          );

          const spoofProbability =
            Number(
              result.deepfake
                ?.spoof_probability
            ) || 0;

          const isSpoof =
            spoofProbability >= 0.5;

          const riskLevel =
            result.risk?.risk_level ||
            (safeScore >= 75
              ? "HIGH"
              : safeScore >= 50
              ? "MEDIUM"
              : "LOW");

          const recommendation =
            result.risk?.action ||
            "Continue monitoring and use secondary verification.";

          setScore(safeScore);

          if (riskLevel === "HIGH") {
            setStatus(
              "High-risk voice detected"
            );
          } else if (
            riskLevel === "MEDIUM"
          ) {
            setStatus(
              "Suspicious voice activity detected"
            );
          } else {
            setStatus(
              "Live audio analyzed"
            );
          }

          // ------------------------------------------------
          // Send result to parent/dashboard
          // ------------------------------------------------

          onAnalysisComplete?.({
            id:
              typeof crypto !== "undefined" &&
              crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()),

            createdAt:
              new Date().toISOString(),

            fileName:
              "Live microphone stream",

            result: {
              is_spoof: isSpoof,

              risk_score: safeScore,

              confidence: Math.max(
                0,
                100 - safeScore
              ),

              recommendation,

              deepfake:
                result.deepfake,

              speaker:
                result.speaker,

              transcript:
                result.transcript,

              scam:
                result.scam,

              context:
                result.context,

              risk:
                result.risk,
            },
          });
        } catch (err) {
          console.error(
            "[VoxGuard] Invalid server response:",
            err
          );
        }
      };

      // --------------------------------------------------
      // 6. Create microphone source
      // --------------------------------------------------

      const source =
        context.createMediaStreamSource(
          stream
        );

      // ScriptProcessorNode is supported by
      // current Chrome/Edge and is simple for the demo.
      const processorNode =
        context.createScriptProcessor(
          4096,
          1,
          1
        );

      const silentOutput =
        context.createGain();

      silentOutput.gain.value = 0;

      // --------------------------------------------------
      // 7. Send microphone audio
      // --------------------------------------------------

      processorNode.onaudioprocess = (
        event
      ) => {
        if (
          !ws ||
          ws.readyState !==
            WebSocket.OPEN
        ) {
          return;
        }

        const input =
          event.inputBuffer.getChannelData(
            0
          );

        // Copy the Float32Array because the browser
        // reuses the underlying audio buffer.
        const audio =
          new Float32Array(
            input.length
          );

        audio.set(input);

        ws.send(audio.buffer);
      };

      // --------------------------------------------------
      // 8. Connect audio graph
      // --------------------------------------------------

      source.connect(
        processorNode
      );

      processorNode.connect(
        silentOutput
      );

      silentOutput.connect(
        context.destination
      );

      // --------------------------------------------------
      // 9. Save references
      // --------------------------------------------------

      socket.current = ws;
      audioContext.current = context;
      microphone.current = source;
      processor.current =
        processorNode;
      mediaStream.current = stream;

      setRunning(true);
      setStatus(
        "Listening — speak normally..."
      );
    } catch (err) {
      console.error(
        "[VoxGuard] Live demo error:",
        err
      );

      // Cleanup failed startup
      try {
        stream
          ?.getTracks()
          .forEach((track) =>
            track.stop()
          );
      } catch {}

      try {
        ws?.close();
      } catch {}

      try {
        await context?.close();
      } catch {}

      setError(
        err?.message ||
          "Microphone access failed."
      );

      setStatus(
        "Ready to analyze"
      );

      stop();
    }
  };

  const reset = () => {
    stop();

    setRunning(false);
    setScore(18);
    setStatus(
      "Ready to analyze"
    );
    setError("");
  };

  const isHighRisk =
    score > 72;

  const authenticity =
    Math.max(
      8,
      100 - score
    );

  return (
    <section
      id="demo"
      className="relative mx-auto max-w-7xl px-5 py-24 overflow-hidden"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-96 w-[700px] rounded-full bg-cyan-500/5 blur-[140px]" />

      <div className="mb-12 text-center">
        <Badge>
          INTERACTIVE DEMO
        </Badge>

        <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
          Real-time voice integrity{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
            monitor
          </span>
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400">
          Speak into your microphone and
          VoxGuard continuously analyzes
          voice, speaker, scam and
          transaction-risk signals.
        </p>
      </div>

      <div className="group relative rounded-3xl border border-indigo-500/20 bg-[#0c121e]/85 p-6 shadow-2xl backdrop-blur-xl md:p-10">

        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">

          {/* LEFT */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-950/50 p-6 md:p-8">

            <RiskGauge
              score={score}
            />

            <div className="my-4 flex h-8 items-center justify-center gap-1">
              {[...Array(9)].map(
                (_, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full transition-all duration-300 ${
                      running
                        ? "bg-gradient-to-t from-cyan-400 to-indigo-500 animate-[bounce_0.8s_infinite_ease-in-out]"
                        : "h-2 bg-slate-700"
                    }`}
                    style={{
                      animationDelay: `${
                        (i % 4) *
                        0.15
                      }s`,

                      height: running
                        ? `${Math.max(
                            10,
                            (i + 1) *
                              3.5
                          )}px`
                        : "6px",
                    }}
                  />
                )
              )}
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold">

              <span
                className={`h-2 w-2 rounded-full ${
                  isHighRisk
                    ? "bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-ping"
                    : running
                    ? "bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse"
                    : "bg-emerald-400"
                }`}
              />

              <span
                className={
                  isHighRisk
                    ? "text-rose-300"
                    : running
                    ? "text-cyan-300"
                    : "text-slate-300"
                }
              >
                {status}
              </span>
            </div>

            <div className="mt-7 flex items-center gap-3">

              {!running ? (
                <button
                  onClick={start}
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-cyan-400/40 active:translate-y-0"
                >
                  <Play
                    size={16}
                    className="fill-slate-950 transition-transform group-hover:scale-110"
                  />

                  <span>
                    Start Analysis
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    stop();
                    setStatus(
                      "Analysis stopped"
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-6 py-3 text-sm font-bold text-rose-300 transition-all duration-300 hover:bg-rose-500/20"
                >
                  <Square
                    size={15}
                    className="fill-rose-300"
                  />

                  <span>
                    Stop
                  </span>
                </button>
              )}

              <button
                onClick={reset}
                title="Reset analysis"
                className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700/80 bg-slate-900/60 text-slate-300 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-500 hover:text-white"
              >
                <RefreshCw
                  size={16}
                  className="transition-transform duration-500 hover:rotate-180"
                />
              </button>

            </div>

            {error && (
              <p className="mt-3 max-w-sm text-center text-xs text-rose-300">
                {error}
              </p>
            )}
          </div>

          {/* RIGHT */}
          <div className="space-y-3.5">

            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5 backdrop-blur-sm">

              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-400">
                  Acoustic authenticity
                </span>

                <b
                  className={`font-mono text-base ${
                    isHighRisk
                      ? "text-rose-400"
                      : "text-cyan-400"
                  }`}
                >
                  {authenticity}%
                </b>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isHighRisk
                      ? "bg-rose-500"
                      : "bg-cyan-400"
                  }`}
                  style={{
                    width: `${authenticity}%`,
                  }}
                />
              </div>

            </div>

            {/* Keep your remaining existing telemetry cards here */}

            <VoiceUploadAnalyzer />

          </div>
        </div>
      </div>
    </section>
  );
}