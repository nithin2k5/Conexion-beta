"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { RiMessage3Line, RiVideoChatLine, RiLockPasswordLine, RiUserSmileLine, RiFlashlightLine, RiArrowRightLine, RiCloseLine, RiSendPlane2Line } from "react-icons/ri";
import ParticleBackground from "./components/ParticleBackground";
import Footer from "./components/Footer";

// Smooth magnetic button component
const MagneticButton = ({ children, className, onClick }: any) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = buttonRef.current!.getBoundingClientRect();
    const x = clientX - (left + width / 2);
    const y = clientY - (top + height / 2);
    setPosition({ x: x * 0.2, y: y * 0.2 });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
};

// Fade up text reveal
const FadeUpText = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const words = text.split(" ");
  return (
    <div className="flex flex-wrap overflow-hidden">
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ y: "100%", opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, delay: delay + i * 0.05, ease: [0.33, 1, 0.68, 1] }}
          className="mr-2"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
};

// --- New Graphics Components ---

const ArchitectureGraphic = () => {
  return (
    <div className="absolute inset-0 bg-gradient-to-tr from-[rgba(124,140,101,0.05)] to-[rgba(107,135,160,0.05)] flex items-center justify-center overflow-hidden group">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      
      {/* Floating Glass Nodes */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] flex items-center justify-center overflow-hidden"
          style={{
            width: 140 + i * 40,
            height: 140 + i * 40,
            zIndex: 10 - i
          }}
          animate={{
            rotate: [0, 360],
            scale: [1, 1.05, 1],
            borderRadius: ['25%', '35%', '25%']
          }}
          transition={{
            rotate: { duration: 25 + i * 5, repeat: Infinity, ease: "linear", repeatType: i % 2 === 0 ? "loop" : "reverse" },
            scale: { duration: 5 + i, repeat: Infinity, ease: "easeInOut" }
          }}
        >
           <div className="w-full h-full bg-gradient-to-br from-white/40 to-transparent mix-blend-overlay" />
        </motion.div>
      ))}
      
      {/* Center Icon */}
      <div className="relative z-20 w-20 h-20 bg-white/60 backdrop-blur-2xl rounded-2xl flex items-center justify-center shadow-xl border border-white/50 group-hover:scale-110 transition-transform duration-700 ease-out">
        <RiFlashlightLine className="text-4xl text-[var(--color-charcoal)]" />
      </div>
    </div>
  );
};

