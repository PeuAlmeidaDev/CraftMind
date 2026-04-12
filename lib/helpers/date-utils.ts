/** Offset fixo do BRT (Brasilia) em milissegundos: -3 horas */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000

/**
 * Retorna 00:00 BRT de hoje como Date UTC.
 *
 * Exemplo: se agora e 2026-04-07T02:30:00Z (23:30 BRT do dia 06),
 * retorna 2026-04-06T03:00:00.000Z (00:00 BRT do dia 06).
 *
 * Se agora e 2026-04-07T04:00:00Z (01:00 BRT do dia 07),
 * retorna 2026-04-07T03:00:00.000Z (00:00 BRT do dia 07).
 */
export function getStartOfDayBRT(): Date {
  const now = new Date()
  // Converter UTC para BRT subtraindo 3h, depois zerar horas em UTC
  const brtTime = new Date(now.getTime() - BRT_OFFSET_MS)
  const startBRT = new Date(
    Date.UTC(brtTime.getUTCFullYear(), brtTime.getUTCMonth(), brtTime.getUTCDate())
  )
  // Converter de volta para UTC somando 3h
  return new Date(startBRT.getTime() + BRT_OFFSET_MS)
}

/**
 * Retorna 00:00 BRT de amanha como Date UTC (startOfDay + 24h).
 * Usado como limite superior exclusivo em queries de tarefas do dia.
 */
export function getEndOfDayBRT(): Date {
  return new Date(getStartOfDayBRT().getTime() + 24 * 60 * 60 * 1000)
}

/**
 * Retorna a data "so dia" em BRT com hora zerada em UTC.
 * Usado para campos de data que precisam de constraint unique por dia
 * (ex: HabitLog.date, DailyTask.dueDate).
 *
 * Diferente de getStartOfDayBRT(), retorna meia-noite UTC do dia BRT
 * (ex: 2026-04-07T00:00:00.000Z para dia 07 BRT), compativel com
 * colunas date-only no banco.
 */
export function getTodayDateBRT(): Date {
  const now = new Date()
  const brtTime = new Date(now.getTime() - BRT_OFFSET_MS)
  return new Date(
    Date.UTC(brtTime.getUTCFullYear(), brtTime.getUTCMonth(), brtTime.getUTCDate())
  )
}
