// Cores rapidas (badge/glow) por casa, alinhadas com Pvp1v1BattleArena.
// Duplicadas localmente no MVP — depois podem migrar para lib/theme.ts
// se virarem cross-feature.

import type { HouseName } from "@/types/house";

export const HOUSE_BADGE_COLORS: Record<HouseName, string> = {
  ARION: "#e0c85c",
  LYCUS: "#67e8f9",
  NOCTIS: "#a78bfa",
  NEREID: "#7acf8a",
};

export const HOUSE_DISPLAY: Record<HouseName, string> = {
  ARION: "Arion",
  LYCUS: "Lycus",
  NOCTIS: "Noctis",
  NEREID: "Nereid",
};

export const HOUSE_BANNER_PATH: Record<HouseName, string> = {
  ARION: "/houses/Arion/arion-bandeira.png",
  LYCUS: "/houses/Lycus/lycus-bandeira.png",
  NOCTIS: "/houses/Noctis/noctis-bandeira.png",
  NEREID: "/houses/Nereid/nereid-bandeira.png",
};
