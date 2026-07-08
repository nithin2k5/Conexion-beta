"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ParticleBackground from "../components/ParticleBackground";
import { 
  RiMessage3Line, RiVideoChatLine, RiMicLine, RiMicOffLine, 
  RiCameraLine, RiCameraOffLine, RiSendPlaneFill, RiSkipForwardLine, 
  RiCloseCircleLine, RiSearchEyeLine, RiAlertFill, RiShieldCheckLine, 
  RiFlag2Line, RiChat1Line, RiArrowLeftLine 
} from "react-icons/ri";
import { useNsfwDetection, useNsfwVideoAnalysis } from "../hooks/useNsfwDetection";

const REPORT_REASONS = ["Inappropriate content", "Harassment", "Spam", "Underage user", "Other"];
const INTEREST_CATEGORIES = [
  {
    label: "Creative",
    items: ["🎨 Art", "🎬 Cinema", "📸 Photography", "✏️ Design", "🎭 Theatre", "🖋️ Writing", "🎮 Gaming", "🎵 Music", "🎸 Indie Music"],
  },
  {
    label: "Mind",
    items: ["📖 Philosophy", "🧠 Psychology", "♟️ Strategy", "🧩 Puzzles", "📚 Literature", "🔮 Mythology", "🗣️ Linguistics"],
  },
  {
    label: "Science & Tech",
    items: ["💻 Tech", "🤖 AI", "🚀 Space", "🔬 Science", "⚛️ Physics", "🧬 Biology", "🌐 Open Source"],
  },
  {
    label: "Lifestyle",
    items: ["✈️ Travel", "🍳 Cooking", "🌿 Wellness", "🧘 Meditation", "🏃 Fitness", "🌱 Sustainability", "🐾 Animals"],
  },
  {
    label: "Culture",
    items: ["🎌 Anime", "📺 TV Shows", "📰 Current Events", "🏛️ History", "🌍 Geopolitics", "🎙️ Podcasts", "📡 Media"],
  },
  {
    label: "Passion",
    items: ["🌙 Night Owl", "☕ Coffee", "📦 Minimalism", "🎲 Board Games", "🧶 Crafts", "🔭 Stargazing", "🎯 Self-Improvement"],
  },
];
const ALL_INTERESTS = INTEREST_CATEGORIES.flatMap(c => c.items);

// ── Hate-speech guard ──────────────────────────────────────────────────────
// A representative list of slurs / hate terms. Extend as needed.
const HATE_WORDS = [
  // racial & ethnic slurs (abbreviated to avoid embedding them verbatim)
  "nigger","nigga","chink","gook","spic","wetback","kike","kyke",
  "raghead","towelhead","sandnigger","coon","porch monkey","jungle bunny",
  "zipperhead","slope","cracker","honky","beaner","redskin",
  // sexual orientation / gender slurs
  "faggot","fag","dyke","tranny","shemale","queer",
  // religious slurs
  "infidel","crusader","islamophobe",
  // disability slurs
  "retard","retarded","spastic",
  // general hate / incitement
  "kill yourself","kys","go die","hang yourself",
  "nazi","heil","white power","white supremacy",
  // explicit sexual / pornographic
  "porn","sex","tits","dick","pussy","cock","boobs","vagina","penis","cunt","slut","whore","fuck","bitch",
];

function detectHateSpeech(text: string): { flagged: boolean; words: string[] } {
  const lower = text.toLowerCase();
  const found = HATE_WORDS.filter(w => {
    const re = new RegExp(`(?<![a-z])${w.replace(/ /g, "\\s+")}(?![a-z])`, "i");
    return re.test(lower);
  });
  return { flagged: found.length > 0, words: found };
}

