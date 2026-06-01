"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";

type Status = "idle" | "searching" | "chatting" | "ended";
interface Msg { id: string; from: "me" | "stranger" | "system"; text: string; }

const INTERESTS = ["Music","Gaming","Travel","Art","Tech","Movies","Sports","Books","Anime","Food","Science","Fitness"];
const BOT = ["Hey! 👋","What's up?","Where are you from?","haha same 😄","Oh really? Tell me more!","Seen any good movies lately?","What music do you like?","That's actually really cool!","lol yeah totally","What do you do for fun?","Never thought about it that way!","Night owl or early bird?"];
const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function ChatUI() {
  const [status,   setStatus]   = useState<Status>("idle");
  const [msgs,     setMsgs]     = useState<Msg[]>([]);
  const [draft,    setDraft]    = useState("");
  const [tags,     setTags]     = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [typing,   setTyping]   = useState(false);
  const [count,    setCount]    = useState(0);
  const [elapsed,  setElapsed]  = useState(0);

  const endRef    = useRef<HTMLDivElement>(null);
  const inpRef    = useRef<HTMLTextAreaElement>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track pending timeouts so we can cancel them on next/end/stop
  const pendingRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // auto-scroll
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  // elapsed timer
  useEffect(() => {
    if (status === "chatting") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    return () => {
      pendingRef.current.forEach(clearTimeout);
      pendingRef.current = [];
    };
  }, []);

  const clearPending = useCallback(() => {
    pendingRef.current.forEach(clearTimeout);
    pendingRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    pendingRef.current.push(id);
    return id;
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const sys  = (text: string): Msg => ({ id: crypto.randomUUID(), from: "system", text });

  const reply = useCallback(() => {
    setTyping(true);
    const id = setTimeout(() => {
      setTyping(false);
      setMsgs(m => [...m, { id: crypto.randomUUID(), from: "stranger", text: rand(BOT) }]);
      // Remove from pending since it fired
      pendingRef.current = pendingRef.current.filter(t => t !== id);
    }, 900 + Math.random() * 1000);
    pendingRef.current.push(id);
  }, []);

  const start = useCallback(() => {
    clearPending();
    setTyping(false);
    setStatus("searching");
    setMsgs([]);
    schedule(() => {
      setStatus("chatting");
      setCount(c => c + 1);
      setMsgs([sys("You are now chatting with a stranger. Say hi!")]);
      schedule(reply, 700);
    }, 1400 + Math.random() * 1400);
  }, [reply, clearPending, schedule]);

  const next = useCallback(() => {
    clearPending();
    setMsgs([]);
    setTyping(false);
    setStatus("searching");
    schedule(() => {
      setStatus("chatting");
      setCount(c => c + 1);
      setMsgs([sys("Connected to a new stranger. Say hi!")]);
      schedule(reply, 700);
    }, 1000 + Math.random() * 1000);
  }, [reply, clearPending, schedule]);

  const end  = useCallback(() => {
    clearPending();
    setTyping(false);
    setStatus("ended");
    setMsgs(m => [...m, sys("You disconnected.")]);
  }, [clearPending]);

  const stop = useCallback(() => {
    clearPending();
    setStatus("idle");
    setMsgs([]);
    setTyping(false);
    setCount(0);
  }, [clearPending]);

  const send = useCallback(() => {
    if (!draft.trim() || status !== "chatting") return;
    const text = draft.trim();
    setDraft("");
    setMsgs(m => [...m, { id: crypto.randomUUID(), from: "me", text }]);
    schedule(reply, 300);
    inpRef.current?.focus();
    // Reset textarea height after clearing
    if (inpRef.current) {
      inpRef.current.style.height = "auto";
    }
  }, [draft, status, reply, schedule]);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  const toggleTag = useCallback((t: string) =>
    setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]),
  []);

  // Auto-resize textarea as user types
  const handleDraftChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
  }, []);

  return (
    <div className="cp-root">

      {/* ── Header ── */}
      <header className="cp-header">
        {/* Left: logo */}
        <div className="cp-header-slot">
          <Link href="/" className="cp-logo-link">
            <div className="cp-logo-icon">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="cp-logo-name f-display g-shimmer">Conexion</span>
          </Link>
        </div>

        {/* Center: status */}
        <div className="cp-header-slot center">
          {status === "chatting" && (
            <div className="cp-status-badge amber anim-fadein">
              <span className="cp-timer-dot" />
              {fmt(elapsed)}
            </div>
          )}
          {status === "searching" && (
            <div className="cp-status-badge muted anim-fadein">
              <span className="cp-searching-dot" />
              Searching…
            </div>
          )}
        </div>

        {/* Right: online count + interests */}
        <div className="cp-header-slot" style={{ justifyContent: "flex-end" }}>
          <div className="badge-count">
            <span className="dot-online" />
            24,817
          </div>
          <div className="cp-interests-wrap">
            <button className="btn btn-icon" id="interests-btn" onClick={() => setShowTags(true)} title="Interests">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path d="M9.653 16.915l-.005-.003-.019-.01a20.76 20.76 0 01-1.162-.682 22.04 22.04 0 01-2.582-2.085C4.851 13.001 3.863 11.52 3.863 9.66c0-2.21 1.791-4 4-4 .667 0 1.299.168 1.851.463A3.994 3.994 0 0110 5.5a3.994 3.994 0 011.286.143 4 4 0 013.714 3.977c0 1.855-.988 3.336-2.022 4.475a22.04 22.04 0 01-2.582 2.085 20.76 20.76 0 01-1.162.682l-.02.01-.005.003h-.001a.752.752 0 01-.69 0h-.001z" />
              </svg>
            </button>
            {tags.length > 0 && <span className="cp-interests-badge">{tags.length}</span>}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="cp-body">

        {/* Idle */}
        {status === "idle" && (
          <div className="cp-splash anim-fadein">
            <div className="cp-splash-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34">
                <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <div className="cp-splash-title f-display">Ready to connect?</div>
              <div className="cp-splash-sub">Hit Start to be matched with a stranger</div>
            </div>
          </div>
        )}

        {/* Ended */}
        {status === "ended" && (
          <div className="cp-messages cp-messages-ended anim-fadein">
            {msgs.map(m => m.from === "system"
              ? <div key={m.id} className="cp-sys-msg">{m.text}</div>
              : (
                <div key={m.id} className={m.from === "me" ? "cp-row-me" : "cp-row-stranger"}>
                  <div className={m.from === "me" ? "cp-bubble-me" : "cp-bubble-stranger"}>{m.text}</div>
                </div>
              )
            )}
            <div className="cp-ended-summary">
              <div className="cp-splash-title f-display" style={{ fontSize: "1.1rem" }}>Chat ended</div>
              <div className="cp-splash-sub">{count} {count === 1 ? "conversation" : "conversations"} this session</div>
            </div>
          </div>
        )}

        {/* Searching */}
        {status === "searching" && (
          <div className="cp-searching anim-fadein">
            <div className="cp-rings">
              <span className="cp-ring cp-ring-1" />
              <span className="cp-ring cp-ring-2" />
              <div className="cp-ring-core">
                <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17">
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div>
              <div className="cp-searching-title f-display">Finding someone…</div>
              <div className="cp-searching-sub">
                {tags.length > 0 ? `Matching on: ${tags.slice(0, 3).join(", ")}` : "Matching randomly"}
              </div>
            </div>
          </div>
        )}

        {/* Chatting */}
        {status === "chatting" && (
          <div className="cp-messages">
            {msgs.map(m => m.from === "system"
              ? <div key={m.id} className="cp-sys-msg">{m.text}</div>
              : (
                <div key={m.id} className={`${m.from === "me" ? "cp-row-me" : "cp-row-stranger"} anim-fadein`}>
                  <div className={m.from === "me" ? "cp-bubble-me" : "cp-bubble-stranger"}>{m.text}</div>
                </div>
              )
            )}
            {typing && (
              <div className="cp-row-stranger anim-fadein">
                <div className="cp-bubble-typing">
                  <span className="cp-typing-dot" />
                  <span className="cp-typing-dot" />
                  <span className="cp-typing-dot" />
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={endRef} style={{ flexShrink: 0 }} />
      </div>

      {/* ── Footer ── */}
      <div className="cp-footer">
        {/* Input */}
        {status === "chatting" && (
          <div className="cp-input-row anim-fadein">
            <textarea
              ref={inpRef}
              id="chat-input"
              className="cp-textarea"
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={onKey}
              placeholder="Type a message…"
              rows={1}
            />
            <button
              id="send-btn"
              className={`btn btn-send ${draft.trim() ? "on" : "off"}`}
              onClick={send}
              disabled={!draft.trim()}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="cp-action-row">
          {status === "idle" && (
            <button id="start-btn" className="btn btn-amber f-display" onClick={start}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z" clipRule="evenodd" />
              </svg>
              Start
            </button>
          )}

          {status === "searching" && (
            <button id="cancel-btn" className="btn btn-muted" onClick={stop}>Cancel</button>
          )}

          {status === "chatting" && (
            <>
              <button id="skip-btn" className="btn btn-outline" onClick={next}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path d="M3.288 4.819A1.5 1.5 0 001 6.095v7.81a1.5 1.5 0 002.288 1.277l6.5-3.905a1.5 1.5 0 000-2.554L3.288 4.82zM10.288 4.819A1.5 1.5 0 008 6.095v7.81a1.5 1.5 0 002.288 1.277l6.5-3.905a1.5 1.5 0 000-2.554l-6.5-3.904z" />
                </svg>
                Next
              </button>
              <button id="end-btn" className="btn btn-ghost-red" onClick={end} title="End chat">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                  <path fillRule="evenodd" d="M4 2a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V3a1 1 0 00-1-1H4zm3.5 5a.5.5 0 00-.5.5v5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5zm5 0a.5.5 0 00-.5.5v5a.5.5 0 001 0v-5a.5.5 0 00-.5-.5z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          )}

          {status === "ended" && (
            <>
              <button id="new-chat-btn" className="btn btn-amber f-display" onClick={start}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                New chat
              </button>
              <button id="home-btn" className="btn btn-icon" onClick={stop} title="Back to home">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Interests Modal ── */}
      {showTags && (
        <div className="cp-backdrop" onClick={e => e.target === e.currentTarget && setShowTags(false)}>
          <div className="cp-modal anim-scalein">
            <div className="cp-modal-hdr">
              <div>
                <div className="cp-modal-title f-display">Interests</div>
                <div className="cp-modal-sub">Match with like-minded strangers</div>
              </div>
              <button id="close-interests" className="btn btn-icon" onClick={() => setShowTags(false)}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <div className="cp-modal-tags">
              {INTERESTS.map(t => (
                <button
                  key={t}
                  id={`tag-${t.toLowerCase()}`}
                  className={`pill${tags.includes(t) ? " is-active" : ""}`}
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="cp-modal-actions">
              <button className="cp-modal-clear" onClick={() => setTags([])}>Clear</button>
              <button id="apply-interests" className="cp-modal-apply f-display" onClick={() => setShowTags(false)}>
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
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080808" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => (
            <span key={i} className="cp-typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    }>
      <ChatUI />
    </Suspense>
  );
}
