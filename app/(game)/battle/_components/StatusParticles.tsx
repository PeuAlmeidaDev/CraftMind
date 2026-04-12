"use client";

type StatusParticlesProps = { status: string };

const BURN_PARTICLES = [
  { left: "15%", delay: "0s" },
  { left: "30%", delay: "0.2s" },
  { left: "50%", delay: "0.5s" },
  { left: "65%", delay: "0.7s" },
  { left: "80%", delay: "1s" },
];

const FROZEN_PARTICLES = [
  { left: "20%", delay: "0s" },
  { left: "35%", delay: "0.3s" },
  { left: "50%", delay: "0.6s" },
  { left: "65%", delay: "0.9s" },
  { left: "80%", delay: "0.4s" },
];

const POISON_PARTICLES = [
  { left: "25%", delay: "0s" },
  { left: "40%", delay: "0.3s" },
  { left: "60%", delay: "0.6s" },
  { left: "75%", delay: "0.9s" },
];

const STUN_PARTICLES = [
  { left: "20%", top: "20%", delay: "0s" },
  { left: "60%", top: "15%", delay: "0.25s" },
  { left: "40%", top: "50%", delay: "0.5s" },
  { left: "75%", top: "45%", delay: "0.75s" },
];

const SLOW_PARTICLES = [
  { top: "25%", delay: "0s" },
  { top: "50%", delay: "0.6s" },
  { top: "75%", delay: "1.2s" },
];

export default function StatusParticles({ status }: StatusParticlesProps) {
  switch (status) {
    case "BURN":
      return (
        <>
          {BURN_PARTICLES.map((p, i) => (
            <div
              key={i}
              className="absolute bottom-0 w-[2px] h-[6px] bg-orange-400 rounded-full animate-burn-rise"
              style={{ left: p.left, animationDelay: p.delay }}
            />
          ))}
          <style jsx>{`
            @keyframes burnRise {
              0% { opacity: 0.8; transform: translateY(0) scale(1); }
              100% { opacity: 0; transform: translateY(-40px) scale(0.5); }
            }
            :global(.animate-burn-rise) {
              animation: burnRise 1.2s ease-out infinite;
            }
          `}</style>
        </>
      );

    case "FROZEN":
      return (
        <>
          {FROZEN_PARTICLES.map((p, i) => (
            <div
              key={i}
              className="absolute top-0 w-[4px] h-[4px] bg-cyan-300 rounded-full animate-frost-fall"
              style={{ left: p.left, animationDelay: p.delay }}
            />
          ))}
          <style jsx>{`
            @keyframes frostFall {
              0% { opacity: 0.9; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(40px); }
            }
            :global(.animate-frost-fall) {
              animation: frostFall 1.5s ease-in infinite;
            }
          `}</style>
        </>
      );

    case "POISON":
      return (
        <>
          {POISON_PARTICLES.map((p, i) => (
            <div
              key={i}
              className="absolute bottom-0 w-[5px] h-[5px] bg-green-400 rounded-full animate-poison-bubble"
              style={{ left: p.left, animationDelay: p.delay }}
            />
          ))}
          <style jsx>{`
            @keyframes poisonBubble {
              0% { opacity: 0.8; transform: translateY(0) scale(1); }
              100% { opacity: 0; transform: translateY(-35px) scale(1.3); }
            }
            :global(.animate-poison-bubble) {
              animation: poisonBubble 1.3s ease-out infinite;
            }
          `}</style>
        </>
      );

    case "STUN":
      return (
        <>
          {STUN_PARTICLES.map((p, i) => (
            <span
              key={i}
              className="absolute text-amber-400 text-xs font-bold animate-stun-spin"
              style={{ left: p.left, top: p.top, animationDelay: p.delay }}
            >
              *
            </span>
          ))}
          <style jsx>{`
            @keyframes stunSpin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            :global(.animate-stun-spin) {
              animation: stunSpin 1s linear infinite;
            }
          `}</style>
        </>
      );

    case "SLOW":
      return (
        <>
          {SLOW_PARTICLES.map((p, i) => (
            <div
              key={i}
              className="absolute left-[10%] w-[80%] h-[2px] bg-blue-400/50 rounded-full animate-slow-wave"
              style={{ top: p.top, animationDelay: p.delay }}
            />
          ))}
          <style jsx>{`
            @keyframes slowWave {
              0%, 100% { transform: translateX(-10px); opacity: 0.3; }
              50% { transform: translateX(10px); opacity: 0.7; }
            }
            :global(.animate-slow-wave) {
              animation: slowWave 2s ease-in-out infinite;
            }
          `}</style>
        </>
      );

    default:
      return null;
  }
}
