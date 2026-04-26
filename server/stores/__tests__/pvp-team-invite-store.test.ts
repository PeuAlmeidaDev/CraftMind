import {
  setInvite,
  getInvite,
  removeInvite,
  getInviteBySender,
  getInviteByTarget,
  removeInvitesBySender,
  removeInvitesByTarget,
} from "../pvp-team-invite-store";
import type { PvpTeamInvite } from "../pvp-team-invite-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInvite(
  inviteId: string,
  senderId: string,
  targetId: string
): PvpTeamInvite {
  return {
    inviteId,
    senderId,
    senderSocketId: `socket-${senderId}`,
    senderName: `Player ${senderId}`,
    targetId,
    createdAt: Date.now(),
    timer: setTimeout(() => {}, 30_000),
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

const trackedInviteIds: string[] = [];

afterEach(() => {
  for (const id of trackedInviteIds) {
    removeInvite(id);
  }
  trackedInviteIds.length = 0;
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("pvp-team-invite-store", () => {
  it("setInvite + getInvite retorna o convite", () => {
    const invite = makeInvite("inv-1", "sender1", "target1");
    trackedInviteIds.push("inv-1");

    setInvite(invite);
    const retrieved = getInvite("inv-1");

    expect(retrieved).toBeDefined();
    expect(retrieved!.inviteId).toBe("inv-1");
    expect(retrieved!.senderId).toBe("sender1");
    expect(retrieved!.targetId).toBe("target1");
  });

  it("getInvite retorna undefined para inviteId inexistente", () => {
    expect(getInvite("inv-ghost")).toBeUndefined();
  });

  it("removeInvite remove o convite e limpa o timer", () => {
    const invite = makeInvite("inv-2", "sender2", "target2");
    trackedInviteIds.push("inv-2");

    setInvite(invite);
    removeInvite("inv-2");

    expect(getInvite("inv-2")).toBeUndefined();
  });

  it("removeInvite nao lanca erro para inviteId inexistente", () => {
    expect(() => removeInvite("inv-ghost")).not.toThrow();
  });

  it("getInviteBySender encontra convite pelo senderId", () => {
    const invite = makeInvite("inv-3", "sender3", "target3");
    trackedInviteIds.push("inv-3");

    setInvite(invite);
    const retrieved = getInviteBySender("sender3");

    expect(retrieved).toBeDefined();
    expect(retrieved!.inviteId).toBe("inv-3");
  });

  it("getInviteBySender retorna undefined se sender nao tem convite", () => {
    expect(getInviteBySender("ghost-sender")).toBeUndefined();
  });

  it("getInviteByTarget encontra convite pelo targetId", () => {
    const invite = makeInvite("inv-4", "sender4", "target4");
    trackedInviteIds.push("inv-4");

    setInvite(invite);
    const retrieved = getInviteByTarget("target4");

    expect(retrieved).toBeDefined();
    expect(retrieved!.inviteId).toBe("inv-4");
  });

  it("getInviteByTarget retorna undefined se target nao tem convite", () => {
    expect(getInviteByTarget("ghost-target")).toBeUndefined();
  });

  it("removeInvitesBySender remove todos os convites de um sender", () => {
    const inv1 = makeInvite("inv-5a", "sender5", "target5a");
    const inv2 = makeInvite("inv-5b", "sender5", "target5b");
    trackedInviteIds.push("inv-5a", "inv-5b");

    setInvite(inv1);
    setInvite(inv2);
    removeInvitesBySender("sender5");

    expect(getInvite("inv-5a")).toBeUndefined();
    expect(getInvite("inv-5b")).toBeUndefined();
  });

  it("removeInvitesBySender nao afeta convites de outros senders", () => {
    const inv1 = makeInvite("inv-6a", "sender6", "target6");
    const inv2 = makeInvite("inv-6b", "sender7", "target7");
    trackedInviteIds.push("inv-6a", "inv-6b");

    setInvite(inv1);
    setInvite(inv2);
    removeInvitesBySender("sender6");

    expect(getInvite("inv-6a")).toBeUndefined();
    expect(getInvite("inv-6b")).toBeDefined();
  });

  it("removeInvitesByTarget remove todos os convites para um target", () => {
    const inv1 = makeInvite("inv-7a", "sender8", "target8");
    const inv2 = makeInvite("inv-7b", "sender9", "target8");
    trackedInviteIds.push("inv-7a", "inv-7b");

    setInvite(inv1);
    setInvite(inv2);
    removeInvitesByTarget("target8");

    expect(getInvite("inv-7a")).toBeUndefined();
    expect(getInvite("inv-7b")).toBeUndefined();
  });

  it("removeInvitesByTarget nao afeta convites para outros targets", () => {
    const inv1 = makeInvite("inv-8a", "sender10", "target9");
    const inv2 = makeInvite("inv-8b", "sender11", "target10");
    trackedInviteIds.push("inv-8a", "inv-8b");

    setInvite(inv1);
    setInvite(inv2);
    removeInvitesByTarget("target9");

    expect(getInvite("inv-8a")).toBeUndefined();
    expect(getInvite("inv-8b")).toBeDefined();
  });
});
