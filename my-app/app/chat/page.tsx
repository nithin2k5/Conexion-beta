"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";

type Status = "idle" | "searching" | "chatting" | "ended";

interface Msg {
  id: string;
  from: "me" | "stranger" | "system";
  text: string;
}

const INTERESTS = [
  "Music", "Gaming", "Travel", "Art", "Tech", "Movies",
  "Sports", "Books", "Anime", "Food", "Science", "Fitness",
];

const BOT_LINES = [
  "Hey! 👋", "What's up?", "Where are you from?", "haha same 😄",
  "Oh really? Tell me more!", "Have you seen any good movies lately?",
  "What kind of music do you listen to?", "That's actually really cool!",
  "lol yeah I totally agree", "What do you do for fun?",
  "Nice! I never thought about it that way.", "Are you a night owl or early bird?",
];

function rand<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

function ChatUI() {
  const [status, setStatus]     = useState<Status>("idle");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft]       = useState("");
  const [tags, setTags]         = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  const [elapsed, setElapsed]   = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const timerRef  = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (status === "chatting") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const sys = (text: string): Msg => ({ id: crypto.randomUUID(), from: "system", text });

  const strangerReply = useCallback(() => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(m => [...m, { id: crypto.randomUUID(), from: "stranger", text: rand(BOT_LINES) }]);
    }, 900 + Math.random() * 1000);
  }, []);

  const startChat = useCallback(() => {
    setStatus("searching");
    setMessages([]);
    setTimeout(() => {
      setStatus("chatting");
      setChatCount(c => c + 1);
      setMessages([sys("You are now chatting with a stranger. Say hi!")]);
      setTimeout(() => strangerReply(), 700);
    }, 1400 + Math.random() * 1400);
  }, [strangerReply]);

  const skipChat = useCallback(() => {
    setMessages([]);
    setIsTyping(false);
    setStatus("searching");
    setTimeout(() => {
      setStatus("chatting");
      setChatCount(c => c + 1);
      setMessages([sys("Connected to a new stranger. Say hi!")]);
      setTimeout(() => strangerReply(), 700);
    }, 1000 + Math.random() * 1000);
  }, [strangerReply]);

  const endChat  = useCallback(() => { setIsTyping(false); setStatus("ended"); setMessages(m => [...m, sys("You disconnected.")]); }, []);
  const stopAll  = useCallback(() => { setStatus("idle"); setMessages([]); setIsTyping(false); }, []);

  const sendMsg = useCallback(() => {
    if (!draft.trim() || status !== "chatting") return;
    const text = draft.trim();
    setDraft("");
    setMessages(m => [...m, { id: crypto.randomUUID(), from: "me", text }]);
    setTimeout(() => strangerReply(), 300);
    inputRef.current?.focus();
  }, [draft, status, strangerReply]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const toggleTag = (t: string) =>
    setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  return (
    <div className="chat-page">

      {/* ── Header ── */}
      <header className="chat-header">
        {/* Left */}
        <div className="chat-header-left">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="nav-logo-mark" style={{ width: 28, height: 28, borderRadius: 8 }}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" style={{ color: "#000" }}>
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-display text-shimmer" style={{ fontSize: "1rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Conexion
            </span>
          </Link>
        </div>

        {/* Center — status */}
        <div className="chat-header-center">
          {status === "chatting" && (
            <div className="status-badge animate-fade-in" style={{ color: "var(--amber)" }}>
              <span className="timer-dot" />
              {fmt(elapsed)}
            </div>
          )}
          {status === "searching" && (
            <div className="status-badge animate-fade-in" style={{ color: "var(--text-2)" }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: "var(--amber)",
                display: "inline-block", animation: "onlinePulse 0.8s ease-in-out infinite"
              }} />
              Searching…
            </div>
          )}
        </div>

        {/* Right */}
        <div className="chat-header-right">
          <div className="online-badge" style={{ display: "flex" }}>
            <span className="online-dot" />
            <span>24,817</span>
          </div>
          <div className="interests-btn-wrap">
            <button
              id="interests-btn"
              className="btn-icon-sm"
              onClick={() => setShowTags(true)}
              title="Interests"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-2.085c-1.034-1.139-2.022-2.62-2.022-4.475 0-2.209 1.791-4 4-4 .667 0 1.299.168 1.851.463A3.994 3.994 0 0110 5.5a3.994 3.994 0 011.286.143 4 4 0 013.714 3.977c0 1.855-.988 3.336-2.022 4.475a22.044 22.044 0 01-2.582 2.085 20.76 20.76 0 01-1.162.682l-.02.01-.005.003h-.001a.752.752 0 01-.69 0h-.001z" />
              </svg>
            </button>
            {tags.length > 0 && (
              <span className="interests-badge">{tags.length}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Chat Body ── */}
      <div className="chat-body">

        {/* Idle */}
        {status === "idle" && (
          <div className="chat-splash animate-fade-in">
            <div className="splash-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
                <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="splash-title font-display">Ready to connect?</div>
              <div className="splash-sub">Hit Start to be matched with a stranger</div>
            </div>
          </div>
        )}

        {/* Ended */}
        {status === "ended" && messages.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map(msg => {
              if (msg.from === "system") return <div key={msg.id} className="sys-msg">{msg.text}</div>;
              return (
                <div key={msg.id} className={msg.from === "me" ? "msg-row-me animate-fade-in" : "msg-row-stranger animate-fade-in"}>
                  <div className={msg.from === "me" ? "bubble-me" : "bubble-stranger"}>{msg.text}</div>
                </div>
              );
            })}
            <div style={{ marginTop: 16 }} className="chat-splash">
              <div className="splash-title font-display" style={{ fontSize: "1.1rem" }}>Chat ended</div>
              <div className="splash-sub">{chatCount} {chatCount === 1 ? "conversation" : "conversations"} today</div>
            </div>
          </div>
        )}

        {/* Searching */}
        {status === "searching" && (
          <div className="searching-wrap animate-fade-in">
            <div className="searching-rings">
              <span className="ring ring-1" />
              <span className="ring ring-2" />
              <div className="searching-core">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div>
              <div className="searching-title font-display">Finding someone…</div>
              <div className="searching-sub">
                {tags.length > 0 ? `Matching on: ${tags.slice(0, 3).join(", ")}` : "Matching randomly"}
              </div>
            </div>
          </div>
        )}

        {/* Chatting */}
        {status === "chatting" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map(msg => {
              if (msg.from === "system") return <div key={msg.id} className="sys-msg">{msg.text}</div>;
              return (
                <div key={msg.id} className={msg.from === "me" ? "msg-row-me animate-fade-in" : "msg-row-stranger animate-fade-in"}>
                  <div className={msg.from === "me" ? "bubble-me" : "bubble-stranger"}>{msg.text}</div>
                </div>
              );
            })}
            {isTyping && (
              <div className="msg-row-stranger animate-fade-in">
                <div className="bubble-typing">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Footer controls ── */}
      <div className="chat-footer">
        {/* Input row */}
        {status === "chatting" && (
          <div className="input-row animate-fade-in">
            <textarea
              ref={inputRef}
              id="chat-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type a message…"
              rows={1}
              className="chat-input"
            />
            <button
              id="send-btn"
              onClick={sendMsg}
              disabled={!draft.trim()}
              className={`btn-send ${draft.trim() ? "btn-send-active" : "btn-send-inactive"}`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </div>
        )}

        {/* Action row */}
        <div className="action-row">
          {status === "idle" && (
            <button id="start-btn" className="btn-start font-display" onClick={startChat}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z" clipRule="evenodd" />
              </svg>
              Start
            </button>
          )}

          {status === "searching" && (
            <button id="cancel-btn" className="btn-cancel" onClick={stopAll}>Cancel</button>
          )}

          {status === "chatting" && (
            <>
              <button id="skip-btn" className="btn-skip" onClick={skipChat}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path d="M3.288 4.819A1.5 1.5 0 001 6.095v7.81a1.5 1.5 0 002.288 1.277l6.5-3.905a1.5 1.5 0 000-2.554L3.288 4.82zM10.288 4.819A1.5 1.5 0 008 6.095v7.81a1.5 1.5 0 002.288 1.277l6.5-3.905a1.5 1.5 0 000-2.554l-6.5-3.904z" />
                </svg>
                Next
              </button>
              <button id="end-btn" className="btn-end" onClick={endChat} title="End chat">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M4 2a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V3a1 1 0 00-1-1H4zm3.5 5a.5.5 0 00-.5.5v5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5zm5 0a.5.5 0 00-.5.5v5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          )}

          {status === "ended" && (
            <>
              <button id="new-chat-btn" className="btn-start font-display" onClick={startChat}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                New chat
              </button>
              <button id="home-btn" className="btn-icon-sm" onClick={stopAll} title="Back">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Interests Modal ── */}
      {showTags && (
        <div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowTags(false)}
        >
          <div className="modal animate-scale-in">
            <div className="modal-header">
              <div>
                <div className="modal-title font-display">Interests</div>
                <div className="modal-sub">Match with like-minded strangers</div>
              </div>
              <button
                id="close-interests"
                className="btn-icon-sm"
                onClick={() => setShowTags(false)}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="modal-tags">
              {INTERESTS.map(t => (
                <button
                  key={t}
                  id={`tag-${t.toLowerCase()}`}
                  className={`pill ${tags.includes(t) ? "active" : ""}`}
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <button className="modal-btn-clear" onClick={() => setTags([])}>Clear</button>
              <button
                id="apply-interests"
                className="modal-btn-apply font-display"
                onClick={() => setShowTags(false)}
              >
                Apply {tags.length > 0 ? `(${tags.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    }>
      <ChatUI />
    </Suspense>
  );
}
