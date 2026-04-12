import type { HouseName } from "@/types/house";

type HouseAssets = {
  brasao: string | null;
  bandeira: string;
};

const HOUSE_FOLDER: Record<HouseName, string> = {
  ARION: "Arion",
  LYCUS: "Lycus",
  NOCTIS: "Noctis",
  NEREID: "Nereid",
};

// Casas que tem brasao alem da bandeira
const HOUSES_WITH_BRASAO: ReadonlySet<HouseName> = new Set<HouseName>(["LYCUS"]);

export function getHouseAssets(houseName: HouseName): HouseAssets {
  const folder = HOUSE_FOLDER[houseName];
  const lower = folder.toLowerCase();
  return {
    brasao: HOUSES_WITH_BRASAO.has(houseName)
      ? `/houses/${folder}/${lower}-brasao.png`
      : null,
    bandeira: `/houses/${folder}/${lower}-bandeira.png`,
  };
}