/** Renders draft text with hate-speech words visually struck-through */
function DraftPreview({ text, flaggedWords }: { text: string; flaggedWords: string[] }) {
  if (flaggedWords.length === 0) return <span>{text}</span>;
  // Build a regex that matches any of the flagged words (case-insensitive)
  const pattern = flaggedWords.map(w => w.replace(/ /g, "\\s+")).join("|");
  const re = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(re);
  return (
    <span>
      {parts.map((part, i) =>
        re.test(part)
          ? <span key={i} className="line-through text-red-400 font-semibold" title="Blocked word">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}
const getWsUrl = () => {
  let url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
  if (typeof window !== "undefined") {
    if (!process.env.NEXT_PUBLIC_WS_URL && window.location.hostname !== "localhost") {
      url = url.replace("localhost", window.location.hostname);
    }
    if (window.location.protocol === "https:" && url.startsWith("ws://")) {
      url = url.replace("ws://", "wss://");
    }
  }
  return url;
};

const getApiBase = () => {
  let url = process.env.NEXT_PUBLIC_API_URL?.replace('/api/stats', '') || "http://localhost:3001";
  if (typeof window !== "undefined") {
    if (!process.env.NEXT_PUBLIC_API_URL && window.location.hostname !== "localhost") {
      url = url.replace("localhost", window.location.hostname);
    }
    if (window.location.protocol === "https:" && url.startsWith("http://")) {
      url = url.replace("http://", "https://");
    }
  }
  return url;
};

type Status = "idle" | "connecting" | "queued" | "chatting" | "ended";
type ChatMode = "text" | "video";
interface Msg { id: string; from: "me" | "them" | "system"; text: string; ts?: number; replyTo?: { text: string; from: "me" | "them" }; }

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Minimal, elegant magnetic button for controls
const ControlButton = ({ icon: Icon, onClick, active = false, danger = false, disabled = false, label }: any) => {
  return (
    <motion.button 
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative group flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${
        disabled ? "opacity-50 cursor-not-allowed bg-[var(--color-beige)] text-[var(--color-gray-light)]" :
        active 
          ? "bg-[var(--color-charcoal)] text-[var(--color-ivory)] shadow-md" 
          : danger 
            ? "bg-[#D4916A]/10 text-[#D4916A] hover:bg-[#D4916A] hover:text-white" 
            : "bg-white/60 text-[var(--color-charcoal)] hover:bg-white shadow-sm border border-[var(--color-border)]"
      }`}
    >
      <Icon className="text-xl" />
      {label && (
        <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-[var(--color-charcoal)] text-[var(--color-ivory)] text-[10px] px-2 py-1 rounded-md tracking-wider uppercase font-semibold pointer-events-none whitespace-nowrap">
          {label}
        </span>
      )}
    </motion.button>
  );
}

function ChatApp() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode") as ChatMode | null;
  const [mode, setMode] = useState<ChatMode>(modeParam === "video" ? "video" : "text");

  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("conexion_disclaimer_accepted") !== "1";
  });
  const [showNamePrompt, setShowNamePrompt] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("conexion_user_name");
  });
  const [myName, setMyName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("conexion_user_name") || "";
  });
  const [nameInput, setNameInput] = useState("");
  const [partnerName, setPartnerName] = useState("Stranger");

  const acceptDisclaimer = () => {
    sessionStorage.setItem("conexion_disclaimer_accepted", "1");
    setShowDisclaimer(false);
    // If name not yet set, show name prompt next
    if (!sessionStorage.getItem("conexion_user_name")) setShowNamePrompt(true);
  };
  const saveName = () => {
    const n = nameInput.trim() || "Anonymous";
    sessionStorage.setItem("conexion_user_name", n);
    setMyName(n);
    setShowNamePrompt(false);
  };

  const [status, setStatus] = useState<Status>("idle");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [wsError, setWsError] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showVideoChat, setShowVideoChat] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const [camError, setCamError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Msg | null>(null);
  const replyBarRef = useRef<HTMLDivElement>(null);
  const [showEndedPopup, setShowEndedPopup] = useState(false);
  const [endedBy, setEndedBy] = useState<"me" | "them">("them");
  const sessionDurationRef = useRef(0);
  
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const pipContainerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const { modelLoaded: nsfwReady, classifyElement } = useNsfwDetection({ enabled: mode === "video" });
  const isRemoteNsfw = useNsfwVideoAnalysis(remoteVideoRef, classifyElement, { enabled: mode === "video" && status === "chatting" && nsfwReady });
  const isLocalNsfw = useNsfwVideoAnalysis(localVideoRef, classifyElement, { enabled: mode === "video" && camOn && nsfwReady });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, mode]);

  useEffect(() => {
    if (status === "chatting") timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // Show ended popup whenever a conversation finishes
  useEffect(() => {
    if (status === "ended") {
      sessionDurationRef.current = elapsed;
      const t = setTimeout(() => setShowEndedPopup(true), 400);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const localStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    if (mode === "video") {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
        localStreamRef.current = stream; setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }).catch(err => {
        setCamOn(false); setMicOn(false);
        setCamError("Camera/Mic access denied or unavailable.");
      });
    } else {
      setCamError(null);
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; setLocalStream(null); }
    }
    return () => { if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop()); };
  }, [mode]);

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = camOn);
      localStream.getAudioTracks().forEach(t => t.enabled = micOn);
    }
  }, [camOn, micOn, localStream]);

  useEffect(() => {
    fetch(`${getApiBase()}/api/turn-credentials`).then(res => res.json()).then(data => { if (data.iceServers?.length) setIceServers(data.iceServers); }).catch(() => {});
  }, []);

  const wsSend = (payload: object) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload)); };

  const setupWebRTC = useCallback((role: "caller" | "callee") => {
    if (pcRef.current) pcRef.current.close();
    const hasTurn = iceServers.some(s => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return urls.some(u => u.startsWith("turn:"));
    });
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: hasTurn ? "relay" : "all"
    });
    pcRef.current = pc;
    if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.ontrack = event => { if (remoteVideoRef.current && event.streams[0]) remoteVideoRef.current.srcObject = event.streams[0]; };
    pc.onicecandidate = event => { if (event.candidate) wsSend({ type: "rtc_signal", payload: { candidate: event.candidate } }); };
    if (role === "caller") pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => wsSend({ type: "rtc_signal", payload: { offer: pc.localDescription } })).catch(console.error);
  }, [localStream, iceServers]);

  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current || reconnectAttemptRef.current >= 10) { setIsReconnecting(false); setWsError(true); return; }
    setIsReconnecting(true);
    reconnectTimerRef.current = setTimeout(() => { reconnectAttemptRef.current++; connectWS(); }, Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000));
  }, []);

  const connectWS = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return wsRef.current;
    setWsError(false);
    let ws;
    try {
      ws = new WebSocket(getWsUrl());
    } catch (e) {
      console.warn("WebSocket connection failed (SecurityError likely due to mixed content):", e);
      setWsError(true);
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => { setWsError(false); setIsReconnecting(false); reconnectAttemptRef.current = 0; pingRef.current = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" })); }, 25000); };
    ws.onmessage = async (ev) => {
      let msg: any; try { msg = JSON.parse(ev.data); } catch { return; }
      switch (msg.type) {
        case "online_count": setOnlineCount(msg.count); break;
        case "queued": setStatus("queued"); setQueuePosition(msg.position); break;
        case "matched":
          setSharedInterests(msg.sharedInterests ?? []); setStatus("chatting"); setElapsed(0);
          setPartnerName(msg.partnerName || "Stranger");
          setMsgs([{ id: crypto.randomUUID(), from: "system", text: (msg.sharedInterests ?? []).length > 0 ? `Matched! Shared interests: ${(msg.sharedInterests ?? []).join(", ")}` : "A new connection has been established." }]);
          if (mode === "video") setupWebRTC(msg.role);
          break;
        case "message": {
          const incomingReplyTo = msg.replyTo?.text
            ? { text: msg.replyTo.text, from: "them" as const }
            : undefined;
          setMsgs(m => [...m, { id: crypto.randomUUID(), from: "them", text: msg.text, replyTo: incomingReplyTo }]);
          break;
        }
        case "rtc_signal":
          if (!pcRef.current) break;
          try {
            if (msg.payload.offer) { await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.payload.offer)); const ans = await pcRef.current.createAnswer(); await pcRef.current.setLocalDescription(ans); wsSend({ type: "rtc_signal", payload: { answer: pcRef.current.localDescription } }); }
            else if (msg.payload.answer) await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.payload.answer));
            else if (msg.payload.candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
          } catch (err) { console.error("RTC Error", err); }
          break;
        case "partner_left":
          setStatus("ended"); setEndedBy("them"); if (pcRef.current) pcRef.current.close(); if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          setMsgs(m => [...m, { id: crypto.randomUUID(), from: "system", text: "Connection severed by the other party." }]);
          break;
      }
    };
    ws.onerror = () => setWsError(true);
    ws.onclose = () => { if (pingRef.current) clearInterval(pingRef.current); if (!intentionalCloseRef.current) { setWsError(true); scheduleReconnect(); } };
    return ws;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, setupWebRTC, scheduleReconnect]);

  useEffect(() => {
    intentionalCloseRef.current = false; const ws = connectWS();
    return () => { intentionalCloseRef.current = true; if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); if (pingRef.current) clearInterval(pingRef.current); if (pcRef.current) pcRef.current.close(); ws?.close(); };
  }, [connectWS]);

  const sys = (text: string): Msg => ({ id: crypto.randomUUID(), from: "system", text });

  const startSearch = () => {
    let ws = wsRef.current; if (!ws || ws.readyState > WebSocket.OPEN) ws = connectWS();
    if (!ws) return; // Prevent crash if connectWS fails and returns undefined
    const queuePayload = JSON.stringify({ type: "queue", interests: tags, name: myName || "Anonymous" });
    if (ws.readyState === WebSocket.OPEN) ws.send(queuePayload);
    else ws.addEventListener("open", () => ws?.send(queuePayload), { once: true });
    setStatus("connecting"); setElapsed(0); setMsgs([]); setSharedInterests([]); setQueuePosition(null);
    setShowEndedPopup(false); setReplyingTo(null); setPartnerName("Stranger");
  };

  const stopSearch = () => { wsSend({ type: "cancel" }); setStatus("idle"); };
  const skip = () => { wsSend({ type: "skip" }); setStatus("connecting"); setElapsed(0); setMsgs([]); setShowReport(false); setShowEndedPopup(false); setReplyingTo(null); };
  const endCall = () => { wsSend({ type: "end" }); setEndedBy("me"); setStatus("ended"); setMsgs(m => [...m, sys("You closed the connection.")]); setShowReport(false); };
  
  const reportUser = (reason: string) => { wsSend({ type: "report", reason }); setMsgs(m => [...m, sys("User reported.")]); setShowReport(false); setTimeout(() => skip(), 800); };

  const send = () => {
    if (!draft.trim() || status !== "chatting") return;
    const { flagged } = detectHateSpeech(draft);
    if (flagged) return;
    const trimmed = draft.trim();
    const payload: Record<string, unknown> = { type: "message", text: trimmed };
    if (replyingTo) payload.replyTo = { text: replyingTo.text };
    wsSend(payload);
    setMsgs(m => [...m, {
      id: crypto.randomUUID(),
      from: "me",
      text: trimmed,
      replyTo: replyingTo && replyingTo.from !== "system" ? { text: replyingTo.text, from: replyingTo.from } : undefined,
    }]);
    setDraft("");
    setReplyingTo(null);
  };

  const switchMode = (m: ChatMode) => { if (status === "chatting" || status === "connecting" || status === "queued") return; setMode(m); setStatus("idle"); setMsgs([]); };
  const isSearching = status === "connecting" || status === "queued";

  /* ───────────────────────── RENDERING ───────────────────────── */
  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[var(--color-ivory)] text-[var(--color-charcoal)] font-sans">
      <ParticleBackground />

      {/* Well-behaviour Disclaimer Modal */}
      <AnimatePresence>
        {showDisclaimer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center px-4"
            style={{ backgroundColor: "rgba(30, 25, 20, 0.65)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 20, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-lg rounded-[2rem] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.25)]"
              style={{ backgroundColor: "var(--color-warm-white)", border: "1px solid var(--color-border)" }}
            >
              {/* Header stripe */}
              <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl" aria-hidden="true">🛡️</span>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "var(--color-gray-brown)" }}>Community Guidelines</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight" style={{ color: "var(--color-charcoal)", fontFamily: "var(--font-serif)" }}>
                  Before you connect…
                </h2>
              </div>

              {/* Body */}
              <div className="px-8 py-6 space-y-4">
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-gray-brown)" }}>
                  Conexion enables genuine human connection while protecting your privacy. But anonymity comes
                  with responsibility. By proceeding you agree to our{" "}
                  <strong style={{ color: "var(--color-charcoal)" }}>Community Pledge</strong>:
                </p>
                <ul className="space-y-3">
                  {[
                    ["✦", "Treat every person with respect and dignity."],
                    ["✦", "No harassment, hate speech, or discriminatory behaviour."],
                    ["✦", "No explicit, sexual, or graphic content."],
                    ["✦", "No illegal activity of any kind."],
                    ["✦", "Users under 18 are strictly prohibited from using this platform."],
                  ].map(([icon, text], i) => (
                    <li key={i} className="flex items-start gap-3 text-sm" style={{ color: "var(--color-gray-brown)" }}>
                      <span className="shrink-0 mt-0.5 font-bold" style={{ color: "var(--color-peach)" }}>{icon}</span>
                      {text}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] leading-relaxed pt-2" style={{ color: "var(--color-gray-light)" }}>
                  Violations may be reported to platform moderators and, where required by law, to the
                  relevant authorities. Anonymous does not mean consequence-free.{" "}
                  <Link href="/terms" className="underline" style={{ textUnderlineOffset: 3 }}>Full Terms →</Link>
                </p>
              </div>

              {/* CTA */}
              <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={acceptDisclaimer}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-colors"
                  style={{ backgroundColor: "var(--color-charcoal)", color: "var(--color-ivory)" }}
                >
                  I agree — Let me in
                </motion.button>
                <Link
                  href="/"
                  className="flex-none flex items-center justify-center py-4 px-6 rounded-2xl text-sm font-bold uppercase tracking-widest border transition-colors"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-gray-brown)" }}
                >
                  Go back
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name Prompt Modal */}
      <AnimatePresence>
        {!showDisclaimer && showNamePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center px-4"
            style={{ backgroundColor: "rgba(30, 25, 20, 0.65)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 24, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm rounded-[2rem] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.25)]"
              style={{ backgroundColor: "var(--color-warm-white)", border: "1px solid var(--color-border)" }}
            >
              {/* Top accent strip */}
              <div className="h-1 w-full bg-gradient-to-r from-[var(--color-charcoal)] via-[var(--color-gray-brown)] to-[var(--color-peach)]" />

              <div className="px-8 pt-8 pb-9 flex flex-col gap-6">
                {/* Header */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">✦</span>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "var(--color-gray-brown)" }}>One last thing</span>
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--color-charcoal)" }}>
                    What shall we<br />
                    <span style={{ fontStyle: "italic", color: "var(--color-gray-brown)" }}>call you?</span>
                  </h2>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--color-gray-light)" }}>
                    Your name is only shared with your matched partner — never stored on our servers.
                  </p>
                </div>

                {/* Input */}
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all focus-within:border-[var(--color-charcoal)] focus-within:ring-2 focus-within:ring-[var(--color-charcoal)]/10"
                  style={{ border: "1px solid var(--color-border)", backgroundColor: "var(--color-parchment)" }}
                >
                  <span className="text-base">👤</span>
                  <input
                    autoFocus
                    maxLength={30}
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveName()}
                    placeholder="Enter your name…"
                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder-[var(--color-gray-light)]"
                    style={{ color: "var(--color-charcoal)" }}
                  />
                  {nameInput.length > 0 && (
                    <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: "var(--color-gray-light)" }}>
                      {30 - nameInput.length}
                    </span>
                  )}
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-2.5">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={saveName}
                    className="w-full py-4 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-md"
                    style={{ backgroundColor: "var(--color-charcoal)", color: "var(--color-ivory)" }}
                  >
                    Continue →
                  </motion.button>
                  <button
                    onClick={() => {
                      sessionStorage.setItem("conexion_user_name", "Anonymous");
                      setMyName("Anonymous");
                      setShowNamePrompt(false);
                    }}
                    className="w-full py-3 text-xs font-semibold text-center transition-colors hover:opacity-70"
                    style={{ color: "var(--color-gray-light)" }}
                  >
                    Stay anonymous
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reconnection Banner */}
      <AnimatePresence>
        {isReconnecting && (
          <motion.div initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }} className="fixed top-0 inset-x-0 z-[100] bg-[var(--color-charcoal)] text-[var(--color-ivory)] py-2 text-center text-xs tracking-widest uppercase font-bold flex justify-center items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[var(--color-ivory)] animate-ping" /> Reconnecting...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex-none h-16 md:h-18 px-4 md:px-8 flex items-center justify-between border-b border-[var(--color-border)] bg-white/50 backdrop-blur-xl relative z-40 gap-3">

        {/* ── Left: Brand + Back ── */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <Link
            href="/"
            className="group w-9 h-9 rounded-xl flex items-center justify-center border border-[var(--color-border)] bg-white/70 text-[var(--color-gray-brown)] hover:bg-[var(--color-charcoal)] hover:text-[var(--color-ivory)] hover:border-[var(--color-charcoal)] transition-all duration-200 shadow-sm"
          >
            <RiArrowLeftLine className="text-base group-hover:-translate-x-0.5 transition-transform" />
          </Link>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-serif text-[15px] font-bold tracking-tight" style={{ color: "var(--color-charcoal)" }}>
              Cone<span style={{ color: "var(--color-peach)" }}>x</span>ion
            </span>
            {/* Live status pill */}
            <AnimatePresence mode="wait">
              <motion.span
                key={status}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="text-[9px] font-bold uppercase tracking-[0.18em] flex items-center gap-1 mt-0.5"
                style={{
                  color: status === "chatting" ? "#6B8A6A" : status === "connecting" || status === "queued" ? "var(--color-peach)" : "var(--color-gray-light)"
                }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block ${status === "chatting" ? "bg-[#6B8A6A] animate-pulse" : status === "connecting" || status === "queued" ? "bg-[var(--color-peach)] animate-ping" : "bg-[var(--color-gray-light)]"}`}
                />
                {status === "idle" ? "Ready" : status === "connecting" ? "Searching…" : status === "queued" ? `Queue · #${queuePosition ?? "—"}` : status === "chatting" ? "Live" : "Ended"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Centre: Mode Toggle ── */}
        <div className="flex-1 flex justify-center">
          <div className="relative flex items-center p-[3px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-parchment)] shadow-inner">
            {/* Sliding highlight */}
            <motion.div
              className="absolute top-[3px] bottom-[3px] rounded-[10px] bg-[var(--color-charcoal)] shadow-md"
              layout
              layoutId="nav-mode-pill"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              style={{
                width: "calc(50% - 3px)",
                left: mode === "text" ? 3 : "calc(50%)",
              }}
            />
            <button
              onClick={() => switchMode("text")}
              disabled={status !== "idle" && status !== "ended"}
              className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[11px] font-bold uppercase tracking-wider transition-colors duration-200 ${
                (status !== "idle" && status !== "ended") ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              } ${mode === "text" ? "text-[var(--color-ivory)]" : "text-[var(--color-gray-brown)] hover:text-[var(--color-charcoal)]"}`}
            >
              <RiMessage3Line className="text-sm" />
              <span>Text</span>
            </button>
            <button
              onClick={() => switchMode("video")}
              disabled={status !== "idle" && status !== "ended"}
              className={`relative z-10 flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[11px] font-bold uppercase tracking-wider transition-colors duration-200 ${
                (status !== "idle" && status !== "ended") ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              } ${mode === "video" ? "text-[var(--color-ivory)]" : "text-[var(--color-gray-brown)] hover:text-[var(--color-charcoal)]"}`}
            >
              <RiVideoChatLine className="text-sm" />
              <span>Video</span>
            </button>
          </div>
        </div>

        {/* ── Right: Stats + Filter ── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Online count */}
          {onlineCount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-white/60 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-gray-brown)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#6B8A6A] animate-pulse" />
              {onlineCount.toLocaleString()}
            </div>
          )}

          {/* Timer (only while chatting) */}
          <AnimatePresence>
            {status === "chatting" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--color-border)] bg-white/60 text-[10px] font-bold uppercase tracking-widest tabular-nums"
                style={{ color: "var(--color-charcoal)" }}
              >
                <RiShieldCheckLine className="text-[#6B8A6A] text-xs" />
                {fmt(elapsed)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          <button
            onClick={() => setShowTags(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-white/60 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--color-charcoal)] hover:text-[var(--color-ivory)] hover:border-[var(--color-charcoal)] transition-all duration-200 shadow-sm group"
            style={{ color: "var(--color-gray-brown)" }}
          >
            <svg className="text-sm w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-300" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round"/>
            </svg>
            <span>Filter</span>
            {tags.length > 0 && (
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black" style={{ backgroundColor: "var(--color-peach)", color: "#fff" }}>
                {tags.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* TEXT MODE - Immersive View */}
        {mode === "text" && (
          <div className="flex w-full h-full max-w-5xl mx-auto p-4 md:p-8 relative">
            <div className="w-full h-full flex flex-col bg-white/40 backdrop-blur-2xl border border-[var(--color-border)] rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] overflow-hidden relative">
              
              {/* Text Room Header */}
              <div className="h-20 flex items-center justify-between px-8 border-b border-[var(--color-border)] bg-white/50">
                <div className="flex flex-col">
                  <h2 className="font-serif text-2xl text-[var(--color-charcoal)]">Text Studio</h2>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gray-brown)]">
                    {status === "idle" ? "Ready to connect" : status === "connecting" || status === "queued" ? "Seeking resonance..." : status === "chatting" ? `Encrypted tunnel active • ${fmt(elapsed)}` : "Connection terminated"}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {status === "idle" || status === "ended" ? (
                    <button onClick={startSearch} className="btn-primary py-2 px-6 shadow-sm">Begin</button>
                  ) : status === "connecting" || status === "queued" ? (
                    <button onClick={stopSearch} className="btn-secondary py-2 px-6">Abort</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={skip} className="btn-secondary py-2 px-4 shadow-sm"><RiSkipForwardLine className="text-xl" /></button>
                      <button onClick={endCall} className="btn-secondary py-2 px-4 text-[#D4916A] hover:bg-[#D4916A]/10 border-[#D4916A]/20 shadow-sm"><RiCloseCircleLine className="text-xl" /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Stream */}
              <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 relative">
                {status === "idle" || status === "ended" ? (
                  <div className="m-auto text-center opacity-50 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full border border-dashed border-[var(--color-charcoal)] flex items-center justify-center mb-6">
                      <RiMessage3Line className="text-4xl text-[var(--color-charcoal)]" />
                    </div>
                    <p className="font-serif text-3xl italic">Silence fills the room.</p>
                  </div>
                ) : status === "connecting" || status === "queued" ? (
                  <div className="m-auto flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full border border-[var(--color-border)] flex items-center justify-center mb-8 relative">
                      <motion.div animate={{ scale: [1, 2], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }} className="absolute inset-0 rounded-full border border-[var(--color-charcoal)]" />
                      <div className="w-3 h-3 rounded-full bg-[var(--color-charcoal)] animate-pulse" />
                    </div>
                    <p className="font-serif text-3xl italic">Seeking resonance...</p>
                    {status === "queued" && <p className="text-sm mt-4 text-[var(--color-gray-brown)] bg-[var(--color-parchment)] px-4 py-1 rounded-full border border-[var(--color-border)]">Queue Position: {queuePosition}</p>}
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {msgs.map(m => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={`group max-w-[80%] sm:max-w-[70%] flex flex-col ${
                          m.from === "system" ? "self-center items-center my-6"
                          : m.from === "me" ? "self-end items-end"
                          : "self-start items-start"
                        }`}
                      >
                        {/* Label */}
                        {m.from !== "system" && (
                          <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gray-light)] mb-1.5 px-2">
                            {m.from === "me" ? (myName || "You") : partnerName}
                          </span>
                        )}

                        {/* Bubble + Reply button row */}
                        {m.from !== "system" ? (
                          <div className={`flex items-end gap-1.5 ${m.from === "me" ? "flex-row-reverse" : "flex-row"}`}>
                            {/* Bubble */}
                            <div className={`flex flex-col overflow-hidden ${
                              m.from === "me"
                                ? "bg-gradient-to-br from-[var(--color-charcoal)] to-[var(--color-charcoal-80)] text-[var(--color-ivory)] rounded-[20px_20px_5px_20px] shadow-[0_4px_12px_rgba(46,39,36,0.15)]"
                                : "bg-white text-[var(--color-charcoal)] border border-[var(--color-border)] rounded-[20px_20px_20px_5px] shadow-[0_4px_12px_rgba(0,0,0,0.03)]"
                            }`}>
                              {/* Reply quote */}
                              {m.replyTo && (
                                <div className={`px-3 pt-2.5 pb-1.5 text-xs leading-snug border-b ${
                                  m.from === "me"
                                    ? "border-white/10 text-[var(--color-ivory)]/60"
                                    : "border-[var(--color-border)] text-[var(--color-gray-brown)]"
                                }`}>
                                  <div className={`flex items-center gap-1 mb-0.5 font-bold text-[9px] uppercase tracking-widest opacity-60`}>
                                    <div className={`w-0.5 h-3 rounded-full ${
                                      m.from === "me" ? "bg-[var(--color-ivory)]/50" : "bg-[var(--color-charcoal)]/30"
                                    }`} />
                                    {m.replyTo.from === "me" ? (myName || "You") : partnerName}
                                  </div>
                                  <p className="line-clamp-2 opacity-70">{m.replyTo.text}</p>
                                </div>
                              )}
                              <p className="px-5 py-3 text-[14px] sm:text-[15px] leading-relaxed">{m.text}</p>
                            </div>

                            {/* Reply action button */}
                            <motion.button
                              title="Reply"
                              onClick={() => setReplyingTo(m)}
                              initial={{ opacity: 0, scale: 0.8 }}
                              whileHover={{ scale: 1.1 }}
                              className={`opacity-0 group-hover:opacity-100 focus:opacity-100 active:opacity-100 transition-opacity shrink-0 w-7 h-7 rounded-full border border-[var(--color-border)] bg-white shadow-sm flex items-center justify-center text-[var(--color-gray-brown)] hover:text-[var(--color-charcoal)] hover:bg-[var(--color-beige)] mb-1`}
                            >
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 4L2 8l4 4M2 8h8a4 4 0 0 1 4 4v1" />
                              </svg>
                            </motion.button>
                          </div>
                        ) : (
                          <div className="bg-[var(--color-beige)] text-[var(--color-gray-brown)] text-[10px] uppercase tracking-widest font-bold rounded-full border border-[var(--color-border)] px-5 py-2">
                            {m.text}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                <div ref={endRef} />
              </div>

              {/* Input Area */}
              <div className="flex-none pb-[env(safe-area-inset-bottom)] bg-white/60 border-t border-[var(--color-border)] backdrop-blur-md">
                {/* Replying-to bar */}
                <AnimatePresence>
                  {replyingTo && (
                    <motion.div
                      ref={replyBarRef}
                      key="reply-bar"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="flex items-center gap-3 px-4 sm:px-6 pt-3 pb-1"
                    >
                      <div className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--color-parchment)] border border-[var(--color-border)] min-w-0">
                        <div className="w-0.5 h-8 rounded-full bg-[var(--color-charcoal)] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-widest font-bold text-[var(--color-gray-brown)] mb-0.5">
                            Replying to {replyingTo.from === "me" ? (myName || "you") : partnerName}
                          </p>
                          <p className="text-xs text-[var(--color-charcoal)] truncate">{replyingTo.text}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-beige)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-gray-light)] hover:text-[var(--color-charcoal)] transition-colors"
                      >
                        <RiCloseCircleLine className="text-sm" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="max-w-4xl mx-auto space-y-2 p-3 sm:p-4 md:p-5">

                  {/* Hate-speech preview overlay — only shown when something is typed */}
                  <AnimatePresence>
                    {draft.trim() && (() => {
                      const { flagged, words } = detectHateSpeech(draft);
                      return flagged ? (
                        <motion.div
                          key="hate-warning"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-start gap-3 px-4 py-3 rounded-2xl border"
                          style={{ backgroundColor: "rgba(220,38,38,0.06)", borderColor: "rgba(220,38,38,0.2)" }}
                        >
                          <RiAlertFill className="text-red-500 text-lg shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-red-500 mb-1">Message blocked — hate speech detected</p>
                            <p className="text-sm break-words leading-snug" style={{ color: "var(--color-charcoal)" }}>
                              <DraftPreview text={draft} flaggedWords={words} />
                            </p>
                          </div>
                        </motion.div>
                      ) : null;
                    })()}
                  </AnimatePresence>

                  {/* Input row */}
                  {(() => {
                    const { flagged, words } = detectHateSpeech(draft);
                    const blocked = flagged;
                    return (
                      <div className={`bg-white border rounded-2xl flex items-center px-4 py-2 shadow-sm transition-all ${
                        blocked
                          ? "border-red-300 ring-2 ring-red-200"
                          : "border-[var(--color-border)] focus-within:ring-2 ring-[var(--color-charcoal)]/10"
                      }`}>
                        <input
                          disabled={status !== "chatting"}
                          className="flex-1 bg-transparent border-none outline-none py-3 px-2 text-[15px] placeholder-[var(--color-gray-light)] disabled:opacity-50"
                          placeholder={status === "chatting" ? "Write your message here..." : "The room is closed."}
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (!blocked) send();
                            }
                          }}
                        />
                        <motion.button
                          whileTap={!blocked && draft.trim() && status === "chatting" ? { scale: 0.9 } : {}}
                          disabled={!draft.trim() || status !== "chatting" || blocked}
                          onClick={() => { if (!blocked) send(); }}
                          title={blocked ? "Remove hateful language to send" : "Send"}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-md ${
                            blocked
                              ? "bg-red-100 cursor-not-allowed"
                              : !draft.trim() || status !== "chatting"
                                ? "bg-[var(--color-gray-brown)] opacity-40 cursor-not-allowed"
                                : "bg-[var(--color-charcoal)] hover:scale-105 active:scale-95"
                          }`}
                        >
                          {blocked
                            ? <RiShieldCheckLine className="text-xl text-red-500" />
                            : <RiSendPlaneFill className="text-xl ml-1 text-[var(--color-ivory)]" />
                          }
                        </motion.button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIDEO MODE - Immersive View */}
        {mode === "video" && (
          <div className="relative w-full h-full bg-[#111] overflow-hidden">
            {/* Remote Video Background */}
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {isSearching ? (
                  <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-charcoal)] text-[var(--color-ivory)]">
                    <div className="w-32 h-32 border border-[var(--color-gray-brown)] rounded-full flex items-center justify-center relative mb-8">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border border-t-[var(--color-ivory)] border-r-transparent border-b-transparent border-l-transparent rounded-full" />
                      <RiSearchEyeLine className="text-4xl text-[var(--color-gray-light)]" />
                    </div>
                    <h2 className="font-serif text-3xl mb-2">Connecting</h2>
                    <p className="text-sm text-[var(--color-gray-light)] tracking-widest uppercase">Global Network</p>
                  </motion.div>
                ) : status === "chatting" ? (
                  <motion.video key="chatting" ref={remoteVideoRef} autoPlay playsInline initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`w-full h-full object-cover transition-all duration-1000 ${isRemoteNsfw ? "blur-[80px] grayscale" : ""}`} />
                ) : (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-charcoal)] text-[var(--color-ivory)]">
                    <RiVideoChatLine className="text-6xl text-[var(--color-gray-brown)] mb-6 opacity-50" />
                    <h2 className="font-serif text-4xl mb-2 text-white">Video Room</h2>
                    <p className="text-sm text-[var(--color-gray-light)]">Press start to open your camera.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* NSFW Shield for Remote */}
            <AnimatePresence>
              {status === "chatting" && isRemoteNsfw && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/40 backdrop-blur-sm">
                  <RiAlertFill className="text-6xl text-[#D4916A] mb-4" />
                  <h3 className="font-serif text-3xl text-white mb-2">Feed Obscured</h3>
                  <p className="text-white/60">Explicit content detected.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Local Video PIP */}
            <motion.div 
              ref={pipContainerRef} drag dragElastic={0.1} dragConstraints={pipContainerRef.current ? { left: 0, right: window.innerWidth - 200, top: 0, bottom: window.innerHeight - 300 } : { left: 0, right: 0, top: 0, bottom: 0 }}
              className="absolute top-8 right-8 w-36 h-48 md:w-48 md:h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/20 z-30 cursor-grab active:cursor-grabbing"
            >
              <div className="absolute inset-0 bg-[var(--color-charcoal)]" />
              <video ref={localVideoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover transition-opacity ${camOn && !isLocalNsfw ? "opacity-100" : "opacity-0"}`} />
              
              {(!camOn || isLocalNsfw) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[var(--color-charcoal)]">
                  {isLocalNsfw ? <RiAlertFill className="text-3xl text-[#D4916A] mb-2" /> : <RiCameraOffLine className="text-3xl text-[var(--color-gray-brown)] mb-2" />}
                  <span className="text-[9px] uppercase tracking-widest font-bold text-[var(--color-gray-light)]">{isLocalNsfw ? "NSFW Block" : "Camera Off"}</span>
                </div>
              )}
            </motion.div>

            {/* Controls Dock */}
            <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-white/10 backdrop-blur-xl p-2 sm:p-3 rounded-full border border-white/20 shadow-2xl z-40">
              <ControlButton icon={micOn ? RiMicLine : RiMicOffLine} onClick={() => setMicOn(!micOn)} danger={!micOn} label="Toggle Mic" />
              <ControlButton icon={camOn ? RiCameraLine : RiCameraOffLine} onClick={() => setCamOn(!camOn)} danger={!camOn} label="Toggle Cam" />
              
              <div className="w-px h-6 sm:h-8 bg-white/20 mx-1 sm:mx-2" />
              
              {status === "idle" || status === "ended" ? (
                <button onClick={startSearch} className="bg-white text-[var(--color-charcoal)] px-5 sm:px-8 py-2 sm:py-3 rounded-full font-bold text-xs sm:text-sm hover:scale-105 transition-transform shadow-lg">Start</button>
              ) : status === "connecting" || status === "queued" ? (
                <button onClick={stopSearch} className="bg-white/20 text-white px-5 sm:px-8 py-2 sm:py-3 rounded-full font-bold text-xs sm:text-sm hover:bg-white/30 transition-colors">Cancel</button>
              ) : (
                <>
                  <button onClick={skip} className="bg-white text-[var(--color-charcoal)] px-5 sm:px-8 py-2 sm:py-3 rounded-full font-bold text-xs sm:text-sm hover:scale-105 transition-transform shadow-lg">Skip</button>
                  <ControlButton icon={RiCloseCircleLine} onClick={endCall} danger={true} label="End Call" />
                  <div className="relative">
                    <ControlButton icon={RiFlag2Line} onClick={() => setShowReport(r => !r)} label="Report" />
                    <AnimatePresence>
                      {showReport && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-48 bg-[var(--color-charcoal)] rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
                          <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-[var(--color-gray-light)] border-b border-white/10">Report</div>
                          {REPORT_REASONS.map(r => <button key={r} onClick={() => reportUser(r)} className="w-full text-left px-4 py-3 text-sm text-[var(--color-ivory)] hover:bg-white/10 transition-colors">{r}</button>)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {/* Chat Sidebar Toggle */}
              {status === "chatting" && (
                <ControlButton icon={RiChat1Line} onClick={() => setShowVideoChat(!showVideoChat)} active={showVideoChat} label="Text Chat" />
              )}
            </div>

            {/* Sliding Chat Sidebar for Video */}
            <AnimatePresence>
              {status === "chatting" && showVideoChat && (
                <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="absolute top-0 bottom-0 left-0 w-80 bg-[var(--color-ivory)] shadow-2xl z-20 flex flex-col border-r border-[var(--color-border)]">
                  <div className="h-20 flex items-center justify-between px-6 border-b border-[var(--color-border)]">
                    <h3 className="font-serif text-lg">Messages</h3>
                    <button onClick={() => setShowVideoChat(false)} className="text-[var(--color-gray-brown)] hover:text-[var(--color-charcoal)]"><RiCloseCircleLine className="text-2xl" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                     {msgs.map(m => (
                      <div key={m.id} className={`max-w-[85%] px-4 py-2 text-sm rounded-2xl ${m.from === "system" ? "self-center text-[9px] uppercase tracking-widest text-[var(--color-gray-light)]" : m.from === "me" ? "self-end bg-[var(--color-charcoal)] text-[var(--color-ivory)] rounded-tr-sm" : "self-start bg-[var(--color-parchment)] text-[var(--color-charcoal)] border border-[var(--color-border)] rounded-tl-sm"}`}>
                        {m.text}
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>
                  <div className="p-4 border-t border-[var(--color-border)] bg-white">
                     <div className="flex bg-[var(--color-parchment)] border border-[var(--color-border)] rounded-xl p-1">
                       <input className="flex-1 bg-transparent border-none outline-none px-3 text-sm" placeholder="Message..." value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                       <button onClick={send} disabled={!draft.trim()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-charcoal)] text-[var(--color-ivory)] disabled:opacity-30"><RiSendPlaneFill/></button>
                     </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </main>

      {/* Filters Modal */}
      <AnimatePresence>
        {showTags && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={(e) => e.target === e.currentTarget && (setShowTags(false), setFilterSearch(""))}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="bg-[var(--color-ivory)] w-full sm:max-w-xl sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88vh]"
            >
              {/* Modal Header */}
              <div className="px-8 pt-8 pb-6 border-b border-[var(--color-border)] bg-white">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h2 className="font-serif text-3xl" style={{ color: "var(--color-charcoal)" }}>Curate your feed</h2>
                    <p className="text-xs mt-1 tracking-wide" style={{ color: "var(--color-gray-light)" }}>Match with minds that share your vibe</p>
                  </div>
                  <button
                    onClick={() => { setShowTags(false); setFilterSearch(""); }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-charcoal)] hover:text-[var(--color-ivory)] hover:border-[var(--color-charcoal)] transition-all"
                    style={{ color: "var(--color-gray-light)" }}
                  >
                    <RiCloseCircleLine className="text-lg" />
                  </button>
                </div>
                {/* Search */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-parchment)] focus-within:border-[var(--color-charcoal)] transition-colors">
                  <svg className="w-4 h-4 shrink-0" style={{ color: "var(--color-gray-light)" }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="7" cy="7" r="4.5"/><path d="m11 11 2.5 2.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    placeholder="Search interests…"
                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder-[var(--color-gray-light)]"
                    style={{ color: "var(--color-charcoal)" }}
                  />
                  {filterSearch && (
                    <button onClick={() => setFilterSearch("")} className="text-[var(--color-gray-light)] hover:text-[var(--color-charcoal)] transition-colors">
                      <RiCloseCircleLine className="text-base" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category sections */}
              <div className="overflow-y-auto px-6 py-5 space-y-6">
                {(() => {
                  const q = filterSearch.toLowerCase().trim();
                  const filtered = INTEREST_CATEGORIES
                    .map(cat => ({ ...cat, items: cat.items.filter(t => t.toLowerCase().includes(q)) }))
                    .filter(cat => cat.items.length > 0);

                  if (filtered.length === 0) return (
                    <div className="py-12 text-center" style={{ color: "var(--color-gray-light)" }}>
                      <p className="text-4xl mb-3">🔍</p>
                      <p className="text-sm">No interests match <em>&ldquo;{filterSearch}&rdquo;</em></p>
                    </div>
                  );

                  return filtered.map(cat => (
                    <div key={cat.label}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "var(--color-gray-brown)" }}>{cat.label}</span>
                        <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cat.items.map(t => {
                          const active = tags.includes(t);
                          return (
                            <motion.button
                              key={t}
                              whileTap={{ scale: 0.92 }}
                              onClick={() => setTags(p => active ? p.filter(x => x !== t) : [...p, t])}
                              className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all border ${
                                active
                                  ? "border-[var(--color-charcoal)] shadow-md"
                                  : "bg-white border-[var(--color-border)] hover:border-[var(--color-gray-brown)] hover:shadow-sm"
                              }`}
                              style={active ? { backgroundColor: "var(--color-charcoal)", color: "var(--color-ivory)" } : { color: "var(--color-gray-brown)" }}
                            >
                              {t}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Footer */}
              <div className="px-6 py-5 border-t border-[var(--color-border)] bg-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {tags.length > 0 ? (
                    <>
                      <span className="text-xs font-bold" style={{ color: "var(--color-charcoal)" }}>{tags.length} selected</span>
                      <button onClick={() => setTags([])} className="text-xs font-semibold underline" style={{ color: "var(--color-gray-brown)", textUnderlineOffset: 3 }}>Clear all</button>
                    </>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--color-gray-light)" }}>No filters active — matching everyone</span>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { setShowTags(false); setFilterSearch(""); }}
                  className="px-7 py-2.5 text-sm font-bold rounded-2xl shadow-md transition-shadow hover:shadow-lg"
                  style={{ backgroundColor: "var(--color-charcoal)", color: "var(--color-ivory)" }}
                >
                  Apply
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Ended Popup ── */}
      <AnimatePresence>
        {showEndedPopup && (
          <motion.div
            key="ended-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center px-4"
            style={{ backgroundColor: "rgba(30,25,20,0.55)", backdropFilter: "blur(12px)" }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 32, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 32, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="relative w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.35)]"
              style={{ backgroundColor: "var(--color-warm-white)", border: "1px solid var(--color-border)" }}
            >
              {/* Decorative top band */}
              <div className="h-1.5 w-full bg-gradient-to-r from-[var(--color-charcoal)] via-[var(--color-gray-brown)] to-[var(--color-peach)]" />

              <div className="px-8 pt-8 pb-9 flex flex-col items-center text-center gap-5">

                {/* Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "var(--color-parchment)", border: "1px solid var(--color-border)" }}
                >
                  {endedBy === "them" ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-charcoal)" }}>
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-charcoal)" }}>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4l2.5 2.5" />
                    </svg>
                  )}
                </motion.div>

                {/* Copy */}
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--color-charcoal)" }}>
                    {endedBy === "them" ? "They slipped away" : "Connection closed"}
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-gray-brown)" }}>
                    {endedBy === "them"
                      ? `${partnerName} has left the room. Every connection is a small story.`
                      : "You ended this encounter. Another mind is waiting."}
                  </p>
                </div>

                {/* Session duration badge */}
                {sessionDurationRef.current > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest"
                    style={{ backgroundColor: "var(--color-beige)", border: "1px solid var(--color-border)", color: "var(--color-gray-brown)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l3 3" />
                    </svg>
                    {fmt(sessionDurationRef.current)} conversation
                  </motion.div>
                )}

                {/* Shared interests recap */}
                {sharedInterests.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-wrap justify-center gap-1.5"
                  >
                    {sharedInterests.map(i => (
                      <span key={i} className="px-3 py-1 rounded-full text-[10px] font-semibold" style={{ backgroundColor: "var(--color-parchment)", border: "1px solid var(--color-border)", color: "var(--color-charcoal)" }}>{i}</span>
                    ))}
                  </motion.div>
                )}

                {/* Actions */}
                <div className="w-full flex flex-col gap-2.5 pt-1">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={startSearch}
                    className="w-full py-4 rounded-2xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg"
                    style={{ backgroundColor: "var(--color-charcoal)", color: "var(--color-ivory)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    Find Next
                  </motion.button>
                  <button
                    onClick={() => setShowEndedPopup(false)}
                    className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-colors"
                    style={{ color: "var(--color-gray-brown)", border: "1px solid var(--color-border)" }}
                  >
                    Stay here
                  </button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function ChatLoadingFallback() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-[var(--color-ivory)]">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <h1 className="font-serif text-3xl text-[var(--color-charcoal)] italic m-0">Conexion</h1>
          <span className="text-[10px] font-sans font-bold uppercase tracking-widest bg-[var(--color-olive)]/20 text-[var(--color-olive)] px-2 py-0.5 rounded-full mt-1">
            Beta
          </span>
        </div>
        <div className="w-12 h-px bg-[var(--color-border)] mx-auto mb-4" />
        <div className="text-[9px] uppercase tracking-[0.3em] font-bold text-[var(--color-gray-light)] animate-pulse">Initializing</div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoadingFallback />}>
      <ChatApp />
    </Suspense>
  );
}
