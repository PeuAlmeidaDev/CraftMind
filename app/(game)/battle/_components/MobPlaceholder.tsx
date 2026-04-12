"use client";

// ---------------------------------------------------------------------------
// Tier gradient map — visual placeholder for mob portrait
// ---------------------------------------------------------------------------

const TIER_GRADIENTS: Record<number, string> = {
  1: "from-stone-700 to-stone-900",
  2: "from-emerald-800 to-emerald-950",
  3: "from-blue-800 to-blue-950",
  4: "from-purple-800 to-purple-950",
  5: "from-amber-700 to-amber-950",
};

type MobPlaceholderProps = {
  name: string;
  tier: number;
};

export default function MobPlaceholder({ name, tier }: MobPlaceholderProps) {
  const gradient = TIER_GRADIENTS[tier] ?? TIER_GRADIENTS[1];
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={`flex h-48 items-center justify-center rounded-t-[14px] bg-gradient-to-b ${gradient}`}
    >
      <span
        className="text-6xl text-white/30"
        style={{ fontFamily: "var(--font-cinzel)" }}
      >
        {initial}
      </span>
    </div>
  );
}
