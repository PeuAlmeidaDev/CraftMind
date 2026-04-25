export const HOUSE_LORE: Record<string, { motto: string; epithet: string }> = {
  ARION: {
    motto: "Forca e honra acima de tudo",
    epithet: "Os Indomiveis",
  },
  LYCUS: {
    motto: "Equilibrio entre a lamina e a mente",
    epithet: "Os Vigilantes",
  },
  NOCTIS: {
    motto: "O conhecimento e a chave, a disciplina e o caminho",
    epithet: "Os Sabios",
  },
  NEREID: {
    motto: "Juntos somos a mare que nao recua",
    epithet: "Os Resilientes",
  },
};

export function getPlayerTitle(level: number): string {
  if (level >= 50) return "Mestre";
  if (level >= 30) return "Guardiao";
  if (level >= 20) return "Sentinela";
  if (level >= 10) return "Discipulo";
  return "Aprendiz";
}
