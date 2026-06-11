"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ParticleBackground from "../components/ParticleBackground";
import { RiMessage3Line, RiVideoChatLine, RiMicLine, RiMicOffLine, RiCameraLine, RiCameraOffLine, RiSendPlaneFill, RiSkipForwardLine, RiCloseCircleLine, RiSearchEyeLine } from "react-icons/ri";

type Status = "idle" | "connecting" | "queued" | "chatting" | "ended";
type ChatMode = "text" | "video";
interface Msg { id: string; from: "me" | "them" | "system"; text: string; ts?: number; }

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";

const INTERESTS = [
  "Music","Gaming","Travel","Art","Tech","Movies",
  "Sports","Books","Anime","Food","Science","Fitness",
];

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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

  const endRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, mode]);

  // Timer
  useEffect(() => {
    if (status === "chatting") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // Webcam access
  useEffect(() => {
    if (mode === "video") {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.warn("Camera permissions denied or not available:", err);
          setCamOn(false);
          setMicOn(false);
        });
    } else {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        setLocalStream(null);
      }
    }
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [mode]);

  // Toggle tracks
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = camOn);
      localStream.getAudioTracks().forEach(t => t.enabled = micOn);
    }
  }, [camOn, micOn, localStream]);

  const connectWS = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return wsRef.current;
    }

    setWsError(false);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsError(false);
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 25000);
    };

    ws.onmessage = (ev) => {
      let msg: { type: string; [k: string]: unknown };
      try { msg = JSON.parse(ev.data); } catch { return; }

      switch (msg.type) {
        case "online_count":
          setOnlineCount(msg.count as number);
          break;
        case "queued":
          setStatus("queued");
          setQueuePosition(msg.position as number);
          break;
        case "matched": {
          const shared = (msg.sharedInterests as string[]) ?? [];
          setSharedInterests(shared);
          setStatus("chatting");
          setElapsed(0);
          setMsgs([{
            id: crypto.randomUUID(),
            from: "system",
            text: shared.length > 0
              ? `Matched! You both like: ${shared.join(", ")} 🎉`
              : "Connected to a stranger. Say hello! 👋",
          }]);
          break;
        }
        case "message":
          setMsgs(m => [...m, { id: crypto.randomUUID(), from: "them", text: msg.text as string, ts: msg.ts as number }]);
          break;
        case "partner_left":
          setStatus("ended");
          setMsgs(m => [...m, { id: crypto.randomUUID(), from: "system", text: "Stranger has disconnected." }]);
          break;
      }
    };
    ws.onerror = () => setWsError(true);
    ws.onclose = () => {
      if (pingRef.current) clearInterval(pingRef.current);
      setWsError(true);
    };
    return ws;
  }, []);

  useEffect(() => {
    const ws = connectWS();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      ws?.close();
    };
  }, [connectWS]);

  const wsSend = (payload: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  };

  const sys = (text: string): Msg => ({ id: crypto.randomUUID(), from: "system", text });

  const startSearch = () => {
    let ws = wsRef.current;
    if (!ws || ws.readyState > WebSocket.OPEN) {
      ws = connectWS();
    }
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "queue", interests: tags }));
    } else {
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ type: "queue", interests: tags }));
      }, { once: true });
    }
    
    setStatus("connecting");
    setElapsed(0);
    setMsgs([]);
    setSharedInterests([]);
    setQueuePosition(null);
  };

  const stopSearch = () => { wsSend({ type: "cancel" }); setStatus("idle"); setElapsed(0); setMsgs([]); setQueuePosition(null); };
  const skip = () => { wsSend({ type: "skip" }); setStatus("connecting"); setElapsed(0); setMsgs([]); setSharedInterests([]); setQueuePosition(null); };
  const endCall = () => { wsSend({ type: "end" }); setStatus("ended"); setMsgs(m => [...m, sys("You disconnected.")]); };

  const send = () => {
    if (!draft.trim() || status !== "chatting") return;
    wsSend({ type: "message", text: draft.trim() });
    setMsgs(m => [...m, { id: crypto.randomUUID(), from: "me", text: draft.trim() }]);
    setDraft("");
  };

  const switchMode = (m: ChatMode) => { setMode(m); if (status !== "idle") { setStatus("idle"); setMsgs([]); setElapsed(0); } };
  const isSearching = status === "connecting" || status === "queued";

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center bg-[#07070e] text-white overflow-hidden">
      <ParticleBackground />
      {/* Ambient glows */}
      <div className="pointer-events-none fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-amber-500/5 blur-[120px] mix-blend-screen z-0"></div>
      <div className="pointer-events-none fixed bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-violet-500/5 blur-[140px] mix-blend-screen z-0"></div>

      {/* Nav */}
      <nav className="nav-bar">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-black tracking-tight text-white hover:opacity-80 transition-opacity">
            Cone<span className="text-amber-500">x</span>ion
          </Link>

          <div className="flex bg-white/[0.02] p-1.5 rounded-2xl shadow-xl backdrop-blur-md">
            <button
              onClick={() => switchMode("text")}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${mode === "text" ? "bg-white text-black shadow-[0_5px_15px_rgba(255,255,255,0.2)]" : "text-white/40 hover:text-white"}`}
            >
              <RiMessage3Line className="text-lg" /> Text
            </button>
            <button
              onClick={() => switchMode("video")}
              className={`px-5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${mode === "video" ? "bg-white text-black shadow-[0_5px_15px_rgba(255,255,255,0.2)]" : "text-white/40 hover:text-white"}`}
            >
              <RiVideoChatLine className="text-lg" /> Video
            </button>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {status === "chatting" && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-[12px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              {fmt(elapsed)}
            </motion.div>
          )}
          {onlineCount > 0 && (
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
              {onlineCount} Online
            </div>
          )}
          <button className="btn-secondary text-[11px] uppercase tracking-widest px-5 py-2.5" onClick={() => setShowTags(true)}>
            Interests {tags.length > 0 && <span className="text-amber-500">({tags.length})</span>}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className={`flex-1 flex w-full h-full relative z-10 transition-all duration-700 ease-in-out ${mode === "text" ? "max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-8" : "max-w-none px-0 pt-0 pb-0"}`}>
        
        {/* TEXT CHAT */}
        {mode === "text" && (
          <div className="flex-1 flex flex-col max-w-3xl w-full min-h-[500px] h-full mx-auto glass-panel relative overflow-hidden">
            
            <AnimatePresence mode="wait">
              {(status === "idle" || status === "ended") && (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
                  className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
                >
                  <div className="w-24 h-24 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 shadow-[0_0_40px_rgba(245,158,11,0.2)] relative">
                    <RiMessage3Line className="text-5xl" />
                  </div>
                  <h2 className="text-4xl font-black mb-4 tracking-tight">{status === "ended" ? "Chat Ended" : "Start a Text Chat"}</h2>
                  <p className="text-white/40 text-lg mb-10 max-w-md leading-relaxed">
                    {tags.length > 0 ? `Matching by interests: ${tags.join(", ")}` : "Connect with a random stranger globally. Absolutely no traces left behind."}
                  </p>
                  <button className="btn-primary text-lg px-8 py-4" onClick={startSearch}>
                    <RiSearchEyeLine className="text-2xl" /> {status === "ended" ? "Find New Chat" : "Start Searching"}
                  </button>
                  {wsError && <p className="text-red-400 mt-6 text-sm font-semibold tracking-wide">Server connection lost. Retrying...</p>}
                </motion.div>
              )}

              {isSearching && (
                <motion.div 
                  key="searching"
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
                  className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
                >
                  <div className="relative w-40 h-40 flex items-center justify-center mb-10">
                    <motion.div animate={{ scale: [1, 3], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }} className="absolute inset-0 bg-amber-500 rounded-full" />
                    <motion.div animate={{ scale: [1, 3], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }} className="absolute inset-0 bg-amber-500 rounded-full" />
                    <div className="relative w-20 h-20 bg-black rounded-full flex items-center justify-center z-10 shadow-[0_0_50px_rgba(245,158,11,0.5)]">
                      <RiSearchEyeLine className="text-4xl text-amber-500" />
                    </div>
                  </div>
                  <h2 className="text-3xl font-black mb-3">{status === "queued" ? `Queue Position: ${queuePosition}` : "Scanning the globe..."}</h2>
                  <p className="text-white/40 text-lg mb-10">Finding the perfect match for you.</p>
                  <button className="btn-secondary px-8 py-3" onClick={stopSearch}>Cancel Search</button>
                </motion.div>
              )}

              {status === "chatting" && (
                <motion.div 
                  key="chatting"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col"
                >
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                    <AnimatePresence initial={false}>
                      {msgs.map(m => (
                        <motion.div 
                          key={m.id}
                          initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                          className={`max-w-[80%] p-4 px-6 rounded-3xl text-[16px] leading-relaxed shadow-lg ${
                            m.from === "system" 
                              ? "self-center bg-white/5 text-white/50 text-[11px] font-black uppercase tracking-widest rounded-full py-2.5 px-6 shadow-none" 
                              : m.from === "me" 
                                ? "self-end bg-amber-500 text-black font-semibold rounded-tr-sm" 
                                : "self-start bg-white/10 text-white font-medium rounded-tl-sm backdrop-blur-md"
                          }`}
                        >
                          {m.text}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <div ref={endRef} />
                  </div>
                  
                  <div className="p-4 bg-white/[0.01] backdrop-blur-3xl">
                    <div className="flex items-center gap-4 mb-4 px-2">
                      <button className="text-white/40 hover:text-amber-500 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition-colors" onClick={skip}>
                        <RiSkipForwardLine className="text-xl" /> Skip
                      </button>
                      <button className="text-white/40 hover:text-red-500 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition-colors" onClick={endCall}>
                        <RiCloseCircleLine className="text-xl" /> End
                      </button>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 p-2 pl-6 rounded-3xl focus-within:bg-white/10 transition-colors shadow-inner">
                      <input
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/30 text-[16px]"
                        placeholder="Type a message..."
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      />
                      <button 
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${draft.trim() ? "bg-amber-500 text-black hover:scale-105 shadow-[0_0_20px_rgba(245,158,11,0.4)]" : "bg-white/5 text-white/30 cursor-not-allowed"}`} 
                        onClick={send} 
                        disabled={!draft.trim()}
                      >
                        <RiSendPlaneFill className="text-xl ml-1" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* FULL-SCREEN IMMERSIVE VIDEO CHAT */}
        {mode === "video" && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 w-full h-full bg-[#040408] overflow-hidden flex flex-col"
          >
            {/* Cinematic Gradient Background overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#07070e]/80 via-transparent to-[#07070e] z-0 pointer-events-none" />

            {/* Massive Main Remote Feed Background */}
            <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
              <AnimatePresence mode="wait">
                {isSearching ? (
                  <motion.div key="searching-video" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl">
                    <div className="relative w-64 h-64 mb-10 flex items-center justify-center">
                      <motion.div animate={{ scale: [1, 2.5], opacity: [0.6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 0 }} className="absolute inset-0 border-[3px] border-amber-500 rounded-full" />
                      <motion.div animate={{ scale: [1, 2.5], opacity: [0.6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 1 }} className="absolute inset-0 border-[3px] border-amber-500 rounded-full" />
                      <motion.div animate={{ scale: [1, 2.5], opacity: [0.6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 2 }} className="absolute inset-0 border-[3px] border-amber-500 rounded-full" />
                      
                      <div className="relative w-28 h-28 bg-[#07070e] rounded-full shadow-[0_0_60px_rgba(245,158,11,0.5)] flex items-center justify-center z-10 border border-amber-500/30">
                        <RiSearchEyeLine className="text-5xl text-amber-500" />
                      </div>
                    </div>
                    <h2 className="text-4xl sm:text-5xl font-black mb-4 tracking-tighter text-white/90">Searching the grid...</h2>
                    <p className="text-white/50 text-xl font-medium tracking-wide">Connecting you to the perfect match.</p>
                  </motion.div>
                ) : status === "chatting" ? (
                  <motion.div key="chatting-video" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center w-full h-full">
                    <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-white/5 flex items-center justify-center shadow-[0_0_100px_rgba(255,255,255,0.05)] backdrop-blur-3xl border border-white/10">
                      <RiCameraLine className="text-[100px] text-white/10" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="waiting-video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center text-center">
                    <div className="w-32 h-32 rounded-3xl bg-white/[0.02] flex items-center justify-center mb-8 shadow-2xl border border-white/5">
                      <RiVideoChatLine className="text-6xl text-white/30" />
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter text-white/80 mb-2">{status === "ended" ? "Session Terminated" : "System Ready"}</h2>
                    <p className="text-white/40 text-lg uppercase tracking-widest font-bold">Awaiting connection</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Draggable PiP Local Feed */}
            <motion.div 
              drag
              dragConstraints={{ left: 20, right: 20, top: 120, bottom: 120 }}
              dragElastic={0.1}
              className="absolute top-28 right-6 w-40 h-56 sm:w-60 sm:h-80 bg-[#0a0a0f] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-30 border border-white/10 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
            >
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover transition-opacity duration-300 pointer-events-none ${camOn ? "opacity-100" : "opacity-0"}`} 
              />
              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 bg-[#07070e] pointer-events-none">
                  <RiCameraOffLine className="text-5xl mb-4 opacity-50" />
                  <span className="text-[11px] font-black tracking-widest uppercase">Cam Off</span>
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/80 border border-white/10 pointer-events-none">
                You
              </div>
            </motion.div>

            {/* Beautiful Integrated Chat Sidebar */}
            <AnimatePresence>
              {status === "chatting" && (
                <motion.div 
                  initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                  className="absolute left-6 top-28 bottom-32 w-72 sm:w-80 bg-black/40 backdrop-blur-3xl rounded-[32px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20 flex flex-col overflow-hidden"
                >
                  <div className="p-5 border-b border-white/5 bg-white/[0.02]">
                    <h3 className="font-black text-lg tracking-tight flex items-center gap-2"><RiMessage3Line className="text-amber-500" /> Live Chat</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
                    {msgs.map(m => (
                      <div key={m.id} className={`text-sm px-4 py-3 rounded-2xl max-w-[90%] shadow-lg ${m.from === "system" ? "self-center text-amber-500 text-[10px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20" : m.from === "me" ? "self-end bg-amber-500 text-black font-semibold rounded-tr-sm" : "self-start bg-white/10 text-white rounded-tl-sm border border-white/5"}`}>
                        {m.text}
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>
                  <div className="p-4 bg-black/40 border-t border-white/5">
                    <div className="flex items-center gap-2 bg-white/5 p-1.5 pl-4 rounded-2xl focus-within:bg-white/10 transition-colors border border-white/5">
                      <input 
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/30 text-sm w-full" 
                        placeholder="Type message..." 
                        value={draft} 
                        onChange={e => setDraft(e.target.value)} 
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} 
                      />
                      <button className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all ${draft.trim() ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-105" : "bg-white/5 text-white/30 cursor-not-allowed"}`} onClick={send} disabled={!draft.trim()}>
                        <RiSendPlaneFill className="ml-0.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Central Controls Dock (Floating Over Video) */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 sm:gap-6 bg-black/60 backdrop-blur-3xl px-6 py-4 sm:px-8 sm:py-5 rounded-[40px] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-40 w-max max-w-full overflow-x-auto">
              <button className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full flex items-center justify-center text-xl sm:text-2xl transition-all ${micOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]"}`} onClick={() => setMicOn(!micOn)}>
                {micOn ? <RiMicLine /> : <RiMicOffLine />}
              </button>
              <button className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full flex items-center justify-center text-xl sm:text-2xl transition-all ${camOn ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]"}`} onClick={() => setCamOn(!camOn)}>
                {camOn ? <RiCameraLine /> : <RiCameraOffLine />}
              </button>
              
              <div className="w-px h-8 bg-white/20 shrink-0" />

              {status === "idle" && (
                <button className="btn-primary py-3 px-6 sm:py-4 sm:px-8 rounded-full text-sm sm:text-lg whitespace-nowrap shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_40px_rgba(245,158,11,0.5)]" onClick={startSearch}>Start Video Chat</button>
              )}
              {isSearching && (
                <button className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full flex items-center gap-2 transition-colors shadow-[0_0_30px_rgba(239,68,68,0.4)] whitespace-nowrap" onClick={stopSearch}>
                  <RiCloseCircleLine className="text-xl shrink-0" /> Cancel Search
                </button>
              )}
              {status === "chatting" && (
                <>
                  <button className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full flex items-center gap-2 transition-colors whitespace-nowrap" onClick={skip}>
                    <RiSkipForwardLine className="text-xl shrink-0" /> Skip
                  </button>
                  <button className="bg-red-500/20 text-red-500 hover:bg-red-500/30 font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-full flex items-center gap-2 transition-colors whitespace-nowrap shadow-[0_0_20px_rgba(239,68,68,0.2)]" onClick={endCall}>
                    <RiCloseCircleLine className="text-xl shrink-0" /> End Call
                  </button>
                </>
              )}
              {status === "ended" && (
                <button className="btn-primary py-3 px-6 sm:py-4 sm:px-8 rounded-full text-sm sm:text-lg whitespace-nowrap shadow-[0_0_30px_rgba(245,158,11,0.3)]" onClick={startSearch}>New Call</button>
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* Interests Modal */}
      <AnimatePresence>
        {showTags && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={(e) => e.target === e.currentTarget && setShowTags(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white/[0.02] backdrop-blur-3xl p-6 sm:p-10 rounded-[40px] w-full max-w-xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none" />
              
              <div className="flex justify-between items-center mb-8 relative z-10">
                <h2 className="text-3xl font-black tracking-tight">Filter Interests</h2>
                <button className="text-white/30 hover:text-white transition-colors" onClick={() => setShowTags(false)}>
                  <RiCloseCircleLine className="text-4xl" />
                </button>
              </div>
              
              <p className="text-white/40 mb-10 text-lg leading-relaxed relative z-10">
                Select topics you enjoy. The matchmaking algorithm will prioritize connecting you with strangers who share your vibe.
              </p>

              <div className="flex flex-wrap gap-3 mb-12 relative z-10">
                {INTERESTS.map(t => {
                  const isActive = tags.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => setTags(p => isActive ? p.filter(x => x !== t) : [...p, t])}
                      className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
                        isActive 
                          ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-105" 
                          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end gap-4 relative z-10">
                <button className="px-8 py-4 font-bold text-white/40 hover:text-white transition-colors" onClick={() => setTags([])}>Clear All</button>
                <button className="btn-primary px-10 py-4" onClick={() => setShowTags(false)}>Save Filters</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatApp />
    </Suspense>
  );
}
