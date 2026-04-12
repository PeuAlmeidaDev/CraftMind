"use client";

import { useState, useEffect, useRef } from "react";

type DefeatSequenceProps = {
  active: boolean;
  onComplete: () => void;
};

type Phase = "idle" | "grayscale" | "shatter" | "dissolve";

export default function DefeatSequence({ active, onComplete }: DefeatSequenceProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) { setPhase("idle"); return; }

    setPhase("grayscale");
    const t1 = setTimeout(() => setPhase("shatter"), 600);
    const t2 = setTimeout(() => setPhase("dissolve"), 1400);
    const t3 = setTimeout(() => onCompleteRef.current(), 2200);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  if (phase === "idle") return null;

  return (
    <>
      {/* Escurecimento gradual */}
      <div className="absolute inset-0 pointer-events-none z-30 defeat-darken" />

      {/* Pulse vermelho quando quebra */}
      {(phase === "shatter" || phase === "dissolve") && (
        <div className="absolute inset-0 pointer-events-none z-31 defeat-red-pulse" />
      )}

      {/* Linhas de rachadura — CSS puro com gradientes */}
      {(phase === "shatter" || phase === "dissolve") && (
        <div className="absolute inset-0 pointer-events-none z-32 overflow-hidden">
          <div className="crack crack-1" />
          <div className="crack crack-2" />
          <div className="crack crack-3" />
          <div className="crack crack-4" />
          <div className="crack crack-5" />
        </div>
      )}

      {/* Dissolucao final — particulas subindo */}
      {phase === "dissolve" && (
        <div className="absolute inset-0 pointer-events-none z-33 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="dissolve-particle"
              style={{
                left: `${5 + (i * 4.7) % 90}%`,
                bottom: `${10 + (i * 7) % 60}%`,
                animationDelay: `${(i * 40) % 300}ms`,
                width: `${3 + (i % 3) * 2}px`,
                height: `${3 + (i % 3) * 2}px`,
              }}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .defeat-darken {
          background: rgba(0, 0, 0, 0);
          animation: darkenIn 0.6s ease-out forwards;
        }
        @keyframes darkenIn {
          to { background: rgba(0, 0, 0, 0.4); }
        }

        .defeat-red-pulse {
          background: radial-gradient(ellipse at center, rgba(239,68,68,0.25) 0%, transparent 70%);
          animation: redPulse 0.8s ease-out forwards;
        }
        @keyframes redPulse {
          0% { opacity: 0; transform: scale(0.5); }
          30% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.3); }
        }

        .crack {
          position: absolute;
          background: linear-gradient(90deg, transparent, rgba(239,68,68,0.6) 20%, rgba(251,191,36,0.9) 50%, rgba(239,68,68,0.6) 80%, transparent);
          box-shadow: 0 0 8px 2px rgba(239,68,68,0.4), 0 0 2px 1px rgba(251,191,36,0.6);
          transform-origin: center;
          opacity: 0;
          border-radius: 1px;
        }

        .crack-1 {
          width: 120%;
          height: 2px;
          top: 35%;
          left: -10%;
          transform: rotate(-20deg);
          animation: crackAppear 0.3s ease-out 0s forwards;
        }
        .crack-2 {
          width: 100%;
          height: 2px;
          top: 55%;
          left: 0;
          transform: rotate(15deg);
          animation: crackAppear 0.3s ease-out 0.1s forwards;
        }
        .crack-3 {
          width: 80%;
          height: 1.5px;
          top: 25%;
          left: 15%;
          transform: rotate(-45deg);
          animation: crackAppear 0.3s ease-out 0.15s forwards;
        }
        .crack-4 {
          width: 70%;
          height: 1.5px;
          top: 70%;
          left: 10%;
          transform: rotate(30deg);
          animation: crackAppear 0.3s ease-out 0.2s forwards;
        }
        .crack-5 {
          width: 60%;
          height: 1px;
          top: 45%;
          left: 25%;
          transform: rotate(-60deg);
          animation: crackAppear 0.3s ease-out 0.25s forwards;
        }

        @keyframes crackAppear {
          0% { opacity: 0; transform: rotate(var(--r, 0deg)) scaleX(0); }
          50% { opacity: 1; }
          100% { opacity: 1; transform: rotate(var(--r, 0deg)) scaleX(1); }
        }

        .crack-1 { --r: -20deg; }
        .crack-2 { --r: 15deg; }
        .crack-3 { --r: -45deg; }
        .crack-4 { --r: 30deg; }
        .crack-5 { --r: -60deg; }

        .dissolve-particle {
          position: absolute;
          background: rgba(251,191,36,0.8);
          border-radius: 50%;
          box-shadow: 0 0 4px 1px rgba(239,68,68,0.5);
          opacity: 0;
          animation: dissolveUp 0.8s ease-out forwards;
        }

        @keyframes dissolveUp {
          0% { opacity: 0; transform: translateY(0) scale(1); }
          20% { opacity: 0.9; }
          100% { opacity: 0; transform: translateY(-60px) scale(0.3); }
        }
      `}</style>
    </>
  );
}
