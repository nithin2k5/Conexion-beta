"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";

type Status = "idle" | "searching" | "chatting" | "ended";
interface Msg { id: string; from: "me" | "stranger" | "system"; text: string; }

const INTERESTS = ["Music","Gaming","Travel","Art","Tech","Movies","Sports","Books","Anime","Food","Science","Fitness"];
const BOT = ["Hey!","What's up?","Where are you from?","haha same","Oh really? Tell me more!","Seen any good movies lately?","What music do you like?","That's actually really cool!","lol yeah totally","What do you do for fun?","Never thought about it that way!","Night owl or early bird?"];
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

  // Media Controls
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const endRef    = useRef<HTMLDivElement>(null);
  const inpRef    = useRef<HTMLTextAreaElement>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  useEffect(() => {
    if (status === "chatting") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

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
      pendingRef.current = pendingRef.current.filter(t => t !== id);
    }, 900 + Math.random() * 1000);
    pendingRef.current.push(id);
  }, []);

  const start = useCallback(() => {
    clearPending();
    setTyping(false);
    setStatus("searching");
    setElapsed(0);
    setMsgs([]);
    schedule(() => {
      setStatus("chatting");
      setCount(c => c + 1);
      setMsgs([sys("You are now connected with a stranger. Say hi!")]);
      schedule(reply, 700);
    }, 1400 + Math.random() * 1400);
  }, [reply, clearPending, schedule]);

  const next = useCallback(() => {
    clearPending();
    setMsgs([]);
    setTyping(false);
    setStatus("searching");
    setElapsed(0);
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
    setMsgs(m => [...m, sys("You have disconnected.")]);
  }, [clearPending]);

  const stop = useCallback(() => {
    clearPending();
    setStatus("idle");
    setMsgs([]);
    setTyping(false);
    setCount(0);
    setElapsed(0);
  }, [clearPending]);

  const send = useCallback(() => {
    if (!draft.trim() || status !== "chatting") return;
    const text = draft.trim();
    setDraft("");
    setMsgs(m => [...m, { id: crypto.randomUUID(), from: "me", text }]);
    schedule(reply, 300);
    inpRef.current?.focus();
    if (inpRef.current) inpRef.current.style.height = "auto";
  }, [draft, status, reply, schedule]);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  const toggleTag = useCallback((t: string) =>
    setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]),
  []);

  const handleDraftChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }, []);

  return (
    <div className="chat-page-wrapper">
      <div className="bg-orb bg-orb-1" style={{opacity: 0.5}} />
      <div className="bg-orb bg-orb-2" style={{opacity: 0.5}} />

      <div className="chat-container glass-panel anim-fade-up has-video">
        
        {/* Media Panel (Left side) */}
        <div className="media-panel">
          <div className="stranger-video">
            {status === "chatting" ? (
               <div style={{color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="48" height="48" style={{opacity: 0.5}}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Stranger's Video Stream</span>
               </div>
            ) : status === "searching" ? (
               <div className="radar">
                 <div className="radar-ring" />
                 <div className="radar-ring" />
                 <div className="radar-ring" />
                 <div className="radar-core">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                     <circle cx="11" cy="11" r="8" />
                     <line x1="21" y1="21" x2="16.65" y2="16.65" />
                   </svg>
                 </div>
               </div>
            ) : (
               <div style={{color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
                 <div style={{width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z"/>
                      <rect x="3" y="6" width="12" height="12" rx="2" ry="2"/>
                    </svg>
                 </div>
                 <span>Ready to Connect via Video & Audio</span>
               </div>
            )}
          </div>

          <div className="my-video">
             {camOn ? (
               <div style={{color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24" style={{opacity: 0.5}}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span style={{fontSize: '0.8rem', opacity: 0.8}}>Your Camera Feed</span>
               </div>
             ) : (
               <div style={{color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
               </div>
             )}
          </div>

          <div className="media-controls">
            <button className={`media-btn ${micOn ? "" : "off"}`} onClick={() => setMicOn(!micOn)} title={micOn ? "Mute Microphone" : "Unmute Microphone"}>
              {micOn ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <line x1="1" y1="1" x2="23" y2="23"/>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              )}
            </button>
            <button className={`media-btn ${camOn ? "" : "off"}`} onClick={() => setCamOn(!camOn)} title={camOn ? "Stop Video" : "Start Video"}>
              {camOn ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Chat Panel (Right side) */}
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <Link href="/" className="logo" style={{fontSize: '1.1rem'}}>
              <div className="logo-icon" style={{width: 32, height: 32, borderRadius: 10}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v15.5l-2-2h-2" />
                </svg>
              </div>
              <span className="f-display text-gradient">Conexion</span>
            </Link>

            {status === "chatting" && (
              <div className="status-indicator" style={{borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)'}}>
                <span className="status-dot" style={{background: '#818cf8', boxShadow: '0 0 10px #818cf8'}} />
                {fmt(elapsed)}
              </div>
            )}

            <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
              <button className="btn-icon" onClick={() => setShowTags(true)} title="Interests" style={{ position: 'relative' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                {tags.length > 0 && (
                  <span style={{position: 'absolute', top: -4, right: -4, background: 'var(--primary)', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    {tags.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="chat-body">
            {status === "idle" && (
              <div className="searching-view anim-fade-in" style={{padding: '0 20px', textAlign: 'center'}}>
                <h2 className="f-display" style={{fontSize: '1.2rem', fontWeight: 800, marginBottom: 8}}>Ready to Chat</h2>
                <p style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Use the controls below to start searching.</p>
              </div>
            )}

            {status === "searching" && (
              <div className="searching-view anim-fade-in" style={{padding: '0 20px', textAlign: 'center'}}>
                <h2 className="f-display" style={{fontSize: '1.2rem', fontWeight: 700, marginBottom: 4}}>Finding a Stranger...</h2>
                <p style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>
                  {tags.length > 0 ? `Matching interests: ${tags.join(", ")}` : "Matching globally"}
                </p>
              </div>
            )}

            {(status === "chatting" || status === "ended") && (
              <>
                {msgs.map(m => m.from === "system" ? (
                  <div key={m.id} className="system-msg anim-fade-in">{m.text}</div>
                ) : (
                  <div key={m.id} className={`message-row ${m.from} anim-fade-in`}>
                    <div className={`message-bubble ${m.from}`}>{m.text}</div>
                  </div>
                ))}
                {typing && status === "chatting" && (
                  <div className="message-row stranger anim-fade-in">
                    <div className="typing-indicator">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                )}
                {status === "ended" && (
                  <div className="searching-view anim-fade-in" style={{marginTop: 40, flex: 'none'}}>
                    <div style={{textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px solid var(--border-color)'}}>
                      <h2 className="f-display text-gradient" style={{fontSize: '1.1rem', fontWeight: 800, marginBottom: 4}}>Chat Ended</h2>
                      <p style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>You had {count} conversation{count !== 1 && 's'} so far.</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div ref={endRef} style={{height: 1}} />
          </div>

          {/* Footer */}
          <div className="chat-footer">
            {status === "chatting" && (
              <div className="chat-input-wrapper anim-fade-in">
                <textarea
                  ref={inpRef}
                  className="chat-textarea"
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={onKey}
                  placeholder="Type a message..."
                  rows={1}
                />
                <button className="btn-send" onClick={send} disabled={!draft.trim()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            )}

            <div className="action-bar" style={{justifyContent: "space-between"}}>
              {status === "idle" && (
                <button className="btn btn-primary" onClick={start} style={{flex: 1, padding: 14}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Start
                </button>
              )}

              {status === "searching" && (
                <button className="btn btn-outline" onClick={stop} style={{flex: 1, padding: 14}}>
                  Cancel
                </button>
              )}

              {status === "chatting" && (
                <>
                  <button className="btn btn-outline" onClick={next} style={{flex: 1}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                    Skip
                  </button>
                  <button className="btn btn-outline" onClick={end} style={{color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)'}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                  </button>
                </>
              )}

              {status === "ended" && (
                <>
                  <button className="btn btn-primary" onClick={start} style={{flex: 1, padding: 14}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                    New
                  </button>
                  <button className="btn btn-icon" onClick={stop} style={{width: 52, height: 52, borderRadius: 16}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      {showTags && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowTags(false)}>
          <div className="modal-content">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24}}>
              <div>
                <h3 className="f-display" style={{fontSize: '1.4rem', fontWeight: 800, marginBottom: 4}}>Your Interests</h3>
                <p style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>Match with strangers who like the same things.</p>
              </div>
              <button className="btn-icon" onClick={() => setShowTags(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="tags-container" style={{justifyContent: 'flex-start', marginBottom: 32}}>
              {INTERESTS.map(t => (
                <button
                  key={t}
                  className={`tag-pill ${tags.includes(t) ? "active" : ""}`}
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
              <button className="btn btn-outline" onClick={() => setTags([])}>Clear All</button>
              <button className="btn btn-primary" onClick={() => setShowTags(false)}>Apply Filters</button>
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
        <div className="typing-indicator" style={{background: 'transparent', border: 'none'}}>
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
