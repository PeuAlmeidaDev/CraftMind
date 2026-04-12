// types/house.ts — Casa do jogador

export const HouseName = {
  ARION: "ARION",
  LYCUS: "LYCUS",
  NOCTIS: "NOCTIS",
  NEREID: "NEREID",
} as const;

export type HouseName = (typeof HouseName)[keyof typeof HouseName];

/** Representacao publica de uma casa (retornada pelas APIs) */
export type House = {
  id: string;
  name: HouseName;
  animal: string;
  description: string;
};
