"use client";

import Image from "next/image";

// ---------------------------------------------------------------------------
// Tier gradient map — visual fallback for mob portrait
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
  imageUrl?: string | null;
};

export default function MobPlaceholder({ name, tier, imageUrl }: MobPlaceholderProps) {
  const gradient = TIER_GRADIENTS[tier] ?? TIER_GRADIENTS[1];
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={`relative w-full h-full min-h-[12rem] overflow-hidden rounded-t-[14px] bg-gradient-to-b ${gradient}`}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 640px"
          quality={90}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span
            className="text-6xl text-white/30"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            {initial}
          </span>
        </div>
      )}
    </div>
  );
}
