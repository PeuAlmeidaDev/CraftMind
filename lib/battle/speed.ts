// lib/battle/speed.ts — Calculo de acoes extras por vantagem de speed

import { SPEED_EXTRA_TURN_THRESHOLDS, MAX_ACTIONS_PER_TURN } from "./constants";

/**
 * Calcula quantas acoes extras cada lado ganha com base na diferenca de speed.
 * Retorna { extraA: number; extraB: number } — no maximo um dos dois sera > 0.
 * Se speeds iguais ou ratio < 2, ambos retornam 0.
 */
export function calculateExtraActions(
  speedA: number,
  speedB: number
): { extraA: number; extraB: number } {
  if (speedA <= 0 || speedB <= 0) return { extraA: 0, extraB: 0 };
  if (speedA === speedB) return { extraA: 0, extraB: 0 };

  const faster = Math.max(speedA, speedB);
  const slower = Math.min(speedA, speedB);
  const ratio = faster / slower;

  let extras = 0;
  for (const threshold of SPEED_EXTRA_TURN_THRESHOLDS) {
    if (ratio >= threshold) {
      extras++;
    } else {
      break;
    }
  }

  extras = Math.min(extras, MAX_ACTIONS_PER_TURN - 1);

  if (speedA > speedB) {
    return { extraA: extras, extraB: 0 };
  }
  return { extraA: 0, extraB: extras };
}
