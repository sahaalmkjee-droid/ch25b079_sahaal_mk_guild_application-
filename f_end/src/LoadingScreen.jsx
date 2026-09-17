import React, { useState, useEffect } from 'react';
import ParticleText from './components/ParticleText';

export default function LoadingScreen({
  title = 'Starting Sahaal',
  subtitle = '',
  mode = 'startup',
  onComplete
}) {
  const [isExiting, setIsExiting] = useState(false);

  // 800ms gather → text fully formed → 2500ms static hold → fade to app (3300ms total)
  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => { if (onComplete) onComplete(); }, 300);
    }, 3300);
    return () => clearTimeout(exitTimer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center select-none
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
      style={{ background: '#09090f' }}
    >
      {/* Subtle ambient glow rings — purely decorative */}
      <div
        className="absolute rounded-full pointer-events-none animate-pulse"
        style={{
          width: 520, height: 520,
          background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 320, height: 320,
          background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)'
        }}
      />

      {/* ParticleText fills the entire screen — particles spell "Sahaal." */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <ParticleText
          text="Sahaal."
          particleSize={2.2}
          /* density=8 → sampling step doubled → ~½ the default particle count */
          density={8}
          color="#ffffff"
          highlightColor="#38bdf8"
          scatter={200}
          gatherDuration={800}
          stagger={190}
          pointerRepel={50}
          repelRadius={130}
          idleDrift={0.8}
          trigger="hover"
          fontSize="clamp(4rem, 14vw, 9rem)"
          fontWeight={900}
          fontFamily="inherit"
          glow
        />
      </div>

      {/* Bottom hint label */}
      <div
        className={`absolute bottom-8 left-0 right-0 flex flex-col items-center gap-1
          transition-opacity duration-400
          ${isExiting ? 'opacity-0' : 'opacity-100'}`}
        style={{ transitionDelay: isExiting ? '0ms' : '900ms' }}
      >
        <span className="text-zinc-500 font-mono text-xs tracking-widest uppercase">
          Career Intelligence Engine
        </span>
      </div>
    </div>
  );
}