const CurationGraphic = () => {
  const tags = ["Philosophy", "Jazz", "Cinema", "Architecture", "Literature", "Art", "Design", "Physics"];
  return (
    <div className="absolute inset-0 bg-gradient-to-bl from-[rgba(212,145,106,0.05)] to-[rgba(124,140,101,0.05)] flex items-center justify-center overflow-hidden group">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />

      {/* Glowing orbs */}
      <motion.div 
        animate={{ x: [-40, 40, -40], y: [-40, 40, -40], scale: [1, 1.2, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[120%] h-[120%] max-w-[500px] max-h-[500px] bg-[var(--color-peach)]/10 rounded-full blur-[80px]"
      />
      <motion.div 
        animate={{ x: [40, -40, 40], y: [40, -40, 40], scale: [1.2, 1, 1.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[100%] h-[100%] max-w-[400px] max-h-[400px] bg-[var(--color-olive)]/10 rounded-full blur-[60px]"
      />
      
      {/* Floating tags */}
      <div className="relative w-full h-full flex items-center justify-center">
        {tags.map((tag, i) => {
          const angle = (i / tags.length) * Math.PI * 2;
          const radius = 120 + ((i * 37) % 60);
          return (
            <motion.div
              key={tag}
              className="absolute px-5 py-2.5 rounded-full border border-white/40 bg-white/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] text-sm text-[var(--color-charcoal)] font-semibold whitespace-nowrap hover:bg-white/70 transition-colors cursor-default"
              initial={{ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }}
              animate={{ 
                x: [Math.cos(angle) * radius, Math.cos(angle + 1) * radius, Math.cos(angle) * radius],
                y: [Math.sin(angle) * radius, Math.sin(angle + 1) * radius, Math.sin(angle) * radius],
              }}
              transition={{ duration: 20 + i * 3, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.1, zIndex: 50 }}
            >
              {tag}
            </motion.div>
          );
        })}
        <div className="absolute z-10 w-24 h-24 rounded-full bg-white/80 backdrop-blur-2xl shadow-2xl flex items-center justify-center border border-white/50 group-hover:scale-110 transition-transform duration-700">
           <RiUserSmileLine className="text-4xl text-[var(--color-charcoal)]" />
        </div>
      </div>
    </div>
  );
};

const SecrecyGraphic = () => {
  return (
    <div className="absolute inset-0 bg-[var(--color-charcoal)] flex items-center justify-center overflow-hidden group">
      <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay pointer-events-none" />
      
      {/* Dynamic Rings */}
      {[...Array(3)].map((_, i) => (
        <motion.div 
          key={i}
          animate={{ scale: [1, 1.5 + i * 0.2, 1], opacity: [0.1, 0, 0.1], rotate: [0, 180, 360] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-48 h-48 rounded-full border border-[var(--color-ivory)]/20"
          style={{ borderStyle: i % 2 === 0 ? 'dashed' : 'solid' }}
        />
      ))}
      
      {/* Black Hole Core */}
      <div className="relative w-40 h-40 rounded-full bg-black/90 shadow-[0_0_80px_40px_rgba(0,0,0,0.9)] border border-white/10 flex items-center justify-center overflow-hidden z-10 group-hover:shadow-[0_0_100px_50px_rgba(0,0,0,1)] transition-shadow duration-700">
         {/* Absorbing particles */}
         {[...Array(15)].map((_, i) => (
           <motion.div
             key={i}
             className="absolute w-1 h-1 bg-[var(--color-ivory)] rounded-full blur-[1px]"
             initial={{ 
               x: (((i * 73) % 200) - 100), 
               y: (((i * 97) % 200) - 100),
               opacity: 0
             }}
             animate={{ 
               x: 0, 
               y: 0,
               opacity: [0, 0.8, 0],
               scale: [1, 0]
             }}
             transition={{ 
               duration: 1.5 + ((i * 11) % 20) / 10, 
               repeat: Infinity, 
               delay: ((i * 13) % 20) / 10,
               ease: "easeIn"
             }}
           />
         ))}
         <RiLockPasswordLine className="text-4xl text-[var(--color-gray-light)] z-20 group-hover:text-[var(--color-ivory)] group-hover:scale-110 transition-all duration-700" />
      </div>
    </div>
  );
};

export default function Home() {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/stats";
    fetch(API_URL)
      .then(res => res.json())
      .then(data => setOnlineCount(data.online))
      .catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center selection:bg-[var(--color-charcoal)] selection:text-[var(--color-ivory)]"
      style={{ backgroundColor: "var(--color-ivory)" }}
      ref={containerRef}>
      
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ParticleBackground />
      </div>

      {/* Editorial Vignette */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-radial from-transparent to-[var(--color-ivory)] opacity-60 mix-blend-multiply" />

      {/* ── Navbar ── */}
      <motion.nav 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 w-full px-8 md:px-16 py-8 flex justify-between items-center z-50 bg-gradient-to-b from-[var(--color-ivory)] to-transparent"
      >
        <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ textDecoration: 'none' }}>
          <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--color-charcoal)" }}>
            Cone<span style={{ color: "var(--color-peach)", fontStyle: "italic" }}>x</span>ion
          </span>
          <span className="text-[10px] font-sans font-bold uppercase tracking-widest bg-[var(--color-olive)]/20 text-[var(--color-olive)] px-2 py-0.5 rounded-full mt-1">
            Beta
          </span>
        </Link>
        <div className="flex items-center gap-8">
          {onlineCount !== null && (
            <div className="hidden md:flex items-center gap-3 bg-white/40 backdrop-blur-md px-4 py-2 rounded-full border border-[var(--color-border)]">
              <span className="status-dot" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--color-gray-brown)]">{onlineCount} Online</span>
            </div>
          )}
          <Link href="/launch">
            <MagneticButton className="relative overflow-hidden group rounded-full bg-[var(--color-charcoal)] text-[var(--color-ivory)] px-8 py-3 text-sm font-medium transition-transform duration-500 ease-out">
              <span className="relative z-10 flex items-center gap-2">Join Waitlist <RiArrowRightLine className="group-hover:translate-x-1 transition-transform" /></span>
              <div className="absolute inset-0 bg-[var(--color-gray-brown)] translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[0.16,1,0.3,1] z-0" />
            </MagneticButton>
          </Link>
        </div>
      </motion.nav>

      <div className="w-full flex-1 relative z-10 flex flex-col pt-32 pb-24">
        
        {/* ── Hero ── */}
        <motion.section 
          style={{ y: heroY, opacity: heroOpacity }}
          className="min-h-[85vh] flex flex-col justify-center items-center text-center px-6 relative"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 overflow-hidden rounded-full border border-[var(--color-border)] px-6 py-2 bg-white/40 backdrop-blur-md inline-flex items-center gap-3"
          >
             <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gray-brown)]">Anonymous</span>
             <span className="w-1 h-1 rounded-full bg-[var(--color-gray-light)]" />
             <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gray-brown)]">Encrypted</span>
             <span className="w-1 h-1 rounded-full bg-[var(--color-gray-light)]" />
             <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-gray-brown)]">Instant</span>
          </motion.div>

          <h1 className="text-6xl sm:text-8xl md:text-[9rem] leading-[0.9] tracking-tighter text-[var(--color-charcoal)] mb-8 max-w-6xl">
            <FadeUpText text="The Art of" />
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, color: "var(--color-gray-brown)" }}>
              <FadeUpText text="Connection" delay={0.2} />
            </span>
          </h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl text-[var(--color-gray-brown)] max-w-2xl font-light leading-relaxed mb-16"
          >
            A serene space to meet fascinating minds from across the globe. No profiles, no history, just pure, ephemeral conversation.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row gap-6 w-full max-w-xl"
          >
            <Link href="/chat?mode=text" className="flex-1 group">
              <div className="warm-panel h-full flex items-center justify-between p-6 transition-all duration-500 hover:bg-[var(--color-beige)] hover:shadow-xl hover:-translate-y-1">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-ivory)] flex items-center justify-center text-[var(--color-charcoal)] shadow-sm border border-[var(--color-border)] group-hover:scale-110 transition-transform duration-500">
                    <RiMessage3Line className="text-xl" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-[var(--color-charcoal)]">Text Studio</h3>
                    <p className="text-xs text-[var(--color-gray-light)]">Distraction-free typing</p>
                  </div>
                </div>
                <RiArrowRightLine className="text-[var(--color-gray-light)] group-hover:text-[var(--color-charcoal)] group-hover:translate-x-2 transition-all duration-500" />
              </div>
            </Link>

            <Link href="/chat?mode=video" className="flex-1 group">
              <div className="warm-panel h-full flex items-center justify-between p-6 transition-all duration-500 hover:bg-[var(--color-charcoal)] hover:shadow-xl hover:-translate-y-1">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-charcoal-80)] flex items-center justify-center text-[var(--color-ivory)] group-hover:bg-[var(--color-ivory)] group-hover:text-[var(--color-charcoal)] transition-colors duration-500">
                    <RiVideoChatLine className="text-xl" />
                  </div>
                  <div className="text-left group-hover:text-[var(--color-ivory)] transition-colors duration-500">
                    <h3 className="font-semibold text-[var(--color-charcoal)] group-hover:text-[var(--color-ivory)] transition-colors">Video Lounge</h3>
                    <p className="text-xs text-[var(--color-gray-light)] group-hover:text-white/60 transition-colors">Face-to-face encounters</p>
                  </div>
                </div>
                <RiArrowRightLine className="text-[var(--color-gray-light)] group-hover:text-[var(--color-ivory)] group-hover:translate-x-2 transition-all duration-500" />
              </div>
            </Link>
          </motion.div>
        </motion.section>

        {/* ── Abstract Divider ── */}
        <div className="w-full flex justify-center py-20 overflow-hidden">
          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="h-px bg-[var(--color-border)] w-full max-w-6xl mx-auto origin-left"
          />
        </div>

        {/* ── Feature 1: The Canvas ── */}
        <section className="min-h-[80vh] flex items-center py-20 px-6 md:px-16 w-full max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="order-2 lg:order-1 relative h-[500px] w-full rounded-[2rem] overflow-hidden warm-panel p-0 border-[var(--color-border)] shadow-xl group">
              <ArchitectureGraphic />
            </div>
            
            <div className="order-1 lg:order-2 space-y-8">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--color-gray-brown)]">01 — Architecture</span>
              <h2 className="text-5xl md:text-6xl text-[var(--color-charcoal)] leading-tight">
                Peer-to-peer <br/>
                <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--color-gray-brown)" }}>perfection.</span>
              </h2>
              <p className="text-lg text-[var(--color-gray-brown)] leading-relaxed font-light max-w-md">
                Experience latency so low it feels like they're in the room with you. By utilizing raw WebRTC connections, your audio and video streams bypass intermediate servers entirely.
              </p>
              <div className="h-px w-12 bg-[var(--color-charcoal)]" />
            </div>
          </div>
        </section>

        {/* ── Feature 2: Serendipity ── */}
        <section className="min-h-[80vh] flex items-center py-20 px-6 md:px-16 w-full max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="space-y-8">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--color-gray-brown)]">02 — Curation</span>
              <h2 className="text-5xl md:text-6xl text-[var(--color-charcoal)] leading-tight">
                Filtered <br/>
                <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--color-gray-brown)" }}>serendipity.</span>
              </h2>
              <p className="text-lg text-[var(--color-gray-brown)] leading-relaxed font-light max-w-md">
                Don't leave it entirely to chance. Select your aesthetic, enter your interests, and let our algorithm pair you with someone whose mind resonates with yours.
              </p>
              <div className="flex gap-3 flex-wrap max-w-md">
                {["Art", "Philosophy", "Cinema", "Design"].map((tag, i) => (
                  <motion.span 
                    key={tag}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 + 0.5 }}
                    className="px-4 py-2 rounded-full border border-[var(--color-border)] text-xs text-[var(--color-charcoal)] bg-white/50"
                  >
                    {tag}
                  </motion.span>
                ))}
              </div>
            </div>

            <div className="relative h-[500px] w-full rounded-[2rem] overflow-hidden warm-panel p-0 border-[var(--color-border)] shadow-xl group">
              <CurationGraphic />
            </div>
          </div>
        </section>

        {/* ── Feature 3: The Void ── */}
        <section className="min-h-[80vh] flex items-center py-20 px-6 md:px-16 w-full max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="order-2 lg:order-1 relative h-[500px] w-full rounded-[2rem] overflow-hidden shadow-2xl group border border-transparent hover:border-[var(--color-charcoal-80)] transition-colors duration-500">
              <SecrecyGraphic />
            </div>

            <div className="order-1 lg:order-2 space-y-8">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--color-gray-brown)]">03 — Secrecy</span>
              <h2 className="text-5xl md:text-6xl text-[var(--color-charcoal)] leading-tight">
                Leave <br/>
                <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--color-gray-brown)" }}>no trace.</span>
              </h2>
              <p className="text-lg text-[var(--color-gray-brown)] leading-relaxed font-light max-w-md">
                Once a connection is severed, it dissolves into the ether. No logs, no history, no archives. What is said in the room, stays in the room—until the room ceases to exist.
              </p>
              <Link href="/privacy" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-charcoal)] hover:text-[var(--color-peach)] transition-colors group">
                Read our Privacy Manifesto <RiArrowRightLine className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

      </div>

      {/* Live Chat Floating Button */}
      <AnimatePresence>
        {onlineCount !== null && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 1 }}
            className="fixed bottom-6 right-6 z-[100]"
          >
            <Link href="/world" className="group flex flex-col items-end relative">
              {/* Tooltip / Note */}
              <div className="absolute bottom-full right-0 mb-4 bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-[var(--color-border)] opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none transform origin-bottom-right group-hover:-translate-y-2">
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-charcoal)] mb-1">Enter World Chat</span>
                  <span className="text-[10px] text-[var(--color-gray-brown)]">Talk with everyone online</span>
                </div>
                {/* Arrow */}
                <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white/90 border-b border-r border-[var(--color-border)] rotate-45" />
              </div>
              
              {/* Button */}
              <div className="relative w-16 h-16 bg-[var(--color-charcoal)] rounded-full shadow-2xl flex items-center justify-center text-[var(--color-ivory)] group-hover:scale-110 transition-transform duration-300 hover:shadow-[0_10px_40px_rgba(30,25,20,0.3)]">
                <RiMessage3Line className="text-2xl" />
                
                {/* Badge showing online count */}
                <div className="absolute -top-2 -right-2 bg-[var(--color-peach)] text-white text-[11px] font-bold px-2.5 py-1 rounded-full border-[3px] border-[var(--color-ivory)] shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {onlineCount}
                </div>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
