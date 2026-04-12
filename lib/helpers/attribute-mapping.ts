/**
 * Mapeamento de chaves JSON (attributeGrants) para colunas do modelo Character no Prisma.
 *
 * As chaves no JSON seguem nomes descritivos (physicalAttack, physicalDefense, etc.)
 * enquanto as colunas do Character usam abreviacoes (physicalAtk, physicalDef, etc.).
 */

const ATTRIBUTE_KEY_TO_COLUMN = {
  physicalAttack: "physicalAtk",
  physicalDefense: "physicalDef",
  magicAttack: "magicAtk",
  magicDefense: "magicDef",
  hp: "hp",
  speed: "speed",
} as const;

type AttributeJsonKey = keyof typeof ATTRIBUTE_KEY_TO_COLUMN;
type CharacterColumn = (typeof ATTRIBUTE_KEY_TO_COLUMN)[AttributeJsonKey];

/** Objeto pronto para usar como increment data no prisma.character.update */
export type CharacterIncrementData = Partial<Record<CharacterColumn, number>>;

/** Tipo das chaves validas no JSON de attributeGrants */
export type AttributeGrants = Partial<Record<AttributeJsonKey, number>>;

const VALID_KEYS = new Set<string>(Object.keys(ATTRIBUTE_KEY_TO_COLUMN));

/**
 * Converte um objeto attributeGrants (JSON) para um objeto mapeado
 * com nomes de colunas do Character, pronto para uso em prisma update/increment.
 *
 * Ignora chaves invalidas e valores que nao sejam numeros positivos.
 * Funcao pura — nao acessa banco de dados.
 */
export function mapAttributeGrantsToColumns(
  grants: unknown
): CharacterIncrementData {
  if (typeof grants !== "object" || grants === null || Array.isArray(grants)) {
    return {};
  }

  const result: CharacterIncrementData = {};
  const grantsRecord = grants as Record<string, unknown>;

  for (const [key, value] of Object.entries(grantsRecord)) {
    if (!VALID_KEYS.has(key)) continue;
    if (typeof value !== "number" || value <= 0) continue;

    const column = ATTRIBUTE_KEY_TO_COLUMN[key as AttributeJsonKey];
    result[column] = value;
  }

  return result;
}
