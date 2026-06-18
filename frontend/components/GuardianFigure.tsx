'use client';

import { motion } from 'framer-motion';

/** Argus Eye — geometric surveillance symbol. Concentric rings, orbital paths, nodes. */
export default function GuardianFigure() {
  // Orbital nodes
  const orbitals = Array.from({ length: 3 }, (_, ring) =>
    Array.from({ length: 12 + ring * 6 }, (_, i) => {
      const angle = (i / (12 + ring * 6)) * Math.PI * 2;
      const radius = 90 + ring * 55;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, ring, id: i + ring * 30 };
    })
  ).flat();

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.22 }}
      transition={{ duration: 2, ease: 'easeOut' }}
    >
      <div className="relative flex items-center justify-center" style={{ width: 500, height: 500 }}>

        {/* Outer ring — slow rotation */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 420, height: 420, border: '1px solid rgba(212,175,55,0.12)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        />

        {/* Middle ring — opposite rotation */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 340, height: 340, border: '1px solid rgba(212,175,55,0.08)' }}
          animate={{ rotate: -360 }}
          transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
        />

        {/* Inner ring — pulse */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 260, height: 260, border: '1px solid rgba(212,175,55,0.1)' }}
          animate={{ scale: [1, 1.03, 1], opacity: [0.08, 0.14, 0.08] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Iris ring */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 180, height: 180, border: '2px solid rgba(212,175,55,0.15)', boxShadow: '0 0 60px rgba(212,175,55,0.08), inset 0 0 60px rgba(212,175,55,0.03)' }}
          animate={{ scale: [0.98, 1.02, 0.98] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Pupil — the focal point */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 60, height: 60, background: 'radial-gradient(circle, rgba(212,175,55,0.3) 0%, rgba(212,175,55,0.06) 60%, transparent 100%)', boxShadow: '0 0 80px rgba(212,175,55,0.15), 0 0 30px rgba(212,175,55,0.1)' }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Core */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 16, height: 16, background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(212,175,55,0.4) 40%, transparent 70%)', boxShadow: '0 0 40px rgba(212,175,55,0.4), 0 0 20px rgba(255,255,255,0.2)' }}
          animate={{ scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Orbital path lines */}
        <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 500 500">
          {[0, 60, 120, 180, 240, 300].map(angle => (
            <line
              key={angle}
              x1="250" y1="250"
              x2={250 + Math.cos(angle * Math.PI / 180) * 200}
              y2={250 + Math.sin(angle * Math.PI / 180) * 200}
              stroke="#D4AF37"
              strokeWidth="0.3"
              opacity="0.3"
            />
          ))}
        </svg>

        {/* Orbital nodes */}
        {orbitals.map(node => (
          <motion.div
            key={node.id}
            className="absolute rounded-full"
            style={{
              width: 2.5 - node.ring * 0.3,
              height: 2.5 - node.ring * 0.3,
              left: `calc(50% + ${node.x}px)`,
              top: `calc(50% + ${node.y}px)`,
              background: node.ring === 0 ? '#D4AF37' : node.ring === 1 ? '#7eb8da' : '#b57ed8',
              boxShadow: `0 0 ${4 - node.ring}px currentColor`,
              transform: 'translate(-50%, -50%)',
            }}
            animate={{ opacity: [0.2, 0.7, 0.2] }}
            transition={{
              duration: 2 + node.ring + Math.sin(node.id) * 1.5,
              repeat: Infinity,
              delay: node.id * 0.1,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Drifting particles from center */}
        {Array.from({ length: 8 }, (_, i) => (
          <motion.div
            key={`drift-${i}`}
            className="absolute rounded-full"
            style={{
              width: 2,
              height: 2,
              background: '#D4AF37',
              left: '50%',
              top: '50%',
              boxShadow: '0 0 6px rgba(212,175,55,0.4)',
            }}
            animate={{
              x: [0, Math.cos(i * 45 * Math.PI / 180) * 160, 0],
              y: [0, Math.sin(i * 45 * Math.PI / 180) * 160, 0],
              opacity: [0, 0.7, 0],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              delay: i * 1.2,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Data ring — smallest, fastest */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 120, height: 120, border: '1px dashed rgba(126,184,218,0.2)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}

