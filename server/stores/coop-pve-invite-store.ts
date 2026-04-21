// server/stores/coop-pve-invite-store.ts — Store in-memory para convites de coop PvE (TTL 30s)

import type { CoopPveMode } from "../../lib/battle/coop-pve-types";

export type CoopPveInvite = {
  inviteId: string;
  senderId: string;
  senderSocketId: string;
  senderName: string;
  targetId: string;
  mode: CoopPveMode;
  createdAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const invites = new Map<string, CoopPveInvite>();

/** Salva um convite no store */
export function setInvite(invite: CoopPveInvite): void {
  invites.set(invite.inviteId, invite);
}

/** Busca convite pelo inviteId */
export function getInvite(inviteId: string): CoopPveInvite | undefined {
  return invites.get(inviteId);
}

/** Remove convite (limpa timer antes) */
export function removeInvite(inviteId: string): void {
  const invite = invites.get(inviteId);
  if (!invite) return;
  clearTimeout(invite.timer);
  invites.delete(inviteId);
}

/** Busca convite ativo pelo senderId (um sender so pode ter 1 convite ativo) */
export function getInviteBySender(senderId: string): CoopPveInvite | undefined {
  for (const invite of invites.values()) {
    if (invite.senderId === senderId) return invite;
  }
  return undefined;
}

/** Busca convite ativo pelo targetId */
export function getInviteByTarget(targetId: string): CoopPveInvite | undefined {
  for (const invite of invites.values()) {
    if (invite.targetId === targetId) return invite;
  }
  return undefined;
}

/** Remove todos convites onde o userId e sender (cleanup no disconnect) */
export function removeInvitesBySender(senderId: string): void {
  for (const [inviteId, invite] of invites) {
    if (invite.senderId === senderId) {
      clearTimeout(invite.timer);
      invites.delete(inviteId);
    }
  }
}

/** Remove todos convites onde o userId e target (cleanup no disconnect) */
export function removeInvitesByTarget(targetId: string): void {
  for (const [inviteId, invite] of invites) {
    if (invite.targetId === targetId) {
      clearTimeout(invite.timer);
      invites.delete(inviteId);
    }
  }
}
