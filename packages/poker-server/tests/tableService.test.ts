import { describe, it, expect, vi, beforeEach } from "vitest";
import { processTableAction } from "../src/services/tableService.js";
import { TableState } from "@poker-platform/poker-core";

// Mock redisService
const mockGetTableState = vi.fn();
const mockSaveTableState = vi.fn();
const mockPublishTableUpdate = vi.fn();

vi.mock("../src/services/redisService.js", () => {
  return {
    getTableState: (...args: any[]) => mockGetTableState(...args),
    saveTableState: (...args: any[]) => mockSaveTableState(...args),
    publishTableUpdate: (...args: any[]) => mockPublishTableUpdate(...args),
  };
});

// Mock postgresService
vi.mock("../src/services/postgresService.js", () => {
  return {
    executeTransaction: vi.fn().mockImplementation(async (cb) => {
      return cb({});
    }),
    deductPlayerBalance: vi.fn(),
    creditPlayerBalance: vi.fn(),
    logHandHistory: vi.fn(),
  };
});

// Mock server and socketHandlers to prevent Fastify initialization and socket emission side effects
vi.mock("../src/server.js", () => {
  return {
    io: {
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    },
  };
});

vi.mock("../src/sockets/socketHandlers.js", () => {
  return {
    emitAccountBalance: vi.fn(),
  };
});

