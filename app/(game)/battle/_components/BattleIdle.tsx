"use client";

import { useRouter } from "next/navigation";
import { HOUSE_LORE } from "@/lib/constants-house";

type BattleIdleProps = {
  onStart: () => void;
  loading: boolean;
  playerName: string | null;
  houseName: string | null;
};

/* ── Mode card data ────────────────────────────────────────── */

type ModeCard = {
  glyph: string;
  glyphSize?: number;
  subtitle: string;
  name: string;
  tag: { label: string; color: string; border: string };
  intensity: number;
  description: string;
  allies: number;
  enemies: number;
  buttonLabel: string;
  loadingLabel?: string;
  featured?: boolean;
};

const MODES: ModeCard[] = [
  {
    glyph: "⚔",
    glyphSize: 42,
    subtitle: "PVE · DUELO SOLO",
    name: "Duelo Solitário",
    tag: {
      label: "CLÁSSICO",
      color: "color-mix(in srgb, var(--gold) 80%, transparent)",
      border: "color-mix(in srgb, var(--gold) 40%, transparent)",
    },
    intensity: 3,
    description:
      "Enfrente um monstro em combate por turnos. Ganhe experiência e evolua seu personagem.",
    allies: 1,
    enemies: 1,
    buttonLabel: "Entrar em Combate",
    loadingLabel: "Procurando...",
    featured: true,
  },
  {
    glyph: "☠",
    subtitle: "PVE · MÚLTIPLOS",
    name: "Multi Mobs",
    tag: {
      label: "DESAFIO",
      color: "#ff8a70",
      border: "#ff8a7055",
    },
    intensity: 4,
    description:
      "Enfrente 3 ou 5 mobs simultaneamente. Escolha seus alvos com estratégia.",
    allies: 1,
    enemies: 3,
    buttonLabel: "Enfrentar Horda",
  },
  {
    glyph: "⚑",
    subtitle: "COOP · 2 JOGADORES",
    name: "Coop PvE",
    tag: {
      label: "COOP",
      color: "#8fa8ff",
      border: "#8fa8ff55",
    },
    intensity: 4,
    description:
      "Junte forças com um aliado para enfrentar mobs em combate cooperativo.",
    allies: 2,
    enemies: 3,
    buttonLabel: "Reunir Aliado",
  },
  {
    glyph: "⚔",
    glyphSize: 36,
    subtitle: "PVP · EQUIPE 2v2",
    name: "PvP Team",
    tag: {
      label: "PVP",
      color: "#f87171",
      border: "#f8717155",
    },
    intensity: 5,
    description:
      "Forme uma dupla e enfrente outros jogadores em batalha por turnos 2 contra 2.",
    allies: 2,
    enemies: 2,
    buttonLabel: "Entrar na Arena",
  },
];

/* ── Sub-components ────────────────────────────────────────── */

