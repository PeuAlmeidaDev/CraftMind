// Constantes visuais compartilhadas entre componentes do dashboard

import type { HabitCategory } from "@/types/habit";
import type { Character } from "@/types/character";

export const CATEGORY_COLORS: Record<HabitCategory, string> = {
  PHYSICAL: "bg-red-500/15 text-red-400 border-red-500/30",
  INTELLECTUAL: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  MENTAL: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  SOCIAL: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  SPIRITUAL: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export const CATEGORY_LABEL: Record<HabitCategory, string> = {
  PHYSICAL: "Fisico",
  INTELLECTUAL: "Intelectual",
  MENTAL: "Mental",
  SOCIAL: "Social",
  SPIRITUAL: "Espiritual",
};

export const ATTRIBUTE_META: {
  key: keyof Character;
  grantKey: string;
  label: string;
  icon: string;
}[] = [
  { key: "physicalAtk", grantKey: "physicalAttack", label: "Ataque Fisico", icon: "\u2694\uFE0F" },
  { key: "physicalDef", grantKey: "physicalDefense", label: "Defesa Fisica", icon: "\u{1F6E1}\uFE0F" },
  { key: "magicAtk", grantKey: "magicAttack", label: "Ataque Magico", icon: "\u2728" },
  { key: "magicDef", grantKey: "magicDefense", label: "Defesa Magica", icon: "\u{1F52E}" },
  { key: "hp", grantKey: "hp", label: "Vida", icon: "\u2764\uFE0F" },
  { key: "speed", grantKey: "speed", label: "Velocidade", icon: "\u{1F4A8}" },
];
