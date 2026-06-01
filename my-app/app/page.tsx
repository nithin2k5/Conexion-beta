"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const TAGS = ["Music", "Gaming", "Travel", "Art", "Tech", "Movies", "Sports", "Books", "Anime", "Food"];

export default function Home() {
  const [count, setCount] = useState(24817);
  useEffect(() => {
    const t = setInterval(() => setCount(c => c + Math.floor(Math.random() * 7) - 3), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="lp-root">

      {/* Ambient orbs */}
      <div className="orb" style={{
        width: 480, height: 480, top: -140, left: -160,
        background: "radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)",
        animationDelay: "0s",
      }} />
      <div className="orb" style={{
        width: 340, height: 340, bottom: 40, right: -100,
        background: "radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)",
        animationDelay: "-4s",
      }} />

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-logo">
          <div className="lp-logo-icon">
            <span className="lp-logo-ring" />
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="lp-logo-name f-display g-shimmer">Conexion</span>
        </div>

        <div className="lp-nav-right">
          <div className="badge-count">
            <span className="dot-online" />
            {count.toLocaleString()} online
          </div>
          <Link href="/chat" className="btn btn-amber" style={{ padding: "8px 18px", fontSize: "0.84rem", borderRadius: 9 }}>
            Start chatting
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="lp-hero">
        <div className="lp-badge anim-fadeup d1">
          <span className="dot-online" style={{ width: 5, height: 5 }} />
          Anonymous · Real-time · Free
        </div>

        <h1 className="lp-h1 f-display anim-fadeup d2">
          Talk to a<br />
          <span className="g-shimmer">random stranger.</span>
        </h1>

        <p className="lp-sub anim-fadeup d3">
          No sign-up. No profile. Just open a chat and start talking to someone new — anywhere in the world.
        </p>

        <div className="lp-ctas anim-fadeup d4">
          <Link href="/chat" className="btn btn-amber">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" />
            </svg>
            New conversation
          </Link>
          <a href="#how" className="btn btn-outline">How it works</a>
        </div>

        <div className="lp-tags anim-fadeup d5">
          {TAGS.map(tag => (
            <span key={tag} className="pill" style={{ cursor: "default" }}>{tag}</span>
          ))}
        </div>
      </main>

      {/* ── Divider ── */}
      <div className="lp-divider" />

      {/* ── How it works ── */}
      <section id="how" className="lp-how">
        <div className="lp-how-inner">
          <h2 className="lp-how-title f-display">
            Three steps to <span className="g-text">connect</span>
          </h2>
          <div className="lp-cards">
            {[
              { num: "01", emoji: "🎯", title: "Pick interests",    desc: "Choose tags to match with people who share your passions." },
              { num: "02", emoji: "⚡", title: "Instant match",     desc: "Get paired with a random stranger in seconds." },
              { num: "03", emoji: "💬", title: "Start talking",     desc: "Chat freely. Skip anytime. Zero commitment." },
            ].map(s => (
              <div key={s.num} className="lp-card">
                <div className="lp-card-top">
                  <span className="lp-card-emoji">{s.emoji}</span>
                  <span className="lp-card-num f-display">{s.num}</span>
                </div>
                <div>
                  <div className="lp-card-title f-display">{s.title}</div>
                  <div className="lp-card-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <span className="f-display g-shimmer" style={{ fontSize: "0.95rem", fontWeight: 800 }}>Conexion</span>
        <div className="lp-footer-links">
          {["Privacy", "Terms", "Safety"].map(l => (
            <a key={l} href="#" className="lp-footer-link">{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
