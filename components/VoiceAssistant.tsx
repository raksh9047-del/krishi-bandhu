"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

declare global {
  // eslint-disable-next-line
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

/**
 * VoiceAssistant — a floating mic button for illiterate / low-literacy users.
 *
 * Uses the Web Speech API (SpeechRecognition + SpeechSynthesis) to let users
 * navigate the app and query information entirely by voice, in English, Hindi,
 * or Marathi.  Designed for large touch targets and simple spoken responses.
 *
 * The assistant is purely client-side — no API calls, no external AI service.
 * Commands are matched against a hardcoded intent table so there's no latency
 * and no privacy concern.
 */

const LANG_MAP: Record<string, string> = {
  en: "en-IN",
  mr: "mr-IN",
  hi: "hi-IN",
};

const INTENTS: { patterns: RegExp[]; action: string }[] = [
  { patterns: [/price|price[s]?|market|dam|kimat|bhav/i], action: "navigate:/data" },
  { patterns: [/signal|sowing|sow|plant|crop/i], action: "navigate:/" },
  { patterns: [/map|heatmap|heat/i], action: "navigate:/map" },
  { patterns: [/mandi|market[s]?|directory/i], action: "navigate:/markets" },
  { patterns: [/government|gov|analytics|analysis/i], action: "navigate:/government" },
  { patterns: [/trader|parchi|ledger|receipt/i], action: "navigate:/trader" },
  { patterns: [/storage|cold|godown|warehouse/i], action: "navigate:/storage" },
  { patterns: [/backhaul|truck|transport/i], action: "navigate:/backhaul" },
  { patterns: [/feed|update|news|alert/i], action: "navigate:/feed" },
  { patterns: [/register|signup|sign.up/i], action: "navigate:/register" },
  { patterns: [/login|sign.in/i], action: "navigate:/login" },
  { patterns: [/help|sahayata|madat|madad/i], action: "help" },
  { patterns: [/read.*price|price.*sunao|price.*batao|kimat.*sunao/i], action: "read_price" },
  { patterns: [/stop|band|ruko|radd/i], action: "stop" },
];

function matchIntent(text: string): string | null {
  for (const intent of INTENTS) {
    for (const pat of intent.patterns) {
      if (pat.test(text)) return intent.action;
    }
  }
  return null;
}

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = LANG_MAP[lang] || "en-IN";
  utter.rate = 0.85;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

export function VoiceAssistant() {
  const router = useRouter();
  const language = useAppStore((s) => s.language);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      console.warn("[voice] SpeechRecognition API not available");
      return;
    }
    // eslint-disable-next-line
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // Test that the API actually works (some browsers have partial support)
    try {
      // Can't call rec.start() here without a user gesture, but we can check properties
      if (typeof rec.start !== "function" || typeof rec.abort !== "function") {
        setSupported(false);
        console.warn("[voice] SpeechRecognition API incomplete");
        return;
      }
    } catch {
      setSupported(false);
      return;
    }

    rec.onresult = (e: { resultIndex: number; results: any }) => {
      const idx = e.resultIndex;
      const text = e.results[idx][0].transcript;
      setTranscript(text);
      if (e.results[idx].isFinal) {
        handleCommandRef.current(text.trim().toLowerCase());
      }
    };

    rec.onerror = (e: { error: string }) => {
      console.warn("[voice] speech error:", e.error);
      if (e.error === "not-allowed") {
        setError("Microphone permission denied. Please allow mic access in your browser settings.");
      } else if (e.error === "no-speech" || e.error === "aborted") {
        // user didn't speak or clicked stop — silent
      } else {
        setError(`Voice error: ${e.error}`);
      }
      setListening(false);
    };

    rec.onend = () => setListening(false);

    recognitionRef.current = rec;

    return () => {
      rec.abort();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCommandRef = useRef<(text: string) => void>(() => {});

  const handleCommand = useCallback(
    (text: string) => {
      const action = matchIntent(text);
      if (!action) {
        const msg =
          language === "hi"
            ? "Maaf kijiye, samajh nahi aaya. Phir se boliye."
            : language === "mr"
              ? "Maaf kara, samajh padhle nahi. Punha बोला."
              : "Sorry, I did not understand. Please try again.";
        speak(msg, language);
        return;
      }

      if (action === "stop") {
        speak(
          language === "hi" ? "Theek hai." : language === "mr" ? "ठीक आहे." : "Okay.",
          language
        );
        return;
      }

      if (action === "help") {
        const msg =
          language === "hi"
            ? "Aap keh sakte hain: Kimat dikhao, Signal check karo, Mandi kholo, Map dikhao, Trader, Storage, ya Backhaul."
            : language === "mr"
              ? "तुम्ही म्हणू शकता: भाव दाखवा, सिग्नल तपासा, मंडी उघडा, मॅप दाखवा, ट्रेडर, स्टोरेज, किंवा बॅकहॉल."
              : "You can say: Show prices, Check signal, Open mandi, Show map, Trader, Storage, or Backhaul.";
        speak(msg, language);
        return;
      }

      if (action === "read_price") {
        fetch("/api/prices/onion/lasalgaon")
          .then((r) => r.json())
          .then((d) => {
            const priceMsg =
              language === "hi"
                ? `Pyaaz ka bhav Lasalgaon mandi mein ${d.price} rupaye prati quintal hai.`
                : language === "mr"
                  ? `कांद्याचा भाव लासलगाव मंडीत ${d.price} रुपये प्रति क्विंटल आहे.`
                  : `Onion price at Lasalgaon mandi is ${d.price} rupees per quintal.`;
            speak(priceMsg, language);
          })
          .catch(() => {
            speak(
              language === "hi"
                ? "Kimat prapt nahi ho saki."
                : language === "mr"
                  ? "भाव मिळवता आला नाही."
                  : "Could not fetch the price.",
              language
            );
          });
        return;
      }

      // Navigate commands
      if (action.startsWith("navigate:")) {
        const path = action.split(":")[1];
        const confirmMsg =
          language === "hi"
            ? `Khol raha hoon: ${path}`
            : language === "mr"
              ? `उघडत आहे: ${path}`
              : `Opening: ${path}`;
        speak(confirmMsg, language);
        router.push(path);
      }
    },
    [language, router]
  );

  // Keep ref in sync so the useEffect's onresult callback always uses latest handleCommand
  handleCommandRef.current = handleCommand;

  const toggleListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) {
      console.warn("[voice] recognitionRef is null — SpeechRecognition may not have initialized");
      setError("Voice assistant not ready. Please refresh the page.");
      return;
    }

    if (listening) {
      rec.abort();
      setListening(false);
      return;
    }

    setTranscript("");
    setError(null);
    rec.lang = LANG_MAP[language] || "en-IN";
    try {
      rec.start();
      setListening(true);
      setExpanded(true);

      // Auto-speak guidance after a brief pause
      setTimeout(() => {
        const msg =
          language === "hi"
            ? "Boliye, aapki seva mein hoon."
            : language === "mr"
              ? "बोला, तुमच्या सेवेत आहे."
              : "I am listening. Tell me what you need.";
        speak(msg, language);
      }, 500);
    } catch (err) {
      console.error("[voice] recognition.start() failed:", err);
      setError("Could not start voice recognition. Check microphone permissions.");
      setListening(false);
    }
  }, [listening, language]);

  if (!supported) return null;

  return (
    <>
      {/* Error banner */}
      {error && (
        <div className="fixed bottom-20 left-4 right-4 z-50 max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="mt-1 text-xs font-semibold text-red-500 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Transcript tooltip */}
      {expanded && transcript && (
        <div className="fixed bottom-24 left-1/2 z-50 max-w-xs -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-lg">
          {transcript}
        </div>
      )}

      {/* Mic button */}
      <button
        type="button"
        onClick={toggleListening}
        aria-label={listening ? "Stop listening" : "Start voice assistant"}
        className={[
          "fixed bottom-20 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all duration-200 lg:bottom-6 lg:right-6",
          listening
            ? "animate-pulse bg-signal-red text-white ring-4 ring-signal-red/30"
            : "bg-trust-600 text-white hover:bg-trust-700",
          "active:scale-95"
        ].join(" ")}
      >
        {listening ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth={2}>
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>

      {/* Expanded help hint (first time) */}
      {expanded && !listening && !transcript && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="fixed bottom-20 right-24 z-50 max-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg"
        >
          {language === "hi"
            ? "Boliye ya tap karein"
            : language === "mr"
              ? "बोला किंवा टॅप करा"
              : "Speak or tap the mic"}
        </button>
      )}
    </>
  );
}
