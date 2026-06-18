'use client';

import { motion } from 'framer-motion';

export default function GuardianFigure() {
  // Generate many eyes in a circular pattern — Argus Panoptes
  const eyes = Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2;
    const radius = 180 + Math.sin(i * 0.7) * 40;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const size = 3 + Math.sin(i * 1.3) * 6;
    const delay = i * 0.15;
    const hue = 40 + Math.sin(i * 0.5) * 15;
    return { x, y, size, delay, hue, id: i };
  });

  // Inner ring — smaller, denser
  const innerEyes = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2 + 0.1;
    const radius = 110 + Math.cos(i * 1.1) * 20;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const size = 2 + Math.sin(i * 0.9) * 4;
    const delay = i * 0.2 + 0.5;
    return { x, y, size, delay, id: i + 100 };
  });

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 0.25, scale: 1 }}
      transition={{ duration: 2, ease: 'easeOut' }}
    >
      <motion.div
        className="relative"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
        style={{ width: 500, height: 500 }}
      >
        {/* Outer constellation ring */}
        <motion.div
          className="absolute inset-0 rounded-full border border-[#D4AF37]/10"
          animate={{ scale: [1, 1.02, 1], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-4 rounded-full border border-[#D4AF37]/5"
          animate={{ scale: [1, 1.01, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        {/* Grid lines — celestial navigation */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 500 500">
          <defs>
            <radialGradient id="lineGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[0, 45, 90, 135].map(angle => (
            <line key={angle} x1="250" y1="250" x2={250 + Math.cos(angle * Math.PI / 180) * 240} y2={250 + Math.sin(angle * Math.PI / 180) * 240} stroke="url(#lineGrad)" strokeWidth="0.5" />
          ))}
        </svg>

        {/* Outer eyes */}
        {eyes.map(eye => (
          <motion.div
            key={eye.id}
            className="absolute rounded-full"
            style={{
              left: `calc(50% + ${eye.x}px)`,
              top: `calc(50% + ${eye.y}px)`,
              width: eye.size,
              height: eye.size,
              background: `radial-gradient(circle, rgba(212,175,55,0.8) 0%, rgba(212,175,55,0.2) 40%, transparent 70%)`,
              boxShadow: `0 0 ${eye.size * 3}px rgba(212,175,55,0.3)`,
              transform: 'translate(-50%, -50%)',
            }}
            animate={{
              opacity: [0.2, 0.7, 0.2],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 2 + Math.sin(eye.id) * 2,
              repeat: Infinity,
              delay: eye.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Inner eyes */}
        {innerEyes.map(eye => (
          <motion.div
            key={eye.id}
            className="absolute rounded-full"
            style={{
              left: `calc(50% + ${eye.x}px)`,
              top: `calc(50% + ${eye.y}px)`,
              width: eye.size,
              height: eye.size,
              background: `radial-gradient(circle, rgba(62,184,255,0.6) 0%, rgba(126,184,218,0.15) 50%, transparent 80%)`,
              boxShadow: `0 0 ${eye.size * 2}px rgba(126,184,218,0.2)`,
              transform: 'translate(-50%, -50%)',
            }}
            animate={{
              opacity: [0.3, 0.8, 0.3],
              scale: [0.9, 1.1, 0.9],
            }}
            transition={{
              duration: 1.5 + Math.sin(eye.id) * 1.5,
              repeat: Infinity,
              delay: eye.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Central eye — the main guardian */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            className="rounded-full"
            style={{
              width: 60,
              height: 60,
              background: 'radial-gradient(circle, rgba(212,175,55,0.5) 0%, rgba(212,175,55,0.15) 40%, transparent 70%)',
              boxShadow: '0 0 80px rgba(212,175,55,0.3), 0 0 40px rgba(212,175,55,0.2)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 20,
              height: 20,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(212,175,55,0.6) 50%, transparent 70%)',
              boxShadow: '0 0 30px rgba(212,175,55,0.6)',
            }}
          />
        </motion.div>

        {/* Orbital floating particles */}
        {Array.from({ length: 12 }, (_, i) => (
          <motion.div
            key={`orb-${i}`}
            className="absolute rounded-full"
            style={{
              width: 2,
              height: 2,
              background: '#D4AF37',
              left: '50%',
              top: '50%',
            }}
            animate={{
              x: [0, Math.cos(i * (Math.PI * 2) / 12) * 200, 0],
              y: [0, Math.sin(i * (Math.PI * 2) / 12) * 200, 0],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.8,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
