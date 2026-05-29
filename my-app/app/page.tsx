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
    <div className="page">
      {/* Background orbs */}
      <div
        className="orb"
        style={{
          width: 500, height: 500,
          top: -160, left: -180,
          background: "radial-gradient(circle, rgba(245,158,11,0.13) 0%, transparent 70%)",
          animationDelay: "0s",
        }}
      />
      <div
        className="orb"
        style={{
          width: 360, height: 360,
          bottom: 60, right: -120,
          background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)",
          animationDelay: "-4s",
        }}
      />

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-logo">
          <div className="nav-logo-mark">
            <span className="nav-logo-ping" />
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="nav-logo-name font-display text-shimmer">Conexion</span>
        </div>

        <div className="nav-right">
          <div className="online-badge">
            <span className="online-dot" />
            {count.toLocaleString()} online
          </div>
          <Link href="/chat" className="btn-primary" style={{ padding: "9px 20px", borderRadius: 10, fontSize: "0.85rem" }}>
            Start chatting
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="hero">
        <div className="hero-badge animate-fade-up delay-100">
          <span className="online-dot" style={{ width: 5, height: 5 }} />
          Anonymous · Real-time · Free
        </div>

        <h1 className="hero-title font-display animate-fade-up delay-200">
          Talk to a<br />
          <span className="text-shimmer">random stranger.</span>
        </h1>

        <p className="hero-sub animate-fade-up delay-300">
          No sign-up. No profile. Just open a chat and start talking to someone new — anywhere in the world.
        </p>

        <div className="hero-ctas animate-fade-up delay-400">
          <Link href="/chat" className="btn-primary">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            New conversation
          </Link>
          <a href="#how" className="btn-ghost">
            How it works
          </a>
        </div>

        <div className="hero-tags animate-fade-up delay-500">
          {TAGS.map(tag => (
            <span key={tag} className="pill" style={{ cursor: "default" }}>{tag}</span>
          ))}
        </div>
      </main>

      {/* ── Divider ── */}
      <div className="divider" />

      {/* ── How it works ── */}
      <section id="how" className="section">
        <div className="section-inner">
          <h2 className="section-title font-display">
            Three steps to <span className="text-gradient">connect</span>
          </h2>
          <div className="steps-grid">
            {[
              { num: "01", emoji: "🎯", title: "Pick interests", desc: "Choose tags to match with people who share your passions." },
              { num: "02", emoji: "⚡", title: "Instant match",  desc: "Get paired with a random stranger in seconds." },
              { num: "03", emoji: "💬", title: "Start talking",  desc: "Chat freely. Skip anytime. Zero commitment." },
            ].map(step => (
              <div key={step.num} className="step-card">
                <div className="step-card-top">
                  <span className="step-emoji">{step.emoji}</span>
                  <span className="step-num font-display">{step.num}</span>
                </div>
                <div>
                  <div className="step-title font-display">{step.title}</div>
                  <div className="step-desc">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <span className="font-display text-shimmer" style={{ fontSize: "0.95rem", fontWeight: 800 }}>
          Conexion
        </span>
        <div className="footer-links">
          {["Privacy", "Terms", "Safety"].map(l => (
            <a key={l} href="#" className="footer-link">{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
