"use client";

import { useEffect, useRef, useMemo } from "react";
import "./skill-vfx.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VfxType = "slash" | "arcane" | "heal" | "fire";
type VfxVariant = "css" | "svg";

type SkillVfxProps = {
  skillName: string | null;
  visible: boolean;
  onComplete: () => void;
};

// ---------------------------------------------------------------------------
// Skill -> VFX type mapping
// ---------------------------------------------------------------------------

const SKILL_VFX_MAP: Record<string, VfxType> = {
  // SLASH (physical)
  "Ataque Rapido": "slash",
  "Investida Selvagem": "slash",
  "Corte Rapido": "slash",
  "Pancada Dupla": "slash",
  "Chute Giratorio": "slash",
  "Lamina Crescente": "slash",
  "Furia de Garras": "slash",
  "Impacto Trovejante": "slash",
  "Onda de Choque": "slash",
  "Golpe Drenador": "slash",
  "Execucao Perfeita": "slash",
  "Cadeia Implacavel": "slash",

  // ARCANE (magical damage)
  "Fagulha Arcana": "arcane",
  "Rajada de Vento": "arcane",
  "Toque Gelido": "arcane",
  "Relampago Arcano": "arcane",
  "Prisao de Gelo": "arcane",
  "Tempestade Arcana": "arcane",
  "Chama Sombria": "arcane",
  "Ressonancia Arcana": "arcane",
  "Meteoro Abissal": "arcane",
  "Cataclismo": "arcane",

  // HEAL (support: buffs, debuffs, counters, cleanse)
  "Grito Intimidador": "heal",
  "Olhar Penetrante": "heal",
  "Provocacao": "heal",
  "Marca Fragil": "heal",
  "Maldicao Enfraquecedora": "heal",
  "Analise Fatal": "heal",
  "Grito de Guerra": "heal",
  "Palavra de Coragem": "heal",
  "Espinhos da Vinganca": "heal",
  "Reflexo de Combate": "heal",

  // HEAL
  "Cura Vital": "heal",
  "Toque Restaurador": "heal",
  "Foco Interior": "heal",
  "Postura Defensiva": "heal",
  "Mente Agucada": "heal",
  "Veu Protetor": "heal",
  "Regeneracao Profunda": "heal",
  "Brisa Curativa": "heal",
  "Aurora Restauradora": "heal",
  "Renascimento Interior": "heal",
  "Pacto de Resiliencia": "heal",
  "Purificacao": "heal",

  // FIRE
  "Soco Flamejante": "fire",
  "Mordida Venenosa": "fire",
  "Furia do Dragao": "fire",
  "Furia Latente": "fire",
};

// ---------------------------------------------------------------------------
// Duration per VFX type (ms)
// ---------------------------------------------------------------------------

const VFX_DURATION: Record<VfxType, number> = {
  slash: 700,
  arcane: 800,
  heal: 1100,
  fire: 750,
};

// ---------------------------------------------------------------------------
// SVG paths for variant rendering
// ---------------------------------------------------------------------------

const SVG_PATHS: Partial<Record<VfxType, string>> = {
  slash: "/vfx/corte-rapido.svg",
  arcane: "/vfx/fagulha-arcana.svg",
};

// Types that support random CSS/SVG variant
const TYPES_WITH_SVG_VARIANT: VfxType[] = ["slash", "arcane"];

// ---------------------------------------------------------------------------
// Markup renderers — CSS variants
// ---------------------------------------------------------------------------

function SlashCssMarkup() {
  return (
    <div className="vfx vfx-slash active">
      <div className="vfx-slash__flash" />
      <div className="vfx-slash__blade b1" />
      <div className="vfx-slash__blade b2" />
      <div className="vfx-slash__blade b3" />
    </div>
  );
}

function ArcaneCssMarkup() {
  return (
    <div className="vfx vfx-arcane active">
      <div className="vfx-arcane__core" />
      <div className="vfx-arcane__ring r1" />
      <div className="vfx-arcane__ring r2" />
      <div className="vfx-arcane__ring r3" />
    </div>
  );
}

function HealMarkup() {
  return null;
}

function FireMarkup() {
  return (
    <div className="vfx vfx-fire active">
      <div className="vfx-fire__ball" />
      <div className="vfx-fire__shock" />
    </div>
  );
}

function SvgMarkup({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 20,
        objectFit: "contain",
      }}
    />
  );
}

const CSS_COMPONENTS: Record<VfxType, () => React.ReactNode> = {
  slash: SlashCssMarkup,
  arcane: ArcaneCssMarkup,
  heal: HealMarkup,
  fire: FireMarkup,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SkillVfx({ skillName, visible, onComplete }: SkillVfxProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pick variant (css or svg) once per activation, not on every render
  const variant = useMemo<VfxVariant>(() => {
    if (!skillName) return "css";
    const vfxType = SKILL_VFX_MAP[skillName] ?? "slash";
    if (TYPES_WITH_SVG_VARIANT.includes(vfxType) && SVG_PATHS[vfxType]) {
      return Math.random() < 0.5 ? "svg" : "css";
    }
    return "css";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillName, visible]);

  useEffect(() => {
    if (!visible || !skillName) return;

    const vfxType = SKILL_VFX_MAP[skillName] ?? "slash";
    const duration = VFX_DURATION[vfxType];

    timerRef.current = setTimeout(() => {
      onComplete();
      timerRef.current = null;
    }, duration);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, skillName, onComplete]);

  if (!visible || !skillName) return null;

  const vfxType = SKILL_VFX_MAP[skillName] ?? "slash";

  // SVG variant for slash and arcane
  if (variant === "svg" && SVG_PATHS[vfxType]) {
    return <SvgMarkup src={SVG_PATHS[vfxType]} />;
  }

  // CSS variant (always for heal and fire, random for slash and arcane)
  const CssComponent = CSS_COMPONENTS[vfxType];
  return <CssComponent />;
}
