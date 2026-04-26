// server/stores/pvp-team-invite-store.ts — Store in-memory para convites PvP Team duo

export type PvpTeamInvite = {
  inviteId: string;
  senderId: string;
  senderSocketId: string;
  senderName: string;
  targetId: string;
  createdAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const invites = new Map<string, PvpTeamInvite>();

export function setInvite(invite: PvpTeamInvite): void {
  invites.set(invite.inviteId, invite);
}

export function getInvite(inviteId: string): PvpTeamInvite | undefined {
  return invites.get(inviteId);
}

export function removeInvite(inviteId: string): void {
  const invite = invites.get(inviteId);
  if (!invite) return;
  clearTimeout(invite.timer);
  invites.delete(inviteId);
}

export function getInviteBySender(senderId: string): PvpTeamInvite | undefined {
  for (const invite of invites.values()) {
    if (invite.senderId === senderId) return invite;
  }
  return undefined;
}

export function getInviteByTarget(targetId: string): PvpTeamInvite | undefined {
  for (const invite of invites.values()) {
    if (invite.targetId === targetId) return invite;
  }
  return undefined;
}

export function removeInvitesBySender(senderId: string): void {
  for (const [inviteId, invite] of invites) {
    if (invite.senderId === senderId) {
      clearTimeout(invite.timer);
      invites.delete(inviteId);
    }
  }
}

export function removeInvitesByTarget(targetId: string): void {
  for (const [inviteId, invite] of invites) {
    if (invite.targetId === targetId) {
      clearTimeout(invite.timer);
      invites.delete(inviteId);
    }
  }
}
