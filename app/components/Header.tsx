"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "motion/react";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-500 ${scrolled
          ? "bg-[#070414]/85 backdrop-blur-2xl border-b border-white/[0.08] shadow-2xl shadow-black/40"
          : "bg-transparent"
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20 sm:h-26">
          {/* Logo & Brand */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex items-center gap-3 sm:gap-4.5"
          >
            <div className="relative w-12 h-12 sm:w-15 sm:h-15 rounded-2xl overflow-hidden border border-white/15 shadow-xl shadow-primary/20 bg-white/5 flex-shrink-0">
              <Image
                src="/Loopin-Live-Logo.png"
                alt="LoopinLive Logo"
                fill
                sizes="(max-width: 640px) 48px, 60px"
                className="object-cover"
                priority
              />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-baseline">
                <span className="text-2xl sm:text-4xl font-black tracking-tight gradient-text">
                  LoopinLive
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-2 w-2 rounded-full bg-lime-500 animate-pulse" />
                <span className="text-[9px] sm:text-[10px] font-bold tracking-widest uppercase text-lime-400">
                 WATCH LIVE
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
