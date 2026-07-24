"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { RiArrowLeftLine, RiMailSendLine } from "react-icons/ri";
import ParticleBackground from "../components/ParticleBackground";
import Footer from "../components/Footer";

import { Toaster, toast } from "react-hot-toast";

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
  "Instant Connectivity",
];

export default function LaunchingSoon() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("idle");
        setStep("otp");
        if (data.devOtp) {
          // Only sent in dev mode when EMAIL_USER is not configured
          toast.success(`Dev OTP: ${data.devOtp}`);
        } else {
          toast.success("OTP sent to your email!");
        }
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to send OTP");
        toast.error(data.error || "Failed to send OTP");
      }
    } catch (error) {
      setStatus("error");
      setMessage("An unexpected error occurred");
      toast.error("An unexpected error occurred");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        const successMsg = `You're #${data.count} on the waitlist!`;
        setMessage(successMsg);
        toast.success("Waitlist registration successful!");
        setEmail("");
        setOtp("");
        setStep("email");
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to join waitlist");
        toast.error(data.error || "Failed to join waitlist");
      }
    } catch (error) {
      setStatus("error");
      setMessage("An unexpected error occurred");
      toast.error("An unexpected error occurred");
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center selection:bg-[var(--color-charcoal)] selection:text-[var(--color-ivory)]"
      style={{ backgroundColor: "var(--color-ivory)" }}>
      
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: 'var(--color-ivory)',
            color: 'var(--color-charcoal)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 30px rgba(46, 39, 36, 0.12)',
            borderRadius: '16px',
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            fontWeight: '500',
            padding: '16px 20px',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-olive)',
              secondary: 'var(--color-ivory)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--color-peach)',
              secondary: 'var(--color-ivory)',
            },
          },
        }}
      />
      
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
        className="fixed top-0 w-full px-6 md:px-16 py-6 md:py-8 flex justify-between items-center z-50 bg-gradient-to-b from-[var(--color-ivory)] to-transparent"
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
          className="mb-8 overflow-hidden rounded-full border border-[var(--color-border)] px-4 md:px-6 py-2 bg-white/40 backdrop-blur-md inline-flex items-center gap-2 md:gap-3 shadow-sm whitespace-nowrap"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-charcoal)] animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-gray-brown)]">Launching Soon</span>
        </motion.div>

        <h1 className="text-5xl sm:text-7xl md:text-[8rem] leading-[0.9] tracking-tighter text-[var(--color-charcoal)] mb-8 max-w-5xl">
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

        {step === "email" ? (
          <motion.form 
            onSubmit={handleSendOtp}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md warm-panel p-2 flex items-center shadow-lg"
            style={{ borderRadius: 20 }}
          >
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === "loading"}
              required
              placeholder="Enter your email for early access" 
              className="flex-1 bg-transparent border-none outline-none px-4 sm:px-6 py-4 text-[var(--color-charcoal)] placeholder-[var(--color-gray-light)] text-[14px] sm:text-[15px] disabled:opacity-50 min-w-0"
            />
            <button 
              type="submit"
              disabled={status === "loading"}
              className="bg-[var(--color-charcoal)] text-[var(--color-ivory)] px-4 sm:px-6 h-14 rounded-2xl flex items-center justify-center hover:bg-[var(--color-charcoal-80)] transition-colors shrink-0 disabled:opacity-50"
            >
              {status === "loading" ? (
                <span className="w-5 h-5 border-2 border-[var(--color-ivory)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-sm font-medium">Send OTP</span>
              )}
            </button>
          </motion.form>
        ) : (
          <motion.form 
            onSubmit={handleVerifyOtp}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md warm-panel p-2 flex flex-col gap-2 shadow-lg"
            style={{ borderRadius: 20 }}
          >
            <div className="flex items-center">
              <input 
                type="text" 
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={status === "loading"}
                required
                placeholder="000000" 
                className="flex-1 bg-transparent border-none outline-none px-4 sm:px-6 py-4 text-[var(--color-charcoal)] placeholder-[var(--color-border)] text-2xl sm:text-3xl font-semibold disabled:opacity-50 text-center tracking-[0.3em] sm:tracking-[0.4em] min-w-0"
                style={{ fontFamily: "var(--font-serif)" }}
                maxLength={6}
              />
              <button 
                type="submit"
                disabled={status === "loading" || otp.length < 6}
                className="bg-[var(--color-charcoal)] text-[var(--color-ivory)] w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-[var(--color-charcoal-80)] transition-colors shrink-0 disabled:opacity-50"
              >
                {status === "loading" ? (
                  <span className="w-5 h-5 border-2 border-[var(--color-ivory)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RiMailSendLine className="text-xl" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="text-[var(--color-gray-light)] text-xs hover:text-[var(--color-charcoal)] transition-colors py-2"
            >
              Change Email
            </button>
          </motion.form>
        )}

        {message && status === "success" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-sm text-green-600 font-medium"
          >
            {message}
          </motion.p>
        )}

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
                <span className="text-[12px] md:text-[14px] uppercase tracking-[0.2em] font-bold text-[var(--color-charcoal)] px-6 md:px-16">
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