describe("tableService - processTableAction timeout resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve timeout to check when player has already matched current bet", async () => {
    const mockState: TableState = {
      config: { maxSeats: 6, minBuyIn: 100, maxBuyIn: 1000, smallBlind: 10, bigBlind: 20 },
      seats: [],
      dealerIndex: 0,
      handCount: 1,
      pendingJoins: [],
      pendingLeaves: [],
      handActionSeq: 5,
      lastBBSeatIdx: null,
      currentHandState: {
        config: { smallBlind: 10, bigBlind: 20, dealerIndex: 0 },
        deck: [],
        communityCards: [],
        players: [
          { id: "P0", name: "Alice", stack: 1000, cards: [null as any, null as any], currentRoundBet: 20, totalHandBet: 20, status: "active", hasActed: false },
          { id: "P1", name: "Bob", stack: 1000, cards: [null as any, null as any], currentRoundBet: 20, totalHandBet: 20, status: "active", hasActed: false },
        ],
        currentRound: "PreFlop",
        pots: [],
        currentBet: 20,
        lastRaiseSize: 20,
        actorIndex: 0,
      },
    };

    mockGetTableState.mockResolvedValue(mockState);

    const result = await processTableAction("table-1", { type: "timeout", playerId: "P0" }, 5);
    expect(result.success).toBe(true);
    // Under the hood, timeout should resolve to "check" since Alice currentRoundBet (20) matches currentBet (20)
    // Alice's turn is checked, advancing actorIndex to 1 (Bob)
    expect(result.state.currentHandState!.actorIndex).toBe(1);
    expect(result.state.currentHandState!.players[0]!.status).toBe("active");
    expect(result.state.currentHandState!.players[0]!.hasActed).toBe(true);
  });

  it("should resolve timeout to fold when player is behind current bet", async () => {
    const mockState: TableState = {
      config: { maxSeats: 6, minBuyIn: 100, maxBuyIn: 1000, smallBlind: 10, bigBlind: 20 },
      seats: [],
      dealerIndex: 0,
      handCount: 1,
      pendingJoins: [],
      pendingLeaves: [],
      handActionSeq: 5,
      lastBBSeatIdx: null,
      currentHandState: {
        config: { smallBlind: 10, bigBlind: 20, dealerIndex: 0 },
        deck: [],
        communityCards: [],
        players: [
          { id: "P0", name: "Alice", stack: 1000, cards: [null as any, null as any], currentRoundBet: 10, totalHandBet: 10, status: "active", hasActed: false },
          { id: "P1", name: "Bob", stack: 1000, cards: [null as any, null as any], currentRoundBet: 20, totalHandBet: 20, status: "active", hasActed: false },
        ],
        currentRound: "PreFlop",
        pots: [],
        currentBet: 20,
        lastRaiseSize: 20,
        actorIndex: 0,
      },
    };

    mockGetTableState.mockResolvedValue(mockState);

    const result = await processTableAction("table-1", { type: "timeout", playerId: "P0" }, 5);
    expect(result.success).toBe(true);
    // Under the hood, timeout should resolve to "fold" since Alice currentRoundBet (10) < currentBet (20)
    // Alice's status should become folded, hand ends since only Bob remains, round becomes Ended
    expect(result.state.currentHandState!.currentRound).toBe("Ended");
    expect(result.state.currentHandState!.players[0]!.status).toBe("folded");
  });

  it("should throw error for stale timeout actions", async () => {
    const mockState: TableState = {
      config: { maxSeats: 6, minBuyIn: 100, maxBuyIn: 1000, smallBlind: 10, bigBlind: 20 },
      seats: [],
      dealerIndex: 0,
      handCount: 1,
      pendingJoins: [],
      pendingLeaves: [],
      handActionSeq: 5,
      lastBBSeatIdx: null,
      currentHandState: {
        config: { smallBlind: 10, bigBlind: 20, dealerIndex: 0 },
        deck: [],
        communityCards: [],
        players: [
          { id: "P0", name: "Alice", stack: 1000, cards: [null as any, null as any], currentRoundBet: 10, totalHandBet: 10, status: "active", hasActed: false },
          { id: "P1", name: "Bob", stack: 1000, cards: [null as any, null as any], currentRoundBet: 20, totalHandBet: 20, status: "active", hasActed: false },
        ],
        currentRound: "PreFlop",
        pots: [],
        currentBet: 20,
        lastRaiseSize: 20,
        actorIndex: 0,
      },
    };

    mockGetTableState.mockResolvedValue(mockState);

    // Actor index is 0 (Alice / P0), so a timeout for Bob / P1 is stale
    const result = await processTableAction("table-1", { type: "timeout", playerId: "P1" }, 5);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Stale timeout action");
  });

  it("should refund failedJoins and emit account balances when starting next hand", async () => {
    const mockState: TableState = {
      config: { maxSeats: 6, minBuyIn: 100, maxBuyIn: 1000, smallBlind: 10, bigBlind: 20 },
      seats: [
        { index: 0, playerId: "P0", name: "Alice", stack: 1000, status: "occupied", mustWaitForBB: false },
        { index: 1, playerId: "P1", name: "Bob", stack: 1000, status: "occupied", mustWaitForBB: false },
      ],
      dealerIndex: 0,
      handCount: 1,
      pendingJoins: [
        { playerId: "P2", name: "Carol", buyIn: 500, seatIndex: 0 },
      ],
      pendingLeaves: [],
      handActionSeq: 5,
      lastBBSeatIdx: null,
      currentHandState: {
        config: { smallBlind: 10, bigBlind: 20, dealerIndex: 0 },
        deck: [],
        communityCards: [],
        players: [
          { id: "P0", name: "Alice", stack: 990, cards: [null as any, null as any], currentRoundBet: 0, totalHandBet: 10, status: "active", hasActed: true },
          { id: "P1", name: "Bob", stack: 980, cards: [null as any, null as any], currentRoundBet: 0, totalHandBet: 20, status: "active", hasActed: true },
        ],
        currentRound: "Ended",
        pots: [],
        currentBet: 20,
        lastRaiseSize: 20,
        actorIndex: 0,
      },
    };

    mockGetTableState.mockResolvedValue(mockState);

    const postgresModule = await import("../src/services/postgresService.js");
    const creditSpy = postgresModule.creditPlayerBalance as any;

    const result = await processTableAction("table-1", { type: "startNextHand" }, 5);
    expect(result.success).toBe(true);

    // Carol's join was failed because seat 0 is occupied, so she should be refunded 500
    expect(creditSpy).toHaveBeenCalledWith(expect.any(Object), "P2", 500);

    // Verify nextState returns with failedJoins (Carol)
    expect(result.state.failedJoins).toBeDefined();
    expect(result.state.failedJoins!.length).toBe(1);
    expect(result.state.failedJoins![0]!.playerId).toBe("P2");

    // Verify that the cached state did NOT include failedJoins
    expect(mockSaveTableState).toHaveBeenCalled();
    const savedState = mockSaveTableState.mock.calls[0][1];
    expect(savedState.failedJoins).toBeUndefined();
  });
});