function CornerTicks() {
  const style =
    "absolute w-[12px] h-[12px] pointer-events-none";
  const borderColor = "color-mix(in srgb, var(--gold) 40%, transparent)";

  return (
    <>
      <span
        className={`${style} top-0 left-0`}
        style={{ borderTop: `1px solid ${borderColor}`, borderLeft: `1px solid ${borderColor}` }}
      />
      <span
        className={`${style} top-0 right-0`}
        style={{ borderTop: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}` }}
      />
      <span
        className={`${style} bottom-0 left-0`}
        style={{ borderBottom: `1px solid ${borderColor}`, borderLeft: `1px solid ${borderColor}` }}
      />
      <span
        className={`${style} bottom-0 right-0`}
        style={{ borderBottom: `1px solid ${borderColor}`, borderRight: `1px solid ${borderColor}` }}
      />
    </>
  );
}

function IntensityMeter({ level }: { level: number }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <span
        className="uppercase tracking-[0.22em]"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "8px",
          color: "color-mix(in srgb, var(--gold) 60%, transparent)",
        }}
      >
        Intensidade
      </span>
      <div className="flex gap-[3px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="block rounded-[1px]"
            style={{
              width: "8px",
              height: "3px",
              background:
                i < level
                  ? "linear-gradient(90deg, var(--gold), var(--ember))"
                  : "color-mix(in srgb, var(--gold) 14%, transparent)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function FormationIcon({ allies, enemies }: { allies: number; enemies: number }) {
  return (
    <div
      className="flex items-center justify-center gap-[10px] rounded-md py-[8px] px-[12px]"
      style={{
        background: "linear-gradient(180deg, color-mix(in srgb, var(--gold) 4%, transparent) 0%, transparent 100%)",
      }}
    >
      {/* Allies */}
      <div className="flex gap-[4px]">
        {Array.from({ length: allies }).map((_, i) => (
          <span
            key={i}
            className="block rounded-full"
            style={{
              width: "11px",
              height: "11px",
              background: "var(--ember)",
              boxShadow: "0 0 4px color-mix(in srgb, var(--ember) 40%, transparent)",
            }}
          />
        ))}
      </div>

      {/* Separator */}
      <span
        style={{
          fontFamily: "var(--font-cinzel)",
          fontSize: "11px",
          color: "color-mix(in srgb, var(--gold) 40%, transparent)",
        }}
      >
        ·vs·
      </span>

      {/* Enemies */}
      <div className="flex gap-[4px]">
        {Array.from({ length: enemies }).map((_, i) => (
          <span
            key={i}
            className="block rounded-full"
            style={{
              width: "9px",
              height: "9px",
              background: "var(--gold)",
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
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
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ── Main component ────────────────────────────────────────── */

export default function BattleIdle({
  onStart,
  loading,
  playerName,
  houseName,
}: BattleIdleProps) {
  const router = useRouter();

  const handleClick = (mode: ModeCard) => {
    if (mode.featured) {
      onStart();
    } else if (mode.name === "Multi Mobs") {
      router.push("/battle-multi");
    } else if (mode.name === "PvP Team") {
      router.push("/pvp-team");
    } else {
      router.push("/coop-pve");
    }
  };

  const motto =
    HOUSE_LORE[houseName ?? ""]?.motto ??
    "O conhecimento e a chave, a disciplina e o caminho";

  return (
    <div className="flex flex-col items-center w-full max-w-[1060px] mx-auto px-4 py-10 gap-10">
      {/* ── Hero ──────────────────────────────────────────── */}
      <header className="text-center flex flex-col items-center gap-3">
        <span
          className="uppercase tracking-[0.4em]"
          style={{
            fontFamily: "var(--font-cinzel)",
            fontSize: "10px",
            color: "color-mix(in srgb, var(--gold) 80%, transparent)",
          }}
        >
          Câmara de Guerra · {playerName ?? "Aventureiro"}
        </span>

        <h1
          className="font-medium text-white"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "clamp(32px, 5vw, 52px)",
            lineHeight: 1.1,
          }}
        >
          Escolha seu destino
        </h1>

        <p
          className="italic"
          style={{
            fontFamily: "var(--font-garamond)",
            fontSize: "15px",
            color: "color-mix(in srgb, var(--accent-primary) 85%, transparent)",
          }}
        >
          &laquo; Cada porta é um caminho. Cada caminho cobra um preço. &raquo;
        </p>
      </header>

      {/* ── Mode cards grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 min-[960px]:grid-cols-3 gap-5 w-full">
        {MODES.map((mode) => {
          const isFeatured = mode.featured === true;
          const isDisabled = isFeatured && loading;

          return (
            <article
              key={mode.name}
              className={`
                relative flex flex-col gap-[12px] rounded-md
                ${isFeatured ? "min-[960px]:col-span-2" : ""}
              `}
              style={{
                background:
                  "linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
                border: isFeatured
                  ? "1px solid color-mix(in srgb, var(--ember) 53%, transparent)"
                  : "1px solid color-mix(in srgb, var(--gold) 14%, transparent)",
                padding: "18px",
                minHeight: "280px",
                boxShadow: isFeatured
                  ? "0 0 24px color-mix(in srgb, var(--ember) 12%, transparent)"
                  : "none",
              }}
            >
              <CornerTicks />

              {/* Featured badge */}
              {isFeatured && (
                <span
                  className="absolute top-[10px] right-[10px] uppercase"
                  style={{
                    fontFamily: "var(--font-cinzel)",
                    fontSize: "8px",
                    letterSpacing: "0.2em",
                    color: "var(--ember)",
                    border: "1px solid color-mix(in srgb, var(--ember) 50%, transparent)",
                    background: "color-mix(in srgb, var(--ember) 7%, transparent)",
                    padding: "2px 8px",
                    borderRadius: "2px",
                  }}
                >
                  Épico
                </span>
              )}

              {/* Header: glyph + subtitle + name */}
              <div className="flex items-start gap-[10px]">
                <span
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: mode.glyphSize ? `${mode.glyphSize}px` : "32px",
                    lineHeight: 1,
                    color: "color-mix(in srgb, var(--gold) 80%, transparent)",
                  }}
                  aria-hidden="true"
                >
                  {mode.glyph}
                </span>
                <div className="flex flex-col">
                  <span
                    className="uppercase tracking-[0.22em]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      color: "color-mix(in srgb, var(--gold) 60%, transparent)",
                    }}
                  >
                    {mode.subtitle}
                  </span>
                  <span
                    className="text-white"
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      fontSize: "24px",
                      lineHeight: 1.2,
                    }}
                  >
                    {mode.name}
                  </span>
                </div>
              </div>

              {/* Tag */}
              <span
                className="self-start uppercase tracking-[0.3em]"
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: "9px",
                  color: mode.tag.color,
                  border: `1px solid ${mode.tag.border}`,
                  padding: "3px 8px",
                  borderRadius: "2px",
                }}
              >
                {mode.tag.label}
              </span>

              {/* Intensity */}
              <IntensityMeter level={mode.intensity} />

              {/* Description */}
              <p
                className="italic flex-1"
                style={{
                  fontFamily: "var(--font-garamond)",
                  fontSize: "14px",
                  color: "color-mix(in srgb, var(--gold) 87%, transparent)",
                  lineHeight: 1.5,
                }}
              >
                {mode.description}
              </p>

              {/* Formation */}
              <FormationIcon allies={mode.allies} enemies={mode.enemies} />

              {/* Action button */}
              <button
                type="button"
                onClick={() => handleClick(mode)}
                disabled={isDisabled}
                className="
                  uppercase cursor-pointer
                  transition-transform duration-150 ease-out
                  hover:-translate-y-[1px]
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
                "
                style={{
                  fontFamily: "var(--font-cinzel)",
                  fontSize: "11px",
                  letterSpacing: "0.3em",
                  padding: "11px 14px",
                  background:
                    "linear-gradient(135deg, var(--accent-primary), var(--ember))",
                  border: "1px solid var(--ember)",
                  borderRadius: "3px",
                  color: "white",
                  boxShadow:
                    "0 0 12px color-mix(in srgb, var(--ember) 25%, transparent)",
                  textAlign: "center",
                }}
              >
                {isFeatured && loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Spinner />
                    {mode.loadingLabel}
                  </span>
                ) : (
                  mode.buttonLabel
                )}
              </button>
            </article>
          );
        })}
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer
        className="italic text-center"
        style={{
          fontFamily: "var(--font-garamond)",
          fontSize: "12px",
          color: "color-mix(in srgb, var(--gold) 40%, transparent)",
        }}
      >
        &laquo; {motto} &raquo;
      </footer>
    </div>
  );
}
