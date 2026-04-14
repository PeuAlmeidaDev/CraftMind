// lib/theme.ts — Temas visuais por casa

import type { HouseName } from "@/types/house";

type HouseTheme = {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  accentPrimary: string;
  accentSecondary: string;
  borderSubtle: string;
};

const HOUSE_THEMES: Record<HouseName, HouseTheme> = {
  NOCTIS: {
    bgPrimary: "#0a0a0f",
    bgSecondary: "#13131a",
    bgCard: "#1a1a2e",
    accentPrimary: "#7c3aed",
    accentSecondary: "#10b981",
    borderSubtle: "#2a2a3e",
  },
  LYCUS: {
    bgPrimary: "#040E1A",
    bgSecondary: "#0A1F33",
    bgCard: "#12334D",
    accentPrimary: "#DAA520",
    accentSecondary: "#4A90D9",
    borderSubtle: "#1B4468",
  },
  ARION: {
    bgPrimary: "#0A0A0A",
    bgSecondary: "#161010",
    bgCard: "#2A1215",
    accentPrimary: "#C4362A",
    accentSecondary: "#D4763A",
    borderSubtle: "#3D1A1E",
  },
  NEREID: {
    bgPrimary: "#010E0E",
    bgSecondary: "#012A2A",
    bgCard: "#014040",
    accentPrimary: "#E8A33C",
    accentSecondary: "#03A678",
    borderSubtle: "#025C50",
  },
};

const CSS_VAR_MAP: Record<keyof HouseTheme, string> = {
  bgPrimary: "--bg-primary",
  bgSecondary: "--bg-secondary",
  bgCard: "--bg-card",
  accentPrimary: "--accent-primary",
  accentSecondary: "--accent-secondary",
  borderSubtle: "--border-subtle",
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
