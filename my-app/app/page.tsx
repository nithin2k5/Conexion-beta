"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const TAGS = ["Music", "Gaming", "Travel", "Art", "Tech", "Movies", "Sports", "Books", "Anime", "Food", "Science", "Fitness"];

export default function Home() {
  const [count, setCount] = useState(24817);
  useEffect(() => {
    const t = setInterval(() => setCount(c => c + Math.floor(Math.random() * 7) - 3), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div className="nav-wrapper anim-fade-in">
        <nav className="navbar glass-panel">
          <Link href="/" className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v15.5l-2-2h-2" />
              </svg>
            </div>
            <span className="f-display text-gradient">Conexion</span>
          </Link>

          <div className="nav-actions">
            <div className="status-indicator hidden sm:flex" style={{ display: 'flex' }}>
              <span className="status-dot" />
              {count.toLocaleString()} online
            </div>
            <Link href="/chat" className="btn btn-primary">
              Start Chatting
            </Link>
          </div>
        </nav>
      </div>

      <main className="hero-section">
        <div className="hero-badge anim-fade-up">
          <span className="status-dot" style={{ background: '#818cf8', boxShadow: '0 0 10px #818cf8' }} />
          Anonymous &middot; Fast &middot; Free
        </div>

        <h1 className="hero-title f-display anim-fade-up delay-1">
          Connect with the world <br />
          <span className="text-gradient-shimmer">instantly.</span>
        </h1>

        <p className="hero-desc anim-fade-up delay-2">
          No sign-ups. No profiles. Just jump right into a conversation with a stranger from anywhere across the globe. Rediscover the magic of human connection.
        </p>

        <div className="hero-ctas anim-fade-up delay-3">
          <Link href="/chat" className="btn btn-primary" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Start New Chat
          </Link>
          <a href="#features" className="btn btn-outline" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>
            Explore Features
          </a>
        </div>

        <div className="tags-container anim-fade-up delay-4" style={{ marginTop: '48px' }}>
          {TAGS.map(tag => (
            <span key={tag} className="tag-pill">{tag}</span>
          ))}
        </div>
      </main>

      <section id="features" className="features-section">
        <div className="features-grid">
          {[
            {
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              ),
              title: "Smart Matching",
              desc: "Select your interests and our algorithm pairs you with like-minded strangers instantly for better conversations."
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              ),
              title: "Lightning Fast",
              desc: "Built on a high-performance edge network. Messages are delivered in real-time with zero noticeable latency."
            },
            {
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ),
              title: "Total Anonymity",
              desc: "Your privacy is guaranteed. We don't track your data, require accounts, or save chat logs. Chat freely."
            }
          ].map((f, i) => (
            <div key={i} className="feature-card glass-panel anim-fade-up" style={{ animationDelay: `${0.2 * i}s` }}>
              <div className="feature-icon-wrap">{f.icon}</div>
              <h3 className="feature-title f-display">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '40px 20px', textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)' }}>
        <p className="f-display text-gradient" style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '16px' }}>Conexion</p>
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', fontSize: '0.9rem' }}>
          <a href="#" style={{ transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='white'} onMouseOut={e => e.currentTarget.style.color='var(--text-muted)'}>Privacy Policy</a>
          <a href="#" style={{ transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='white'} onMouseOut={e => e.currentTarget.style.color='var(--text-muted)'}>Terms of Service</a>
        </div>
      </footer>
    </>
  );
}
