"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { RiSendPlane2Line, RiArrowLeftLine, RiUserSmileLine, RiGroupLine } from "react-icons/ri";

export default function WorldChat() {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [myName, setMyName] = useState("");
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const savedName = sessionStorage.getItem("conexion_user_name") || "Anonymous";
    setMyName(savedName);

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_WS_URL ? new URL(process.env.NEXT_PUBLIC_WS_URL).host : (window.location.port === "3000" ? "localhost:3001" : window.location.host);
    const ws = new WebSocket(`${proto}//${host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      ws.send(JSON.stringify({ type: "join_global", name: savedName }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "global_history") {
          setMsgs(msg.messages);
        } else if (msg.type === "global_message") {
          setMsgs(m => [...m, msg.message]);
        } else if (msg.type === "global_users") {
          setUsers(msg.users);
        }
      } catch(e) {}
    };

    ws.onclose = () => setStatus("disconnected");

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave_global" }));
      }
      ws.close();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const sendGlobal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || status !== "connected") return;
    wsRef.current?.send(JSON.stringify({ type: "global_message", text: draft }));
    setDraft("");
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[var(--color-ivory)] overflow-hidden font-sans text-[var(--color-charcoal)]">
      {/* Sidebar: Online Users */}
      <div className="hidden md:flex w-72 bg-[var(--color-parchment)] border-r border-[var(--color-border)] flex-col shadow-[10px_0_30px_rgba(0,0,0,0.03)] z-10 relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="p-6 border-b border-[var(--color-border)] flex flex-col gap-2 relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-[var(--color-gray-brown)] hover:text-[var(--color-charcoal)] transition-colors mb-6">
            <RiArrowLeftLine /> Back to Home
          </Link>
          <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>World Chat</h2>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-olive)] mt-1">
            <span className="w-2 h-2 rounded-full bg-[var(--color-olive)] animate-pulse" />
            {users.length} Online Now
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin relative z-10">
          <AnimatePresence>
            {users.map(u => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-3 px-4 py-3 bg-white/60 backdrop-blur-sm rounded-xl border border-[var(--color-border)] shadow-sm hover:bg-white hover:shadow-md transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--color-beige)] flex items-center justify-center text-[var(--color-gray-brown)] shrink-0 border border-[var(--color-border)]">
                  <RiUserSmileLine />
                </div>
                <span className="text-sm font-semibold truncate text-[var(--color-charcoal)]">{u.name}</span>
                {u.name === myName && <span className="ml-auto text-[9px] uppercase font-bold tracking-wider text-[var(--color-gray-light)]">You</span>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[var(--color-ivory)]">
        {/* Mobile Header */}
        <div className="md:hidden p-4 bg-white/90 backdrop-blur-md border-b border-[var(--color-border)] flex items-center justify-between shadow-sm z-20 sticky top-0">
          <Link href="/" className="p-2 -ml-2 text-[var(--color-gray-brown)]"><RiArrowLeftLine className="text-xl" /></Link>
          <div className="flex flex-col items-center">
             <h2 className="font-bold tracking-tight font-serif text-lg">World Chat</h2>
             <span className="text-[9px] uppercase tracking-widest font-bold text-[var(--color-olive)] flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-olive)] animate-pulse" />
               {users.length} Online
             </span>
          </div>
          <div className="w-8" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6 relative z-10">
          {msgs.length === 0 && status === "connected" && (
             <div className="h-full flex flex-col items-center justify-center text-[var(--color-gray-light)] opacity-70 mt-[-10vh]">
               <div className="w-20 h-20 bg-[var(--color-beige)] rounded-full flex items-center justify-center mb-6">
                 <RiGroupLine className="text-4xl text-[var(--color-gray-brown)]" />
               </div>
               <p className="text-sm uppercase tracking-widest font-bold text-[var(--color-charcoal)] mb-2">Welcome to the World Chat</p>
               <p className="text-xs max-w-xs text-center leading-relaxed">Say hello to everyone currently online across the globe.</p>
             </div>
          )}
          {msgs.map((m, i) => {
            const isMe = m.name === myName;
            const prev = msgs[i - 1];
            const showName = !prev || prev.name !== m.name || (m.ts - prev.ts > 60000);
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col max-w-[85%] md:max-w-[65%] ${isMe ? 'self-end items-end' : 'self-start items-start'} ${!showName ? 'mt-[-12px]' : ''}`}
              >
                {!isMe && showName && (
                  <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gray-brown)] mb-1.5 px-3">
                    {m.name}
                  </span>
                )}
                <div className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                  isMe 
                  ? 'bg-[var(--color-charcoal)] text-[var(--color-ivory)] rounded-[1.25rem] rounded-tr-sm' 
                  : 'bg-white text-[var(--color-charcoal)] border border-[var(--color-border)] rounded-[1.25rem] rounded-tl-sm'
                }`}>
                  {m.text}
                </div>
              </motion.div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-gradient-to-t from-white via-white/95 to-transparent z-20">
          <form onSubmit={sendGlobal} className="max-w-4xl mx-auto flex gap-3 relative">
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Message the world..."
              className="flex-1 bg-white border border-[var(--color-border)] rounded-full px-6 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] outline-none focus:border-[var(--color-peach)] focus:ring-4 focus:ring-[var(--color-peach)]/10 transition-all text-[var(--color-charcoal)] placeholder:text-[var(--color-gray-light)]"
            />
            <button
              type="submit"
              disabled={!draft.trim() || status !== "connected"}
              className="w-[3.5rem] h-[3.5rem] shrink-0 bg-[var(--color-peach)] hover:bg-[var(--color-charcoal)] text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:hover:bg-[var(--color-peach)] transition-colors shadow-lg group"
            >
              <RiSendPlane2Line className="text-xl group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
