"use client";

import React from "react";

export default function BackgroundScene() {
  return (
    <div className="fixed inset-0 z-0 bg-[#030014] overflow-hidden pointer-events-none">
      {/* Deep Space / Abstract Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#070414] via-[#030014] to-black" />

      {/* Aurora / Fluid Glows */}
      <div className="absolute inset-0 opacity-60 mix-blend-screen">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vh] rounded-full bg-[#1be21b] filter blur-[120px] animate-aurora-1 opacity-50" />
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[60vh] rounded-full bg-[#06b6d4] filter blur-[130px] animate-aurora-2 opacity-40" />
        <div className="absolute bottom-[-10%] left-[10%] w-[60vw] h-[50vh] rounded-full bg-[#8b5cf6] filter blur-[140px] animate-aurora-3 opacity-30" />
      </div>

      {/* Tech Grid / Net */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #ffffff 1px, transparent 1px),
            linear-gradient(to bottom, #ffffff 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
          maskImage: "radial-gradient(circle at center, black 10%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 10%, transparent 80%)",
        }}
      />

      {/* Subtle Noise Texture for Premium Look */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <style>{`
        @keyframes aurora-1 {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          33% { transform: translate(5%, 8%) scale(1.1) rotate(3deg); }
          66% { transform: translate(-5%, 4%) scale(0.9) rotate(-3deg); }
          100% { transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        @keyframes aurora-2 {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          33% { transform: translate(-8%, -10%) scale(1.15) rotate(-5deg); }
          66% { transform: translate(4%, -5%) scale(0.85) rotate(5deg); }
          100% { transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        @keyframes aurora-3 {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          33% { transform: translate(10%, -5%) scale(1.05) rotate(3deg); }
          66% { transform: translate(-4%, -10%) scale(0.95) rotate(-3deg); }
          100% { transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        .animate-aurora-1 {
          animation: aurora-1 14s ease-in-out infinite alternate;
        }
        .animate-aurora-2 {
          animation: aurora-2 18s ease-in-out infinite alternate;
        }
        .animate-aurora-3 {
          animation: aurora-3 22s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
}
