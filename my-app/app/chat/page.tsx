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
const INTERESTS = ["Art", "Philosophy", "Cinema", "Design", "Music", "Literature", "Tech", "Science", "Travel"];
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/stats', '') || "http://localhost:3001";

type Status = "idle" | "connecting" | "queued" | "chatting" | "ended";
type ChatMode = "text" | "video";
interface Msg { id: string; from: "me" | "them" | "system"; text: string; ts?: number; }

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

  const [status, setStatus] = useState<Status>("idle");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
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
    fetch(`${API_BASE}/api/turn-credentials`).then(res => res.json()).then(data => { if (data.iceServers?.length) setIceServers(data.iceServers); }).catch(() => {});
  }, []);

  const wsSend = (payload: object) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload)); };

  const setupWebRTC = useCallback((role: "caller" | "callee") => {
    if (pcRef.current) pcRef.current.close();
    const pc = new RTCPeerConnection({ iceServers });
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
    setWsError(false); const ws = new WebSocket(WS_URL); wsRef.current = ws;
    ws.onopen = () => { setWsError(false); setIsReconnecting(false); reconnectAttemptRef.current = 0; pingRef.current = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" })); }, 25000); };
    ws.onmessage = async (ev) => {
      let msg: any; try { msg = JSON.parse(ev.data); } catch { return; }
      switch (msg.type) {
        case "online_count": setOnlineCount(msg.count); break;
        case "queued": setStatus("queued"); setQueuePosition(msg.position); break;
        case "matched":
          setSharedInterests(msg.sharedInterests ?? []); setStatus("chatting"); setElapsed(0);
          setMsgs([{ id: crypto.randomUUID(), from: "system", text: (msg.sharedInterests ?? []).length > 0 ? `Matched! Shared interests: ${(msg.sharedInterests ?? []).join(", ")}` : "A new connection has been established." }]);
          if (mode === "video") setupWebRTC(msg.role);
          break;
        case "message": setMsgs(m => [...m, { id: crypto.randomUUID(), from: "them", text: msg.text }]); break;
        case "rtc_signal":
          if (!pcRef.current) break;
          try {
            if (msg.payload.offer) { await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.payload.offer)); const ans = await pcRef.current.createAnswer(); await pcRef.current.setLocalDescription(ans); wsSend({ type: "rtc_signal", payload: { answer: pcRef.current.localDescription } }); }
            else if (msg.payload.answer) await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.payload.answer));
            else if (msg.payload.candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.payload.candidate));
          } catch (err) { console.error("RTC Error", err); }
          break;
        case "partner_left":
          setStatus("ended"); if (pcRef.current) pcRef.current.close(); if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
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
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "queue", interests: tags }));
    else ws.addEventListener("open", () => ws?.send(JSON.stringify({ type: "queue", interests: tags })), { once: true });
    setStatus("connecting"); setElapsed(0); setMsgs([]); setSharedInterests([]); setQueuePosition(null);
  };

  const stopSearch = () => { wsSend({ type: "cancel" }); setStatus("idle"); };
  const skip = () => { wsSend({ type: "skip" }); setStatus("connecting"); setElapsed(0); setMsgs([]); setShowReport(false); };
  const endCall = () => { wsSend({ type: "end" }); setStatus("ended"); setMsgs(m => [...m, sys("You closed the connection.")]); setShowReport(false); };
  
  const reportUser = (reason: string) => { wsSend({ type: "report", reason }); setMsgs(m => [...m, sys("User reported.")]); setShowReport(false); setTimeout(() => skip(), 800); };

  const send = () => { if (!draft.trim() || status !== "chatting") return; wsSend({ type: "message", text: draft.trim() }); setMsgs(m => [...m, { id: crypto.randomUUID(), from: "me", text: draft.trim() }]); setDraft(""); };

  const switchMode = (m: ChatMode) => { if (status === "chatting" || status === "connecting" || status === "queued") return; setMode(m); setStatus("idle"); setMsgs([]); };
  const isSearching = status === "connecting" || status === "queued";

  /* ───────────────────────── RENDERING ───────────────────────── */
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[var(--color-ivory)] text-[var(--color-charcoal)] font-sans">
      <ParticleBackground />

      {/* Reconnection Banner */}
      <AnimatePresence>
        {isReconnecting && (
          <motion.div initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }} className="fixed top-0 inset-x-0 z-[100] bg-[var(--color-charcoal)] text-[var(--color-ivory)] py-2 text-center text-xs tracking-widest uppercase font-bold flex justify-center items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[var(--color-ivory)] animate-ping" /> Reconnecting...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex-none h-20 px-6 md:px-12 flex items-center justify-between border-b border-[var(--color-border)] bg-white/40 backdrop-blur-md relative z-40">
        <div className="flex items-center gap-6">
          <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--color-beige)] text-[var(--color-charcoal)] hover:bg-[var(--color-charcoal)] hover:text-[var(--color-ivory)] transition-colors">
            <RiArrowLeftLine className="text-xl" />
          </Link>
          <span className="font-serif text-xl font-bold tracking-tight hidden sm:block">Conexion</span>
        </div>

        {/* Central Mode Toggle */}
        <div className="flex items-center bg-[var(--color-parchment)] p-1 rounded-full border border-[var(--color-border)]">
          <button onClick={() => switchMode("text")} disabled={status !== "idle" && status !== "ended"} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${(status !== "idle" && status !== "ended") ? "opacity-50" : ""} ${mode === "text" ? "bg-[var(--color-charcoal)] text-[var(--color-ivory)] shadow-md" : "text-[var(--color-gray-brown)] hover:text-[var(--color-charcoal)]"}`}>
            Text
          </button>
          <button onClick={() => switchMode("video")} disabled={status !== "idle" && status !== "ended"} className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${(status !== "idle" && status !== "ended") ? "opacity-50" : ""} ${mode === "video" ? "bg-[var(--color-charcoal)] text-[var(--color-ivory)] shadow-md" : "text-[var(--color-gray-brown)] hover:text-[var(--color-charcoal)]"}`}>
            Video
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setShowTags(true)} className="text-xs font-bold uppercase tracking-wider text-[var(--color-gray-brown)] hover:text-[var(--color-charcoal)] transition-colors flex items-center gap-2 bg-[var(--color-parchment)] px-4 py-2 rounded-full border border-[var(--color-border)]">
            Filters {tags.length > 0 && <span className="bg-[var(--color-peach)] text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px]">{tags.length}</span>}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* TEXT MODE - Split View */}
        {mode === "text" && (
          <div className="flex w-full max-w-7xl mx-auto p-4 md:p-8 gap-8">
            
            {/* Left Column: Status & Controls */}
            <div className="w-80 flex-none hidden md:flex flex-col gap-6">
              <div className="warm-panel p-8 h-full flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-3xl mb-2">Session</h3>
                  <p className="text-[var(--color-gray-brown)] text-sm mb-8 leading-relaxed">
                    {status === "idle" ? "Ready to begin." : status === "connecting" || status === "queued" ? "Establishing connection across the network." : status === "chatting" ? "Encrypted tunnel active." : "Connection terminated."}
                  </p>
                  
                  {status === "chatting" && (
                    <div className="mb-8">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gray-light)] mb-2">Duration</div>
                      <div className="text-4xl font-light font-mono">{fmt(elapsed)}</div>
                    </div>
                  )}

                  {tags.length > 0 && (
                    <div className="mb-8">
                      <div className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gray-light)] mb-2">Active Filters</div>
                      <div className="flex flex-wrap gap-2">
                        {tags.map(t => <span key={t} className="text-xs px-3 py-1 bg-[var(--color-beige)] rounded-full text-[var(--color-charcoal)]">{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                {status === "idle" || status === "ended" ? (
                  <button onClick={startSearch} className="w-full btn-primary py-4 text-base">Begin Encounter</button>
                ) : status === "connecting" || status === "queued" ? (
                  <button onClick={stopSearch} className="w-full py-4 rounded-xl border border-[var(--color-border)] text-[var(--color-charcoal)] font-semibold hover:bg-[var(--color-beige)] transition-colors">Abort Search</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={skip} className="flex-1 py-3 rounded-xl bg-[var(--color-charcoal)] text-[var(--color-ivory)] font-semibold text-sm hover:bg-[var(--color-charcoal-80)] transition-colors">Skip</button>
                    <button onClick={endCall} className="flex-none px-4 rounded-xl border border-[var(--color-border)] text-[#D4916A] hover:bg-[#D4916A]/10 transition-colors"><RiCloseCircleLine className="text-xl" /></button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Chat Stream */}
            <div className="flex-1 warm-panel overflow-hidden flex flex-col shadow-sm">
              <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col gap-6 scroll-smooth">
                {status === "idle" || status === "ended" ? (
                  <div className="m-auto text-center opacity-50">
                    <RiMessage3Line className="text-6xl mx-auto mb-4 text-[var(--color-gray-light)]" />
                    <p className="font-serif text-2xl italic">Silence fills the room.</p>
                  </div>
                ) : status === "connecting" || status === "queued" ? (
                  <div className="m-auto flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full border border-[var(--color-border)] flex items-center justify-center mb-6 relative">
                      <motion.div animate={{ scale: [1, 1.5], opacity: [1, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 rounded-full border border-[var(--color-charcoal)]" />
                      <div className="w-2 h-2 rounded-full bg-[var(--color-charcoal)] animate-pulse" />
                    </div>
                    <p className="font-serif text-2xl italic">Seeking resonance...</p>
                    {status === "queued" && <p className="text-sm mt-2 text-[var(--color-gray-brown)]">Queue: {queuePosition}</p>}
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {msgs.map(m => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[80%] flex flex-col ${m.from === "system" ? "self-center items-center my-4" : m.from === "me" ? "self-end items-end" : "self-start items-start"}`}>
                        {m.from !== "system" && <span className="text-[9px] uppercase tracking-widest text-[var(--color-gray-light)] mb-1.5 px-2">{m.from === "me" ? "You" : "Stranger"}</span>}
                        <div className={`px-6 py-3.5 text-[15px] leading-relaxed shadow-sm ${m.from === "system" ? "bg-[var(--color-parchment)] text-[var(--color-gray-brown)] text-xs uppercase tracking-wider font-bold rounded-full border border-[var(--color-border)]" : m.from === "me" ? "bg-[var(--color-charcoal)] text-[var(--color-ivory)] rounded-[20px_20px_4px_20px]" : "bg-white text-[var(--color-charcoal)] border border-[var(--color-border)] rounded-[20px_20px_20px_4px]"}`}>
                          {m.text}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                <div ref={endRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 md:p-6 bg-white/50 border-t border-[var(--color-border)] flex items-end gap-3 relative">
                
                {/* Mobile controls */}
                <div className="md:hidden absolute -top-14 left-0 right-0 flex justify-center gap-2 px-4 pointer-events-none">
                  {status === "idle" || status === "ended" ? (
                    <button onClick={startSearch} className="pointer-events-auto bg-[var(--color-charcoal)] text-[var(--color-ivory)] px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">Start</button>
                  ) : status === "connecting" || status === "queued" ? (
                     <button onClick={stopSearch} className="pointer-events-auto bg-white border border-[var(--color-border)] text-[var(--color-charcoal)] px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">Cancel</button>
                  ) : (
                    <>
                      <button onClick={skip} className="pointer-events-auto bg-white border border-[var(--color-border)] text-[var(--color-charcoal)] px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">Skip</button>
                      <button onClick={endCall} className="pointer-events-auto bg-white border border-[var(--color-border)] text-[#D4916A] px-4 py-2 rounded-full shadow-lg"><RiCloseCircleLine/></button>
                    </>
                  )}
                </div>

                <div className="flex-1 bg-white border border-[var(--color-border)] rounded-2xl flex items-center px-4 py-1 focus-within:ring-2 ring-[var(--color-beige)] transition-shadow">
                  <input
                    disabled={status !== "chatting"}
                    className="flex-1 bg-transparent border-none outline-none py-3 text-[15px] placeholder-[var(--color-gray-light)] disabled:opacity-50"
                    placeholder={status === "chatting" ? "Write a message..." : "Waiting for connection..."}
                    value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  />
                  <button disabled={!draft.trim() || status !== "chatting"} onClick={send} className="w-10 h-10 rounded-xl bg-[var(--color-charcoal)] text-[var(--color-ivory)] flex items-center justify-center disabled:opacity-30 disabled:bg-[var(--color-gray-light)] transition-all">
                    <RiSendPlaneFill className="ml-0.5" />
                  </button>
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
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-xl p-3 rounded-full border border-white/20 shadow-2xl z-40">
              <ControlButton icon={micOn ? RiMicLine : RiMicOffLine} onClick={() => setMicOn(!micOn)} danger={!micOn} label="Toggle Mic" />
              <ControlButton icon={camOn ? RiCameraLine : RiCameraOffLine} onClick={() => setCamOn(!camOn)} danger={!camOn} label="Toggle Cam" />
              
              <div className="w-px h-8 bg-white/20 mx-2" />
              
              {status === "idle" || status === "ended" ? (
                <button onClick={startSearch} className="bg-white text-[var(--color-charcoal)] px-8 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg">Start</button>
              ) : status === "connecting" || status === "queued" ? (
                <button onClick={stopSearch} className="bg-white/20 text-white px-8 py-3 rounded-full font-bold text-sm hover:bg-white/30 transition-colors">Cancel</button>
              ) : (
                <>
                  <button onClick={skip} className="bg-white text-[var(--color-charcoal)] px-8 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform shadow-lg">Skip</button>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowTags(false)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-[var(--color-ivory)] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-8 border-b border-[var(--color-border)] flex justify-between items-center bg-white">
                <h2 className="font-serif text-3xl">Filter Interests</h2>
                <button onClick={() => setShowTags(false)} className="text-[var(--color-gray-light)] hover:text-[var(--color-charcoal)] transition-colors"><RiCloseCircleLine className="text-3xl" /></button>
              </div>
              <div className="p-8 overflow-y-auto">
                <p className="text-[var(--color-gray-brown)] mb-6 text-sm">Select topics to curate your connections. We will prioritize matching you with minds that share these aesthetics.</p>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map(t => {
                    const active = tags.includes(t);
                    return (
                      <button key={t} onClick={() => setTags(p => active ? p.filter(x => x !== t) : [...p, t])} className={`px-5 py-2 rounded-full text-sm font-medium transition-all border ${active ? "bg-[var(--color-charcoal)] text-[var(--color-ivory)] border-[var(--color-charcoal)] shadow-md scale-105" : "bg-white text-[var(--color-gray-brown)] border-[var(--color-border)] hover:border-[var(--color-gray-brown)]"}`}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="p-6 border-t border-[var(--color-border)] bg-white flex justify-end gap-3">
                <button onClick={() => setTags([])} className="px-6 py-2 text-sm font-semibold text-[var(--color-gray-brown)] hover:text-[var(--color-charcoal)]">Clear</button>
                <button onClick={() => setShowTags(false)} className="px-8 py-2 text-sm font-semibold bg-[var(--color-charcoal)] text-[var(--color-ivory)] rounded-full hover:shadow-lg transition-shadow">Save Configuration</button>
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
        <h1 className="font-serif text-3xl text-[var(--color-charcoal)] mb-4 italic">Conexion</h1>
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
