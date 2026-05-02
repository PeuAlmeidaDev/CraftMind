// lib/ranking/cache.ts — Wrapper sobre unstable_cache para listagens de ranking
//
// As listas de ranking nao precisam ser real-time. Usamos cache com TTL 60s
// e tags ("ranking", "ranking:<baseKey>") para permitir invalidacao seletiva
// via revalidateTag em fase 2 (webhook do server Socket.io).

import { unstable_cache } from "next/cache";

const RANKING_TAG = "ranking";
const RANKING_TTL_SECONDS = 60;

/**
 * Envolve uma funcao async em unstable_cache com TTL de 60s e tags
 * ["ranking", "ranking:<baseKey>"].
 *
 * @param fn       Funcao que produz o dado a ser cacheado.
 * @param baseKey  Chave logica do recurso (ex: "pvp-1v1:ARION:50").
 *                 Usada tambem como tag secundaria para invalidacao seletiva.
 */
export function cachedRanking<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  baseKey: string,
): (...args: TArgs) => Promise<TResult> {
  return unstable_cache(fn, [baseKey], {
    revalidate: RANKING_TTL_SECONDS,
    tags: [RANKING_TAG, `${RANKING_TAG}:${baseKey}`],
  });
}
