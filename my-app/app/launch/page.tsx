"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { RiArrowLeftLine, RiMailSendLine } from "react-icons/ri";
import ParticleBackground from "../components/ParticleBackground";
import Footer from "../components/Footer";

// Fade up text reveal
const FadeUpText = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const words = text.split(" ");
  return (
    <div className="flex flex-wrap overflow-hidden justify-center">
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: delay + i * 0.05, ease: [0.33, 1, 0.68, 1] }}
          className="mr-3"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
};
const FEATURES = [
  "End-to-End Encryption",
  "Zero Knowledge Architecture",
  "Interest-Based Curations",
  "AI-Powered Moderation",
  "High-Fidelity Video",
  "Anonymous Encounters",
  "No Sign-ups Required",
  "Instant Connectivity",
];

export default function LaunchingSoon() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center selection:bg-[var(--color-charcoal)] selection:text-[var(--color-ivory)]"
      style={{ backgroundColor: "var(--color-ivory)" }}>
      
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ParticleBackground />
      </div>

      {/* Editorial Vignette */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-radial from-transparent to-[var(--color-ivory)] opacity-60 mix-blend-multiply" />

      {/* Abstract Blobs */}
      <div className="pointer-events-none fixed top-[-15%] right-[-5%] w-[45vw] h-[45vw] rounded-full blur-[130px] z-0"
        style={{ backgroundColor: "rgba(212, 145, 106, 0.07)" }} />
      <div className="pointer-events-none fixed bottom-[-15%] left-[-5%] w-[50vw] h-[50vw] rounded-full blur-[150px] z-0"
        style={{ backgroundColor: "rgba(107, 135, 160, 0.06)" }} />

      {/* ── Navbar ── */}
      <motion.nav 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 w-full px-8 md:px-16 py-8 flex justify-between items-center z-50 bg-gradient-to-b from-[var(--color-ivory)] to-transparent"
      >
        <Link href="/" className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--color-beige)] text-[var(--color-charcoal)] hover:bg-[var(--color-charcoal)] hover:text-[var(--color-ivory)] transition-colors shadow-sm">
          <RiArrowLeftLine className="text-xl" />
        </Link>
        <Link href="/" className="text-2xl font-bold tracking-tight hover:opacity-70 transition-opacity"
          style={{ fontFamily: "var(--font-serif)", color: "var(--color-charcoal)" }}>
          Cone<span style={{ color: "var(--color-peach)", fontStyle: "italic" }}>x</span>ion
        </Link>
        <div className="w-12" /> {/* Spacer for centering */}
      </motion.nav>

      <main className="w-full flex-1 relative z-10 flex flex-col justify-center items-center px-6 pt-32 pb-24 text-center">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 overflow-hidden rounded-full border border-[var(--color-border)] px-6 py-2 bg-white/40 backdrop-blur-md inline-flex items-center gap-3 shadow-sm"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-charcoal)] animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-gray-brown)]">Launching Soon</span>
        </motion.div>

        <h1 className="text-6xl sm:text-8xl md:text-[8rem] leading-[0.9] tracking-tighter text-[var(--color-charcoal)] mb-8 max-w-5xl">
          <FadeUpText text="The wait is" />
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--color-gray-brown)" }}>
            <FadeUpText text="almost over." delay={0.2} />
          </span>
        </h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-[var(--color-gray-brown)] max-w-2xl font-light leading-relaxed mb-16"
        >
          We're putting the final touches on our encrypted peer-to-peer network. An entirely new way to experience human connection is coming to your browser.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md warm-panel p-2 flex items-center shadow-lg"
          style={{ borderRadius: 20 }}
        >
          <input 
            type="email" 
            placeholder="Enter your email for early access" 
            className="flex-1 bg-transparent border-none outline-none px-6 py-4 text-[var(--color-charcoal)] placeholder-[var(--color-gray-light)] text-[15px]"
          />
          <button className="bg-[var(--color-charcoal)] text-[var(--color-ivory)] w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-[var(--color-charcoal-80)] transition-colors shrink-0">
            <RiMailSendLine className="text-xl" />
          </button>
        </motion.div>

        {/* Features Slider */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="w-screen relative left-1/2 -translate-x-1/2 mt-24 overflow-hidden border-y border-[var(--color-border)] py-8 bg-white/30 backdrop-blur-md"
        >
          <div className="absolute left-0 top-0 bottom-0 w-24 md:w-64 bg-gradient-to-r from-[var(--color-ivory)] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 md:w-64 bg-gradient-to-l from-[var(--color-ivory)] to-transparent z-10 pointer-events-none" />
          
          <motion.div 
            className="flex w-fit whitespace-nowrap items-center"
            animate={{ x: ["0%", "-33.333333%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
          >
            {[...FEATURES, ...FEATURES, ...FEATURES].map((feature, i) => (
              <div key={i} className="flex items-center">
                <span className="text-[12px] md:text-[14px] uppercase tracking-[0.2em] font-bold text-[var(--color-charcoal)] px-8 md:px-16">
                  {feature}
                </span>
                <span className="text-[var(--color-peach)] text-lg">✦</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

      </main>

      <Footer />
    </div>
  );
}
