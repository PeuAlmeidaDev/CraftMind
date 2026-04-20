// server/stores/user-store.ts — Mapa de userId -> Set<socketId> para roteamento de eventos

const onlineUsers = new Map<string, Set<string>>();

/** Registra um socket para o userId */
export function registerSocket(userId: string, socketId: string): void {
  const existing = onlineUsers.get(userId);
  if (existing) {
    existing.add(socketId);
  } else {
    onlineUsers.set(userId, new Set([socketId]));
  }
}

/** Remove um socket do userId. Retorna true se o usuario ficou completamente offline */
export function unregisterSocket(userId: string, socketId: string): boolean {
  const existing = onlineUsers.get(userId);
  if (!existing) return true;

  existing.delete(socketId);
  if (existing.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

/** Retorna todos os socketIds de um userId, ou undefined se offline */
export function getSocketIds(userId: string): Set<string> | undefined {
  return onlineUsers.get(userId);
}

/** Verifica se um userId esta online */
export function isOnline(userId: string): boolean {
  const sockets = onlineUsers.get(userId);
  return sockets !== undefined && sockets.size > 0;
}
