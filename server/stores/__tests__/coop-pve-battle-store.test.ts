import {
  setCoopPveBattle,
  getCoopPveBattle,
  removeCoopPveBattle,
  getPlayerCoopPveBattle,
} from "../coop-pve-battle-store";
import type { CoopPveBattleSession, CoopPveBattleState } from "../../../lib/battle/coop-pve-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCoopPveState(
  battleId: string,
  overrides?: Partial<CoopPveBattleState>,
): CoopPveBattleState {
  return {
    battleId,
    turnNumber: 1,
    team: [],
    mobs: [],
    mode: "2v3",
    status: "IN_PROGRESS",
    result: "PENDING",
    turnLog: [],
    ...overrides,
  };
}

function makeCoopPveSession(
  battleId: string,
  playerIds: [string, string],
  overrides?: Partial<CoopPveBattleSession>,
): CoopPveBattleSession {
  return {
    battleId,
    state: makeCoopPveState(battleId, overrides?.state as Partial<CoopPveBattleState> | undefined),
    mobConfigs: [],
    playerSockets: new Map([
      [playerIds[0], `socket-${playerIds[0]}`],
      [playerIds[1], `socket-${playerIds[1]}`],
    ]),
    playerNames: new Map([
      [playerIds[0], `Player ${playerIds[0]}`],
      [playerIds[1], `Player ${playerIds[1]}`],
    ]),
    playerAvatars: new Map([
      [playerIds[0], null],
      [playerIds[1], null],
    ]),
    playerHouses: new Map([
      [playerIds[0], "Lycus"],
      [playerIds[1], "Lycus"],
    ]),
    pendingActions: new Map(),
    turnTimer: null,
    matchAccepted: new Set(playerIds),
    matchTimer: null,
    disconnectedPlayers: new Map(),
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("coop-pve-battle-store", () => {
  const trackedBattleIds: string[] = [];

  afterEach(() => {
    for (const id of trackedBattleIds) {
      removeCoopPveBattle(id);
    }
    trackedBattleIds.length = 0;
  });

  // -----------------------------------------------------------------------
  // CRUD basico
  // -----------------------------------------------------------------------

  describe("CRUD basico", () => {
    it("setCoopPveBattle + getCoopPveBattle retorna a session", () => {
      const session = makeCoopPveSession("battle-1", ["u1", "u2"]);
      trackedBattleIds.push("battle-1");

      setCoopPveBattle("battle-1", session);
      const retrieved = getCoopPveBattle("battle-1");

      expect(retrieved).toBeDefined();
      expect(retrieved!.battleId).toBe("battle-1");
    });

    it("getCoopPveBattle retorna undefined para battleId inexistente", () => {
      expect(getCoopPveBattle("nao-existe")).toBeUndefined();
    });

    it("removeCoopPveBattle remove a session", () => {
      const session = makeCoopPveSession("battle-2", ["u3", "u4"]);
      trackedBattleIds.push("battle-2");

      setCoopPveBattle("battle-2", session);
      removeCoopPveBattle("battle-2");

      expect(getCoopPveBattle("battle-2")).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Bug 3 — getPlayerCoopPveBattle ignora batalhas finalizadas
  // -----------------------------------------------------------------------

  describe("getPlayerCoopPveBattle", () => {
    it("retorna a batalha quando status e IN_PROGRESS", () => {
      const session = makeCoopPveSession("battle-active", ["ua", "ub"]);
      trackedBattleIds.push("battle-active");

      setCoopPveBattle("battle-active", session);
      const result = getPlayerCoopPveBattle("ua");

      expect(result).toBeDefined();
      expect(result!.battleId).toBe("battle-active");
      expect(result!.session.state.status).toBe("IN_PROGRESS");
    });

    it("retorna a batalha pelo userId do segundo player", () => {
      const session = makeCoopPveSession("battle-active-2", ["uc", "ud"]);
      trackedBattleIds.push("battle-active-2");

      setCoopPveBattle("battle-active-2", session);
      const result = getPlayerCoopPveBattle("ud");

      expect(result).toBeDefined();
      expect(result!.battleId).toBe("battle-active-2");
    });

    it("retorna undefined quando nao ha batalha para o userId", () => {
      expect(getPlayerCoopPveBattle("user-fantasma")).toBeUndefined();
    });

    it("NAO retorna batalha com status FINISHED (fix Bug 3)", () => {
      const session = makeCoopPveSession("battle-finished", ["ue", "uf"]);
      session.state.status = "FINISHED";
      session.state.result = "VICTORY";
      trackedBattleIds.push("battle-finished");

      setCoopPveBattle("battle-finished", session);
      const result = getPlayerCoopPveBattle("ue");

      expect(result).toBeUndefined();
    });

    it("NAO retorna batalha FINISHED mesmo para o segundo player", () => {
      const session = makeCoopPveSession("battle-finished-2", ["ug", "uh"]);
      session.state.status = "FINISHED";
      session.state.result = "DEFEAT";
      trackedBattleIds.push("battle-finished-2");

      setCoopPveBattle("battle-finished-2", session);
      const result = getPlayerCoopPveBattle("uh");

      expect(result).toBeUndefined();
    });

    it("retorna batalha IN_PROGRESS mesmo existindo outra FINISHED do mesmo player", () => {
      // Batalha finalizada (orfa)
      const finishedSession = makeCoopPveSession("battle-old", ["ui", "uj"]);
      finishedSession.state.status = "FINISHED";
      finishedSession.state.result = "VICTORY";
      trackedBattleIds.push("battle-old");
      setCoopPveBattle("battle-old", finishedSession);

      // Batalha ativa
      const activeSession = makeCoopPveSession("battle-new", ["ui", "uk"]);
      trackedBattleIds.push("battle-new");
      setCoopPveBattle("battle-new", activeSession);

      const result = getPlayerCoopPveBattle("ui");

      expect(result).toBeDefined();
      expect(result!.battleId).toBe("battle-new");
      expect(result!.session.state.status).toBe("IN_PROGRESS");
    });
  });
});
