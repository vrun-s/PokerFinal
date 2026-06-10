import { describe, it, expect } from "vitest";
import { parseCard } from "../src/utils/cardUtils.js";
import {
  createTable,
  tableReducer,
  applyHandPayouts,
  evictBustedPlayers,
  flushPendingActions,
  rotateDealerButton,
  assignBlindsAndStart,
} from "../src/state-machine/table.js";
import { HandConfig, SeatConfig } from "../src/types/GameState.js";
import { Card } from "../src/types/Card.js";

function makeMockDeck(cardStrings: string[]): Card[] {
  return cardStrings.map(parseCard);
}

describe("Table Orchestrator (Phase 4)", () => {
  const config = {
    maxSeats: 6 as const,
    minBuyIn: 100,
    maxBuyIn: 1000,
    smallBlind: 10,
    bigBlind: 20,
  };

  const mockDeck = makeMockDeck([
    "Ah", "Kh", // P0
    "Qd", "Jd", // P1
    "Ts", "9s", // P2
    "2c", "3c", "4c", "5c", "6c",
  ]);

  describe("Core Table Operations", () => {
    it("should initialize a table with empty seats correctly", () => {
      const table = createTable(config);
      expect(table.config.maxSeats).toBe(6);
      expect(table.seats.length).toBe(6);
      expect(table.seats.every(s => s.status === "empty")).toBe(true);
      expect(table.currentHandState).toBeNull();
    });

    it("should allow players to join when table is idle", () => {
      let table = createTable(config);
      table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
      table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });

      expect(table.seats[0]!.playerId).toBe("P0");
      expect(table.seats[0]!.status).toBe("occupied");
      expect(table.seats[0]!.mustWaitForBB).toBe(false); // Idle table seats immediately

      expect(table.seats[1]!.playerId).toBe("P1");
      expect(table.seats[1]!.status).toBe("occupied");
      expect(table.seats[1]!.mustWaitForBB).toBe(false);
    });

    it("should queue joins and leaves mid-hand", () => {
      let table = createTable(config);
      table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
      table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });
      table = tableReducer(table, { type: "joinTable", playerId: "P2", name: "Carol", buyIn: 1000, seatIndex: 2 });
      
      // Start the hand
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      expect(table.currentHandState).not.toBeNull();

      // P3 tries to join mid-hand
      table = tableReducer(table, { type: "joinTable", playerId: "P3", name: "David", buyIn: 1000, seatIndex: 3 });
      expect(table.pendingJoins.length).toBe(1);
      expect(table.pendingJoins[0]!.playerId).toBe("P3");
      expect(table.seats[3]!.status).toBe("empty");

      // P0 tries to leave mid-hand
      table = tableReducer(table, { type: "leaveTable", playerId: "P0" });
      expect(table.pendingLeaves.length).toBe(1);
      expect(table.pendingLeaves[0]).toBe("P0");
      expect(table.seats[0]!.playerId).toBe("P0");
    });
  });

  describe("Stale Timeout Protection", () => {
    it("should ignore timeout actions from stale players", () => {
      let table = createTable(config);
      table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
      table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });
      table = tableReducer(table, { type: "joinTable", playerId: "P2", name: "Carol", buyIn: 1000, seatIndex: 2 });
      
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      
      // actorIndex preflop is 0 (P0 / Alice)
      expect(table.currentHandState!.actorIndex).toBe(0);

      const stateBefore = table.currentHandState;

      // Send timeout action for Bob (P1), who is NOT the current actor
      table = tableReducer(table, { type: "timeout", playerId: "P1" });

      // HandState should not have changed at all
      expect(table.currentHandState).toEqual(stateBefore);

      // Send timeout action for Alice (P0), who IS the current actor
      table = tableReducer(table, { type: "timeout", playerId: "P0" });

      // Alice should have folded, and turn should advance to Bob (P1)
      expect(table.currentHandState!.actorIndex).toBe(1);
      expect(table.currentHandState!.players[0]!.status).toBe("folded");
    });
  });

  describe("Busted Player Eviction", () => {
    it("should automatically evict players with stack === 0 at hand boundary", () => {
      let table = createTable(config);
      // Alice joins with very short stack (10), BB is 20, SB is 10
      table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 10, seatIndex: 0 });
      table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });
      table = tableReducer(table, { type: "joinTable", playerId: "P2", name: "Carol", buyIn: 1000, seatIndex: 2 });

      // dealerIndex starts at 0, so:
      // SB is Seat 1 (Bob) - posts 10
      // BB is Seat 2 (Carol) - posts 20
      // UTG is Seat 0 (Alice) - posts nothing, stack remaining is 10.
      const bustedDeck = makeMockDeck([
        "Ah", "Kh", // P0 (Alice)
        "Qd", "Jd", // P1 (Bob)
        "Ts", "9s", // P2 (Carol)
        "2c", "3c", "4c", "Td", "9d", // Community cards giving Carol two pair
      ]);
      table = tableReducer(table, { type: "startNextHand", deck: bustedDeck });
      
      // Alice (UTG) calls 10 (putting her all-in)
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "call", playerId: "P0" } });
      expect(table.currentHandState!.players[0]!.status).toBe("all-in");
      expect(table.currentHandState!.players[0]!.stack).toBe(0);

      // Bob (SB) folds (already bet 10)
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P1" } });

      // Carol (BB) checks (already bet 20)
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P2" } });

      // Hand ends immediately (everyone folds to Carol except Alice who is all-in, causing it to go to showdown)
      // Since it is preflop all-in showdown, the hand ends right away
      expect(table.currentHandState!.currentRound).toBe("Showdown");

      // Carol wins the pot, Alice stack is 0.
      // Advance to next hand
      table = tableReducer(table, { type: "startNextHand", deck: bustedDeck });

      // Alice should be evicted since she had stack === 0
      expect(table.seats[0]!.status).toBe("empty");
      expect(table.seats[0]!.playerId).toBeNull();
    });
  });

  describe("Dead Button / Dead Blinds Rotation", () => {
    it("should advance button unconditionally by one seat index, and compute correct SB/BB", () => {
      let table = createTable(config);
      table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
      table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });
      table = tableReducer(table, { type: "joinTable", playerId: "P2", name: "Carol", buyIn: 1000, seatIndex: 2 });

      // Hand 1 starts. dealerIndex starts at 0 (Alice).
      // SB = Seat 1 (Bob), BB = Seat 2 (Carol)
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      expect(table.currentHandState!.config.dealerIndex).toBe(0); // Alice in sorted active list
      
      // Carol checks, fold rest, etc. just checks to end hand
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "call", playerId: "P0" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "call", playerId: "P1" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P2" } });
      
      // Complete remaining streets to end the hand
      // Flop
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P1" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P2" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P0" } });
      // Turn
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P1" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P2" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P0" } });
      // River
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P1" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P2" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P0" } });

      expect(table.currentHandState!.currentRound).toBe("Showdown");

      // Mid-hand: P1 (Bob, who was SB in seat 1) leaves table
      table = tableReducer(table, { type: "leaveTable", playerId: "P1" });

      // Hand 2 starts.
      // 1. rotateDealerButton advances dealerIndex by 1: 0 -> 1.
      //    Wait! Seat 1 is occupied by P1, but P1 leaves in the queue flush.
      //    So Seat 1 becomes empty, making dealerIndex = 1 a Dead Button!
      // 2. Active players are Seat 0 (Alice) and Seat 2 (Carol) -> Heads-up!
      // 3. Since there are only 2 players, the dealer is SB and the other is BB.
      //    The dealer seat is the counter-clockwise closest active seat to dealerIndex (1)
      //    - Seat 0 distance to 1: (1 - 0 + 6) % 6 = 1.
      //    - Seat 2 distance to 1: (1 - 2 + 6) % 6 = 5.
      //    So Seat 0 (Alice) is the dealer.
      //    Therefore, Seat 0 posts SB, and Seat 2 posts BB.
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      
      expect(table.seats[1]!.status).toBe("empty"); // Bob evicted
      expect(table.dealerIndex).toBe(1); // Dead button at seat 1
      expect(table.currentHandState!.config.dealerIndex).toBe(0); // Alice is dealer in the hand
      expect(table.currentHandState!.players[0]!.id).toBe("P0"); // P0 is index 0 in hand.players
    });
  });

  describe("Blind Skip / mustWaitForBB Enforcement", () => {
    it("should enforce new players to wait for Big Blind unless button passes them", () => {
      let table = createTable(config);
      table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
      table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });
      table = tableReducer(table, { type: "joinTable", playerId: "P3", name: "Carol", buyIn: 1000, seatIndex: 3 });
      
      // Hand 1 starts (P0, P1, P3 active). dealerIndex = 0.
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      expect(table.currentHandState!.players.length).toBe(3);

      // David (P2) joins mid-hand at Seat 2 (between Seat 1 and Seat 3)
      table = tableReducer(table, { type: "joinTable", playerId: "P2", name: "David", buyIn: 1000, seatIndex: 2 });
      expect(table.pendingJoins.length).toBe(1);

      // Fold through to end the hand
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "call", playerId: "P0" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "call", playerId: "P1" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "check", playerId: "P3" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P1" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P3" } });
      expect(table.currentHandState!.currentRound).toBe("Ended");

      // Start Hand 2:
      // P2 joins Seat 2 with mustWaitForBB = true
      // Button rotates 0 -> 1.
      // Active seats are Seat 0, Seat 1, Seat 3.
      // The BB position in Hand 2 is Seat 0 (prev BB was Seat 3, next occupied is Seat 0).
      // Since BB position (Seat 0) has not reached Seat 2 (BB was at 3, moved to 0, did not pass 2):
      // Seat 2 (P2) must still wait!
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      
      expect(table.seats[2]!.status).toBe("occupied");
      expect(table.seats[2]!.mustWaitForBB).toBe(true); // Still waiting
      expect(table.currentHandState!.players.length).toBe(3); // Alice, Bob, Carol in hand

      // Fold to end Hand 2
      // Actor order: P1, P3, P0. We fold P1 and P3.
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P1" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P3" } });
      expect(table.currentHandState!.currentRound).toBe("Ended");

      // Start Hand 3:
      // Button rotates 1 -> 2 (dead button at Seat 2).
      // Active occupied seats are Seat 0, Seat 1, Seat 3.
      // Previous BB was Seat 0.
      // New BB position should rotate clockwise to Seat 1.
      // Seat 2 is not passed by BB position (which stopped at 1).
      // So Seat 2 (P2) must still wait!
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      expect(table.seats[2]!.mustWaitForBB).toBe(true);
      expect(table.currentHandState!.players.length).toBe(3);

      // Fold to end Hand 3
      // Actor order: P1, P3, P0. We fold P1 and P3.
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P1" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P3" } });
      expect(table.currentHandState!.currentRound).toBe("Ended");

      // Start Hand 4:
      // Button rotates 2 -> 3.
      // Previous BB was Seat 0 (in Hand 3).
      // New BB position should rotate clockwise to Seat 1.
      // Seat 2 is not passed by BB position (which stopped at 1).
      // So Seat 2 (P2) must still wait!
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      expect(table.seats[2]!.mustWaitForBB).toBe(true);
      expect(table.currentHandState!.players.length).toBe(3);

      // Fold to end Hand 4
      // Actor order: Carol (P3) is dealer, Alice (P0) is SB, Bob (P1) is BB.
      // Preflop action starts with Carol (P3) acting first.
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P3" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P0" } });
      expect(table.currentHandState!.currentRound).toBe("Ended");

      // Start Hand 5:
      // Button rotates 3 -> 4 (dead button at Seat 4).
      // Previous BB was Seat 1.
      // New BB position rotates to Seat 2! (lands on Seat 2)
      // So mustWaitForBB is cleared for Seat 2!
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      expect(table.seats[2]!.mustWaitForBB).toBe(false);
      expect(table.currentHandState!.players.length).toBe(4); // Alice, Bob, Carol, David all in!
    });

    it("should keep mustWaitForBB true for newly joined players if the previous BB player leaves the table and the Big Blind has not passed them", () => {
      let table = createTable(config);
      table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
      table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });
      table = tableReducer(table, { type: "joinTable", playerId: "P2", name: "Carol", buyIn: 1000, seatIndex: 2 });
      
      // Hand 1 starts. Alice (0) is dealer, Bob (1) is SB, Carol (2) is BB.
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });
      expect(table.currentHandState!.players.length).toBe(3);

      // David (P3) joins mid-hand at Seat 4
      table = tableReducer(table, { type: "joinTable", playerId: "P3", name: "David", buyIn: 1000, seatIndex: 4 });
      
      // Frank (P4) joins mid-hand at Seat 5
      table = tableReducer(table, { type: "joinTable", playerId: "P4", name: "Frank", buyIn: 1000, seatIndex: 5 });

      // Carol (P2 / BB in Seat 2) leaves mid-hand
      table = tableReducer(table, { type: "leaveTable", playerId: "P2" });

      // Fold to end Hand 1
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P0" } });
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P1" } });
      expect(table.currentHandState!.currentRound).toBe("Ended");

      // Start Hand 2:
      // P2 leaves (Seat 2 empty), P3 and P4 join Seat 4 and 5 with mustWaitForBB = true.
      // Button rotates 0 -> 1.
      // Active occupied seats: Seat 0 (Alice), Seat 1 (Bob), Seat 4 (David), Seat 5 (Frank).
      // Previous BB was Carol at Seat 2.
      // The Big Blind position rotates clockwise from Seat 2 to the next occupied seat, which is Seat 4 (David).
      // So BB lands on Seat 4.
      // Thus, Seat 4 (David) should have mustWaitForBB = false and be dealt in.
      // But Seat 5 (Frank) is not passed or landed on by BB (which stopped at Seat 4).
      // So Seat 5 (Frank) must still wait!
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });

      // Verify Seat 4 has mustWaitForBB cleared
      expect(table.seats[4]!.mustWaitForBB).toBe(false);
      // Verify Seat 5 still has mustWaitForBB = true
      expect(table.seats[5]!.mustWaitForBB).toBe(true);

      // Active players in Hand 2 should be: Alice (0), Bob (1), David (4). Frank (5) is not in Hand 2.
      expect(table.currentHandState!.players.length).toBe(3);
      expect(table.currentHandState!.players.map(p => p.id)).toEqual(["P0", "P1", "P3"]);
    });
  });

  describe("Concurrency & Race Conditions", () => {
    it("should handle mid-hand leave and re-join of the same player atomically in sequence", () => {
      let table = createTable(config);
      table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 0 });
      table = tableReducer(table, { type: "joinTable", playerId: "P1", name: "Bob", buyIn: 1000, seatIndex: 1 });

      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });

      // P0 leaves mid-hand (scheduled for leave)
      table = tableReducer(table, { type: "leaveTable", playerId: "P0" });
      expect(table.pendingLeaves).toContain("P0");

      // P0 joins another seat (Seat 2) mid-hand (scheduled for join)
      table = tableReducer(table, { type: "joinTable", playerId: "P0", name: "Alice", buyIn: 1000, seatIndex: 2 });
      expect(table.pendingJoins.some(j => j.playerId === "P0")).toBe(true);

      // Complete the hand by folding P0
      table = tableReducer(table, { type: "dispatchHandAction", action: { type: "fold", playerId: "P0" } });
      expect(table.currentHandState!.currentRound).toBe("Ended");

      // Transition to next hand: queues are flushed (leave first, then join)
      table = tableReducer(table, { type: "startNextHand", deck: mockDeck });

      // P0 should be completely cleared from Seat 0
      expect(table.seats[0]!.status).toBe("empty");
      expect(table.seats[0]!.playerId).toBeNull();

      // P0 should be seated at Seat 2
      expect(table.seats[2]!.status).toBe("occupied");
      expect(table.seats[2]!.playerId).toBe("P0");
    });
  });
});
