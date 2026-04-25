"use client";

import { useRef, useState } from "react";
import { expToNextLevel } from "@/lib/exp/formulas";
import { getToken } from "@/lib/client-auth";
import Panel from "@/components/ui/Panel";
import { HOUSE_LORE, getPlayerTitle } from "@/lib/constants-house";
import type { Character } from "@/types/character";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const HOUSE_DISPLAY: Record<string, string> = {
  ARION: "Arion",
  LYCUS: "Lycus",
  NOCTIS: "Noctis",
  NEREID: "Nereid",
};

type Props = {
  profile: {
    name: string;
    avatarUrl: string | null;
    house: { name: string; animal: string } | null;
  };
  character: Character;
  onAvatarChange: (newUrl: string) => void;
};

export default function CharacterHeader({
  profile,
  character,
  onAvatarChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const expNeeded = expToNextLevel(character.level);
  const expPercent = Math.min(
    100,
    (character.currentExp / expNeeded) * 100
  );

  const initial = profile.name.charAt(0).toUpperCase();
  const houseName = profile.house?.name ?? "";
  const displayHouse = houseName.charAt(0) + houseName.slice(1).toLowerCase();
  const title = getPlayerTitle(character.level);
  const motto = houseName ? HOUSE_LORE[houseName]?.motto : undefined;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setUploadError("Formato invalido. Use JPEG, PNG ou WebP.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("Imagem muito grande. Maximo 2 MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const token = getToken() ?? "";

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        setUploadError("Falha ao enviar imagem. Tente novamente.");
        return;
      }

      const json = (await res.json()) as { data: { avatarUrl: string } };
      onAvatarChange(json.data.avatarUrl);
    } catch {
      setUploadError("Erro de conexao. Tente novamente.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  /* SVG tick lines for the level medallion */
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 360) / 24;
    return (
      <line
        key={i}
        x1="46"
        y1="4"
        x2="46"
        y2="9"
        stroke="color-mix(in srgb, var(--gold) 35%, transparent)"
        strokeWidth="1"
        transform={`rotate(${angle} 46 46)`}
      />
    );
  });

  return (
    <Panel style={{ overflow: "hidden" }}>
      <div className="p-4 sm:px-7 sm:py-6">
        {/* Watermark — house name */}
        {houseName && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap text-[120px] sm:text-[240px]"
            style={{
              fontFamily: "var(--font-cinzel)",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--ember) 4%, transparent)",
              lineHeight: 1,
            }}
          >
            {houseName}
          </span>
        )}

        <div className="relative z-10 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          {/* === Col 1: Avatar === */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] sm:h-[104px] sm:w-[104px]"
            style={{
              boxShadow: "0 0 18px color-mix(in srgb, var(--ember) 40%, transparent), inset 0 0 6px color-mix(in srgb, var(--ember) 15%, transparent)",
              border: "2px solid color-mix(in srgb, var(--ember) 50%, transparent)",
            }}
            aria-label="Alterar avatar"
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={`Avatar de ${profile.name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  background: "repeating-linear-gradient(135deg, var(--bg-secondary) 0px, var(--bg-secondary) 4px, var(--bg-card) 4px, var(--bg-card) 8px)",
                }}
              >
                <span
                  className="text-3xl sm:text-5xl"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontStyle: "italic",
                    color: "var(--ember)",
                    lineHeight: 1,
                  }}
                >
                  {initial}
                </span>
              </div>
            )}

            {/* Upload overlays */}
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <svg
                  className="h-6 w-6 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* === Col 2: Text center === */}
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
            {/* Eyebrow */}
            {profile.house && (
              <span
                className="text-center tracking-[0.3em] sm:text-left"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                }}
              >
                Casa de {displayHouse} &middot; {title}
              </span>
            )}

            {/* Player name */}
            <h2
              className="truncate text-center text-2xl leading-none sm:text-left sm:text-[34px]"
              style={{
                fontFamily: "var(--font-cormorant)",
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              {profile.name}
            </h2>

            {/* Motto */}
            {motto && (
              <p
                className="text-center leading-snug sm:text-left"
                style={{
                  fontFamily: "var(--font-garamond)",
                  fontSize: 13,
                  fontStyle: "italic",
                  color: "color-mix(in srgb, var(--ink) 50%, transparent)",
                }}
              >
                &ldquo;{motto}&rdquo;
              </p>
            )}

            {/* XP Bar */}
            <div className="mt-1 flex w-full flex-col gap-1">
              <div
                className="relative h-2 w-full overflow-hidden"
                style={{ background: "color-mix(in srgb, var(--gold) 10%, transparent)" }}
              >
                {/* Fill */}
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${expPercent}%`,
                    background: `linear-gradient(90deg, var(--gold), var(--ember))`,
                  }}
                />
                {/* Tick marks at 25%, 50%, 75% */}
                {[25, 50, 75].map((pct) => (
                  <span
                    key={pct}
                    className="absolute top-0 h-full"
                    style={{
                      left: `${pct}%`,
                      width: 1,
                      background: "color-mix(in srgb, var(--deep) 40%, transparent)",
                    }}
                  />
                ))}
              </div>
              <span
                className="text-center sm:text-left"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "color-mix(in srgb, var(--ink) 40%, transparent)",
                }}
              >
                {character.currentExp} / {expNeeded} EXP
              </span>
            </div>
          </div>

          {/* === Col 3: Level medallion === */}
          <div className="flex shrink-0 flex-col items-center gap-2 self-center sm:self-auto">
            <div
              className="relative flex h-16 w-16 items-center justify-center sm:h-[92px] sm:w-[92px]"
            >
              {/* SVG ring with ticks */}
              <svg
                viewBox="0 0 92 92"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <circle
                  cx="46"
                  cy="46"
                  r="42"
                  fill="none"
                  stroke="color-mix(in srgb, var(--gold) 25%, transparent)"
                  strokeWidth="1"
                />
                {ticks}
              </svg>

              {/* Background circle */}
              <div
                className="absolute inset-[6px] rounded-full sm:inset-[6px]"
                style={{
                  background: "radial-gradient(circle, var(--accent-primary), var(--deep))",
                  opacity: 0.15,
                }}
              />

              {/* Level content */}
              <div className="relative flex flex-col items-center">
                <span
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.3em",
                    color: "color-mix(in srgb, var(--gold) 70%, transparent)",
                  }}
                >
                  Nivel
                </span>
                <span
                  className="text-3xl leading-none sm:text-[44px]"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  {character.level}
                </span>
              </div>
            </div>

            {/* Free points badge */}
            {character.freePoints > 0 && (
              <span
                className="whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--accent-primary)",
                  animation: "freePulse 2s ease-in-out infinite",
                }}
              >
                +{character.freePoints} pts
              </span>
            )}
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <p className="relative z-10 mt-3 text-center text-xs text-red-400 sm:text-left">{uploadError}</p>
        )}

        {/* freePulse keyframe */}
        <style jsx>{`
          @keyframes freePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.08); }
          }
        `}</style>
      </div>
    </Panel>
  );
}
