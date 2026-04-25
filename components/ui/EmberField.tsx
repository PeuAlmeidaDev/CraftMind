"use client";

import { useState, useEffect } from "react";

type Ember = {
  left: number;
  dx: number;
  delay: number;
  dur: number;
  size: number;
  useGold: boolean;
};

export default function EmberField({ count = 14 }: { count?: number }) {
  const [embers, setEmbers] = useState<Ember[]>([]);

  useEffect(() => {
    setEmbers(
      Array.from({ length: count }).map(() => ({
        left: Math.random() * 100,
        dx: (Math.random() - 0.5) * 80,
        delay: Math.random() * 20,
        dur: 18 + Math.random() * 14,
        size: 1 + Math.random() * 2,
        useGold: Math.random() > 0.6,
      })),
    );
  }, [count]);

  if (embers.length === 0) return null;

  return (
    <>
      {embers.map((e, i) => (
        <span
          key={i}
          className="pointer-events-none fixed -bottom-2.5 rounded-full"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            background: e.useGold ? "var(--gold)" : "var(--ember)",
            boxShadow: `0 0 6px ${e.useGold ? "var(--gold)" : "var(--ember)"}, 0 0 12px ${e.useGold ? "var(--gold)" : "var(--ember)"}66`,
            animation: `emberDrift ${e.dur}s linear infinite`,
            animationDelay: `-${e.delay}s`,
            ["--dx" as string]: `${e.dx}px`,
            zIndex: 1,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}
