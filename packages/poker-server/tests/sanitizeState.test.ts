import { describe, it, expect } from "vitest";
import { TableState, createTable, tableReducer } from "@poker-platform/poker-core";
import { sanitizeStateForClient } from "../src/sockets/sanitizeState.js";
import { parseCard } from "@poker-platform/poker-core";

describe("State Sanitization (sanitizeStateForClient)", () => {
  const tableConfig = {
    maxSeats: 6 as const,
    minBuyIn: 100,
    maxBuyIn: 1000,
    smallBlind: 10,
    bigBlind: 20,
  };

  const mockDeck = [
    "Ah", "Kh", // P0 (Alice)
    "Qd", "Jd", // P1 (Bob)
    "Ts", "9s", // P2 (Carol)
    "2c", "3c", "4c", "5c", "6c",
  ].map(parseCard);

  it("should hide deck and opponent hole cards mid-hand", () => {
    let table = createTable(tableConfig);
    table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
    table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });
    table = tableReducer(table, { type: "joinTable", playerId: "P2", name: "Carol", buyIn: 1000, seatIndex: 2 });
    
    // Start Hand: round is PreFlop
    table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
    expect(table.currentHandState).not.toBeNull();

    // Sanitize state for Alice ("P0")
    const sanitizedAlice = sanitizeStateForClient(table, "P0");
    expect((sanitizedAlice.currentHandState as any).deck).toBeUndefined(); // Deck is scrubbed
    
    // Alice should see her own cards
    expect(sanitizedAlice.currentHandState!.players[0]!.id).toBe("P0");
    expect(sanitizedAlice.currentHandState!.players[0]!.cards).toEqual([
      { rank: "A", suit: "hearts" },
      { rank: "K", suit: "hearts" },
    ]);

    // Alice should NOT see Bob's ("P1") or Carol's ("P2") cards
    expect(sanitizedAlice.currentHandState!.players[1]!.id).toBe("P1");
    expect(sanitizedAlice.currentHandState!.players[1]!.cards).toEqual([null, null]);
    expect(sanitizedAlice.currentHandState!.players[2]!.id).toBe("P2");
    expect(sanitizedAlice.currentHandState!.players[2]!.cards).toEqual([null, null]);
  });

  it("should reveal only active (non-folded) players cards at showdown", () => {
    let table = createTable(tableConfig);
    table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
    table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });
    table = tableReducer(table, { type: "joinTable", playerId: "P2", name: "Carol", buyIn: 1000, seatIndex: 2 });

    table = tableReducer(table, { type: "startNextHand", deck: mockDeck });

    // Preflop: P0 calls (20), P1 folds, P2 checks (20)
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "call", playerId: "P0" } });
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P1" } });
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P2" } });

    // Flop check check
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P2" } });
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P0" } });

    // Turn check check
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P2" } });
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P0" } });

    // River check check
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P2" } });
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P0" } });

    // Hand goes to Showdown. Active players are P0 (Alice) and P2 (Carol). P1 (Bob) is folded.
    expect(table.currentHandState!.currentRound).toBe("Showdown");

    // Sanitize state for Bob ("P1" - observer/folded player)
    const sanitizedBob = sanitizeStateForClient(table, "P1");

    // Bob sees his own cards (which were Qd Jd)
    expect(sanitizedBob.currentHandState!.players[1]!.id).toBe("P1");
    expect(sanitizedBob.currentHandState!.players[1]!.cards).toEqual([
      { rank: "Q", suit: "diamonds" },
      { rank: "J", suit: "diamonds" },
    ]);

    // Bob should see active showdown players' cards (Alice P0 and Carol P2)
    expect(sanitizedBob.currentHandState!.players[0]!.id).toBe("P0");
    expect(sanitizedBob.currentHandState!.players[0]!.cards).toEqual([
      { rank: "A", suit: "hearts" },
      { rank: "K", suit: "hearts" },
    ]);

    expect(sanitizedBob.currentHandState!.players[2]!.id).toBe("P2");
    expect(sanitizedBob.currentHandState!.players[2]!.cards).toEqual([
      { rank: "T", suit: "spades" },
      { rank: "9", suit: "spades" },
    ]);

    // Sanitize state for Alice ("P0"). She should NOT see Bob's (folded) cards.
    const sanitizedAlice = sanitizeStateForClient(table, "P0");
    expect(sanitizedAlice.currentHandState!.players[1]!.id).toBe("P1");
    expect(sanitizedAlice.currentHandState!.players[1]!.cards).toEqual([null, null]); // Bob folded, so hidden
  });

  it("should not reveal the winner's cards to opponents in an uncontested pot where everyone else folds", () => {
    let table = createTable(tableConfig);
    table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
    table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });

    // Start Hand: Heads-up (Alice P0 dealer/SB, Bob P1 BB)
    table = tableReducer(table, { type: "startNextHand", deck: mockDeck });

    // Alice folds preflop, so Bob wins uncontested
    table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P0" } });
    
    // Hand should have transitioned to Ended (uncontested)
    expect(table.currentHandState!.currentRound).toBe("Ended");

    // Sanitize state for Alice ("P0")
    const sanitizedAlice = sanitizeStateForClient(table, "P0");
    // Alice sees her own cards
    expect(sanitizedAlice.currentHandState!.players[0]!.id).toBe("P0");
    expect(sanitizedAlice.currentHandState!.players[0]!.cards).not.toEqual([null, null]);
    // Alice should NOT see Bob's (winner's) cards because it was uncontested
    expect(sanitizedAlice.currentHandState!.players[1]!.id).toBe("P1");
    expect(sanitizedAlice.currentHandState!.players[1]!.cards).toEqual([null, null]);

    // Sanitize state for Bob ("P1" - winner)
    const sanitizedBob = sanitizeStateForClient(table, "P1");
    // Bob sees his own cards
    expect(sanitizedBob.currentHandState!.players[1]!.id).toBe("P1");
    expect(sanitizedBob.currentHandState!.players[1]!.cards).not.toEqual([null, null]);
    // Bob should NOT see Alice's (folded) cards
    expect(sanitizedBob.currentHandState!.players[0]!.id).toBe("P0");
    expect(sanitizedBob.currentHandState!.players[0]!.cards).toEqual([null, null]);
  });

  it("should calculate stateVersion and legalActions correctly", () => {
    let table = createTable(tableConfig);
    table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
    table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });

    // Starts hand, table handActionSeq goes to 3
    table = tableReducer(table, { type: "startNextHand", deck: mockDeck });

    const sanitizedAlice = sanitizeStateForClient(table, "P0");
    const sanitizedBob = sanitizeStateForClient(table, "P1");

    // stateVersion should map handActionSeq
    expect(sanitizedAlice.stateVersion).toBe(table.handActionSeq);
    expect(sanitizedAlice.stateVersion).toBe(3);

    // Alice (P0) is dealer/SB and acts first preflop (actorIndex = 0)
    expect(table.currentHandState!.actorIndex).toBe(0);

    // Alice should see her legal actions
    expect(sanitizedAlice.currentHandState!.legalActions).toEqual([
      { type: "fold" },
      { type: "call", callAmount: 10 }, // 20 (BB) - 10 (SB) = 10 to call
      { type: "raise", minRaise: 40 },  // 20 (currentBet) + 20 (lastRaiseSize) = 40 minRaise
    ]);

    // Bob (P1) is BB, not his turn, so legalActions should be empty
    expect(sanitizedBob.currentHandState!.legalActions).toEqual([]);
  });
});
