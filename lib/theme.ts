// lib/theme.ts — Temas visuais por casa

import type { HouseName } from "@/types/house";

type HouseTheme = {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  accentPrimary: string;
  accentSecondary: string;
  borderSubtle: string;
  gold: string;
  gold2: string;
  ember: string;
  deep: string;
  ink: string;
};

const HOUSE_THEMES: Record<HouseName, HouseTheme> = {
  NOCTIS: {
    bgPrimary: "#07060c",
    bgSecondary: "#120e1f",
    bgCard: "#120e1fcc",
    accentPrimary: "#7c3aed",
    accentSecondary: "#10b981",
    borderSubtle: "#10b98118",
    gold: "#10b981",
    gold2: "#34d399",
    ember: "#a78bfa",
    deep: "#2a1460",
    ink: "#e6f6ec",
  },
  LYCUS: {
    bgPrimary: "#05080e",
    bgSecondary: "#0a1220",
    bgCard: "#0a1220cc",
    accentPrimary: "#DAA520",
    accentSecondary: "#4A90D9",
    borderSubtle: "#DAA52018",
    gold: "#DAA520",
    gold2: "#f2c84a",
    ember: "#f2c84a",
    deep: "#14325a",
    ink: "#eef4ff",
  },
  ARION: {
    bgPrimary: "#0a0608",
    bgSecondary: "#180a08",
    bgCard: "#180a08cc",
    accentPrimary: "#C4362A",
    accentSecondary: "#D4763A",
    borderSubtle: "#D4763A18",
    gold: "#D4763A",
    gold2: "#e8945a",
    ember: "#ff8a54",
    deep: "#4a0f08",
    ink: "#f6e8e0",
  },
  NEREID: {
    bgPrimary: "#04100e",
    bgSecondary: "#0a1f1b",
    bgCard: "#0a1f1bcc",
    accentPrimary: "#E8A33C",
    accentSecondary: "#03A678",
    borderSubtle: "#E8A33C18",
    gold: "#E8A33C",
    gold2: "#f5b85a",
    ember: "#f5b85a",
    deep: "#0a4a3a",
    ink: "#f1f7f4",
  },
};

const CSS_VAR_MAP: Record<keyof HouseTheme, string> = {
  bgPrimary: "--bg-primary",
  bgSecondary: "--bg-secondary",
  bgCard: "--bg-card",
  accentPrimary: "--accent-primary",
  accentSecondary: "--accent-secondary",
  borderSubtle: "--border-subtle",
  gold: "--gold",
  gold2: "--gold2",
  ember: "--ember",
  deep: "--deep",
  ink: "--ink",
};

export function getHouseTheme(houseName: HouseName): HouseTheme {
  return HOUSE_THEMES[houseName] ?? HOUSE_THEMES.NOCTIS;
}

export function applyHouseTheme(houseName: HouseName): void {
  if (typeof document === "undefined") return;
  const theme = getHouseTheme(houseName);
  const root = document.documentElement.style;

  for (const key of Object.keys(CSS_VAR_MAP) as Array<keyof HouseTheme>) {
    root.setProperty(CSS_VAR_MAP[key], theme[key]);
  }
}
