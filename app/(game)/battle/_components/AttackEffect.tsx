"use client";

import { useEffect, useState } from "react";

const HUE_MAP: Record<string, number> = {
  PHYSICAL: 0,
  MAGICAL: 200,
  NONE: 120,
};

type AttackEffectProps = {
  skillId: string | null;
  damageType?: string;
  visible: boolean;
  onComplete: () => void;
};

export default function AttackEffect({ skillId, damageType, visible, onComplete }: AttackEffectProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) { setShow(false); return; }
    setShow(true);
    const timer = setTimeout(() => { setShow(false); onComplete(); }, 800);
    return () => clearTimeout(timer);
  }, [visible, skillId, onComplete]);

  if (!show) return null;

  const hueValue = HUE_MAP[damageType ?? "PHYSICAL"] ?? 0;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {/* Flash de impacto */}
      <div className="absolute inset-0 impact-flash" />

      {/* Sprite do efeito */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src="/sprites/image.png"
          alt=""
          className="sprite-slash"
          style={{ filter: `hue-rotate(${hueValue}deg)` }}
        />
      </div>

      <style jsx>{`
        .impact-flash {
          background: radial-gradient(circle at center, rgba(255,255,255,0.4) 0%, transparent 70%);
          animation: impactFlash 300ms ease-out 250ms forwards;
          opacity: 0;
        }

        @keyframes impactFlash {
          0%   { opacity: 0; transform: scale(0.8); }
          30%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.4); }
        }

        .sprite-slash {
          width: 10rem;
          height: 10rem;
          animation: spriteSlash 800ms ease-out forwards;
        }

        @keyframes spriteSlash {
          0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
          35%  { transform: scale(1.1) rotate(0deg); opacity: 1; }
          50%  { transform: scale(1.2) rotate(2deg); opacity: 1; }
          65%  { transform: scale(1.05) rotate(0deg); opacity: 1; }
          100% { transform: scale(1.3) rotate(0deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
