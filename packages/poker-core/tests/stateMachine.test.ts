import { describe, it, expect } from "vitest";
import { parseCard } from "../src/utils/cardUtils.js";
import { startHand, transition } from "../src/state-machine/reducer.js";
import { calculatePots, distributePayouts } from "../src/state-machine/potCalculations.js";
import { compareMany } from "../src/evaluation/compareMany.js";
import { HandConfig, SeatConfig, HandState, PlayerState } from "../src/types/GameState.js";
import { Card } from "../src/types/Card.js";
import { bestHand } from "../src/evaluation/bestHand.js";

// Helper to make mock decks
function makeMockDeck(cardStrings: string[]): Card[] {
  return cardStrings.map(parseCard);
}

describe("Game State Machine (Phase 3)", () => {
  const config: HandConfig = {
    smallBlind: 10,
    bigBlind: 20,
    dealerIndex: 0, // Player 0 is dealer
  };

  const seats: SeatConfig[] = [
    { id: "P0", name: "Player 0", stack: 1000 },
    { id: "P1", name: "Player 1", stack: 1000 },
    { id: "P2", name: "Player 2", stack: 1000 },
  ];

  // A standard deck run with mock cards:
  // P0 hole cards: Ah, Kh
  // P1 hole cards: Qd, Jd
  // P2 hole cards: Ts, 9s
  // Community cards: 2c, 3c, 4c, 5c, 6c
  const mockDeck = makeMockDeck([
    "Ah", "Kh", // P0
    "Qd", "Jd", // P1
    "Ts", "9s", // P2
    "2c", "3c", "4c", "5c", "6c", // Flop, Turn, River
  ]);

  describe("startHand", () => {
    it("should initialize a standard 3-player hand correctly", () => {
      const state = startHand(config, seats, mockDeck);

      expect(state.currentRound).toBe("PreFlop");
      expect(state.communityCards.length).toBe(0);
      expect(state.currentBet).toBe(20);
      expect(state.lastRaiseSize).toBe(20);

      // Verify players receive cards
      expect(state.players[0]!.cards).toEqual([parseCard("Ah"), parseCard("Kh")]);
      expect(state.players[1]!.cards).toEqual([parseCard("Qd"), parseCard("Jd")]);
      expect(state.players[2]!.cards).toEqual([parseCard("Ts"), parseCard("9s")]);

      // Small Blind index: (0 + 1) % 3 = 1 (P1). Big Blind index: (0 + 2) % 3 = 2 (P2).
      // UTG: (0 + 3) % 3 = 0 (P0) acts first preflop.
      expect(state.actorIndex).toBe(0);

      // Verify stacks after blinds
      expect(state.players[0]!.stack).toBe(1000); // P0 (dealer) has not posted yet
      expect(state.players[1]!.stack).toBe(990);  // P1 (SB) posted 10
      expect(state.players[2]!.stack).toBe(980);  // P2 (BB) posted 20

      // Verify current round bets
      expect(state.players[0]!.currentRoundBet).toBe(0);
      expect(state.players[1]!.currentRoundBet).toBe(10);
      expect(state.players[2]!.currentRoundBet).toBe(20);

      // Pots should have 30 chips total, split into main pot (20) and SB uncontested side bet (10)
      expect(state.pots.length).toBe(2);
      expect(state.pots[0]!.amount).toBe(20);
      expect(state.pots[1]!.amount).toBe(10);
    });

    it("should handle heads-up (2-player) blinds and actor order correctly", () => {
      const huSeats = seats.slice(0, 2);
      const state = startHand(config, huSeats, mockDeck);

      // Heads-up: dealer posts SB and acts first preflop.
      // SB = P0 (dealer, index 0). BB = P1 (index 1).
      expect(state.players[0]!.stack).toBe(990); // P0 (SB) posted 10
      expect(state.players[1]!.stack).toBe(980); // P1 (BB) posted 20
      expect(state.actorIndex).toBe(0);           // Dealer (P0) acts first preflop
    });

    it("should handle all-in blinds during startHand", () => {
      const lowStackSeats: SeatConfig[] = [
        { id: "P0", name: "Player 0", stack: 1000 },
        { id: "P1", name: "Player 1", stack: 5 },   // Less than SB (10)
        { id: "P2", name: "Player 2", stack: 12 },  // Less than BB (20)
      ];

      const state = startHand(config, lowStackSeats, mockDeck);

      expect(state.players[1]!.stack).toBe(0);
      expect(state.players[1]!.status).toBe("all-in");
      expect(state.players[1]!.currentRoundBet).toBe(5);

      expect(state.players[2]!.stack).toBe(0);
      expect(state.players[2]!.status).toBe("all-in");
      expect(state.players[2]!.currentRoundBet).toBe(12);

      // Current bet is max(5, 12) = 12
      expect(state.currentBet).toBe(12);
    });
  });

  describe("transition & Action Validation", () => {
    it("should return NOT_PLAYER_TURN if out of turn", () => {
      const state = startHand(config, seats, mockDeck);
      // P0 turn, try acting with P1
      const res = transition(state, { type: "fold", playerId: "P1" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("NOT_PLAYER_TURN");
      }
    });

    it("should return INVALID_CHECK if checking against a bet", () => {
      const state = startHand(config, seats, mockDeck);
      // P0 turn. Current bet is 20, P0 bet is 0. Check is illegal.
      const res = transition(state, { type: "check", playerId: "P0" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("INVALID_CHECK");
      }
    });

    it("should return INVALID_RAISE_AMOUNT if raise is below minimum", () => {
      const state = startHand(config, seats, mockDeck);
      // P0 turn. Current bet is 20. Min raise is to 40 (currentBet + lastRaiseSize).
      // Attempting to raise to 30.
      const res = transition(state, { type: "raise", playerId: "P0", totalBet: 30 });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("INVALID_RAISE_AMOUNT");
      }
    });

    it("should return INVALID_RAISE_AMOUNT if raise exceeds player stack", () => {
      const state = startHand(config, seats, mockDeck);
      // P0 has stack 1000. Try raising to 2000.
      const res = transition(state, { type: "raise", playerId: "P0", totalBet: 2000 });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("INVALID_RAISE_AMOUNT");
      }
    });
  });

  describe("Linear Hand Flow (Checks, Calls, and Raises)", () => {
    it("should complete a hand with standard actions through all rounds", () => {
      let state = startHand(config, seats, mockDeck);

      // --- PreFlop ---
      // P0 (actorIndex: 0) calls 20
      let res = transition(state, { type: "call", playerId: "P0" });
      expect(res.ok).toBe(true);
      state = (res as any).value;
      expect(state.players[0]!.currentRoundBet).toBe(20);
      expect(state.players[0]!.stack).toBe(980);
      expect(state.actorIndex).toBe(1); // Next: P1

      // P1 (actorIndex: 1) calls 20 (already posted 10, pays 10)
      res = transition(state, { type: "call", playerId: "P1" });
      expect(res.ok).toBe(true);
      state = (res as any).value;
      expect(state.players[1]!.currentRoundBet).toBe(20);
      expect(state.players[1]!.stack).toBe(980);
      expect(state.actorIndex).toBe(2); // Next: P2

      // P2 (actorIndex: 2) checks 20 (already posted 20)
      res = transition(state, { type: "check", playerId: "P2" });
      expect(res.ok).toBe(true);
      state = (res as any).value;

      // Betting complete! Preflop should have transitioned to Flop.
      expect(state.currentRound).toBe("Flop");
      expect(state.communityCards.map(c => c.rank + c.suit[0])).toEqual(["2c", "3c", "4c"]);
      expect(state.currentBet).toBe(0);
      expect(state.players.every(p => p.currentRoundBet === 0)).toBe(true);
      expect(state.pots[0]!.amount).toBe(60); // 3 * 20

      // Flop: first actor is SB (P1, index 1)
      expect(state.actorIndex).toBe(1);

      // --- Flop ---
      // P1 checks
      res = transition(state, { type: "check", playerId: "P1" });
      state = (res as any).value;

      // P2 checks
      res = transition(state, { type: "check", playerId: "P2" });
      state = (res as any).value;

      // P0 checks
      res = transition(state, { type: "check", playerId: "P0" });
      state = (res as any).value;

      // Flop complete! Advances to Turn.
      expect(state.currentRound).toBe("Turn");
      expect(state.communityCards.length).toBe(4);
      expect(state.pots[0]!.amount).toBe(60);
      expect(state.actorIndex).toBe(1); // SB acts first

      // --- Turn ---
      // P1 bets 50 (represented as raise to 50 when currentBet is 0)
      res = transition(state, { type: "raise", playerId: "P1", totalBet: 50 });
      state = (res as any).value;
      expect(state.currentBet).toBe(50);
      expect(state.lastRaiseSize).toBe(50);
      expect(state.actorIndex).toBe(2);

      // P2 folds
      res = transition(state, { type: "fold", playerId: "P2" });
      state = (res as any).value;
      expect(state.players[2]!.status).toBe("folded");
      expect(state.actorIndex).toBe(0);

      // P0 calls 50
      res = transition(state, { type: "call", playerId: "P0" });
      state = (res as any).value;

      // Turn complete! Advances to River.
      expect(state.currentRound).toBe("River");
      expect(state.communityCards.length).toBe(5);
      expect(state.pots[0]!.amount).toBe(160); // 60 + 50 (P1) + 50 (P0)
      expect(state.actorIndex).toBe(1); // P1 acts first, P2 is folded.

      // --- River ---
      // P1 checks
      res = transition(state, { type: "check", playerId: "P1" });
      state = (res as any).value;

      // P0 checks
      res = transition(state, { type: "check", playerId: "P0" });
      state = (res as any).value;

      // River complete! Advances to Showdown.
      expect(state.currentRound).toBe("Showdown");
      expect(state.actorIndex).toBe(-1);
    });

    it("should terminate immediately if everyone folds to one player", () => {
      let state = startHand(config, seats, mockDeck);

      // P0 folds
      let res = transition(state, { type: "fold", playerId: "P0" });
      state = (res as any).value;

      // P1 folds
      res = transition(state, { type: "fold", playerId: "P1" });
      state = (res as any).value;

      // Hand should be ended immediately
      expect(state.currentRound).toBe("Ended");
      expect(state.actorIndex).toBe(-1);

      // P2 wins uncontested
      const payouts = distributePayouts(state.pots, state.players, state.communityCards, config.dealerIndex);
      const p2Payout = payouts.payouts.find(p => p.playerId === "P2")?.amount;
      expect(p2Payout).toBe(30);
    });
  });

  describe("Side Pot Calculations", () => {
    it("should compute side pots correctly for varying all-ins", () => {
      const allInSeats: SeatConfig[] = [
        { id: "P0", name: "Player 0", stack: 50 },
        { id: "P1", name: "Player 1", stack: 100 },
        { id: "P2", name: "Player 2", stack: 150 },
      ];

      // A simple mock deck where P0 and P1 go all-in preflop
      let state = startHand(config, allInSeats, mockDeck);

      // P1 posted SB 10. P2 posted BB 12 (since stack is 12? Wait, config BB is 20, but P2 stack is 150, so BB is 20).
      // Preflop:
      // SB = P1 (stack = 90 left, bet = 10)
      // BB = P2 (stack = 130 left, bet = 20)
      // Actor: P0 (dealer, stack = 50 total). P0 goes all-in for 50.
      let res = transition(state, { type: "raise", playerId: "P0", totalBet: 50 });
      state = (res as any).value;
      expect(state.players[0]!.status).toBe("all-in");

      // Next actor is P1. P1 raises all-in to 100.
      res = transition(state, { type: "raise", playerId: "P1", totalBet: 100 });
      state = (res as any).value;
      expect(state.players[1]!.status).toBe("all-in");

      // Next actor is P2. P2 calls 100 (total bet = 100).
      res = transition(state, { type: "call", playerId: "P2" });
      state = (res as any).value;

      // Betting round is complete, but because two players are all-in (P0, P1) and only P2 remains active,
      // it should trigger skip-to-showdown.
      expect(state.currentRound).toBe("Showdown");
      expect(state.communityCards.length).toBe(5);

      // Verify pots:
      // P0 total bet: 50
      // P1 total bet: 100
      // P2 total bet: 100
      // Pots:
      // Pot 1 (Main): 50 (P0) + 50 (P1) + 50 (P2) = 150. Eligible: P0, P1, P2.
      // Pot 2 (Side): 50 (P1) + 50 (P2) = 100. Eligible: P1, P2.
      const pots = calculatePots(state.players);
      expect(pots.length).toBe(2);
      expect(pots[0]!.amount).toBe(150);
      expect(pots[0]!.eligiblePlayerIds).toContain("P0");
      expect(pots[0]!.eligiblePlayerIds).toContain("P1");
      expect(pots[0]!.eligiblePlayerIds).toContain("P2");

      expect(pots[1]!.amount).toBe(100);
      expect(pots[1]!.eligiblePlayerIds).not.toContain("P0");
      expect(pots[1]!.eligiblePlayerIds).toContain("P1");
      expect(pots[1]!.eligiblePlayerIds).toContain("P2");
    });

    it("should handle folded all-in players correctly by excluding them", () => {
      const players: PlayerState[] = [
        {
          id: "P0",
          name: "P0",
          stack: 0,
          cards: [parseCard("As"), parseCard("Ks")],
          currentRoundBet: 0,
          totalHandBet: 50,
          status: "all-in",
          hasActed: true,
        },
        {
          id: "P1",
          name: "P1",
          stack: 0,
          cards: [parseCard("Qs"), parseCard("Js")],
          currentRoundBet: 0,
          totalHandBet: 100,
          status: "folded", // folded all-in!
          hasActed: true,
        },
        {
          id: "P2",
          name: "P2",
          stack: 100,
          cards: [parseCard("Ts"), parseCard("9s")],
          currentRoundBet: 0,
          totalHandBet: 100,
          status: "active",
          hasActed: true,
        },
      ];

      const pots = calculatePots(players);
      // Bets: 50, 100.
      // Pot 1 (up to 50): P0 (50) + P1 (50) + P2 (50) = 150.
      // Eligible: P0, P2 (P1 is folded).
      // Pot 2 (up to 100): P1 (50) + P2 (50) = 100.
      // Eligible: P2 (P1 is folded).
      expect(pots.length).toBe(2);
      expect(pots[0]!.amount).toBe(150);
      expect(pots[0]!.eligiblePlayerIds).toEqual(["P0", "P2"]);
      expect(pots[1]!.amount).toBe(100);
      expect(pots[1]!.eligiblePlayerIds).toEqual(["P2"]);
    });
  });

  describe("Odd Chip Distribution", () => {
    it("should allocate odd chips to the player closest to the left of the button", () => {
      // 3 players: P0 (button/dealer), P1 (SB), P2 (BB).
      // N = 3.
      // sbIndex = 1, bbIndex = 2.
      // dealerIndex = 0.
      // Distance from button clockwise:
      // P1: (1 - 0 - 1 + 3) % 3 = 0 (closest)
      // P2: (2 - 0 - 1 + 3) % 3 = 1
      // P0: (0 - 0 - 1 + 3) % 3 = 2
      // Let's create a pot of 100 chips and split it between P0, P1, and P2.
      const pots = [{ amount: 100, eligiblePlayerIds: ["P0", "P1", "P2"] }];
      const players: PlayerState[] = [
        { id: "P0", name: "P0", stack: 500, cards: [parseCard("As"), parseCard("Ks")], currentRoundBet: 0, totalHandBet: 100, status: "active", hasActed: true },
        { id: "P1", name: "P1", stack: 500, cards: [parseCard("Ad"), parseCard("Kd")], currentRoundBet: 0, totalHandBet: 100, status: "active", hasActed: true },
        { id: "P2", name: "P2", stack: 500, cards: [parseCard("Ah"), parseCard("Kh")], currentRoundBet: 0, totalHandBet: 100, status: "active", hasActed: true },
      ];
      // All three have the same hand (Ace-King high), so they all tie.
      const communityCards = makeMockDeck(["2c", "3d", "4h", "5s", "8c"]);

      const results = distributePayouts(pots, players, communityCards, 0);
      const p0 = results.payouts.find(p => p.playerId === "P0")?.amount;
      const p1 = results.payouts.find(p => p.playerId === "P1")?.amount;
      const p2 = results.payouts.find(p => p.playerId === "P2")?.amount;

      // 100 / 3 = 33 chips each. Remainder = 1 chip.
      // Winner closest to SB is P1 (SB). So P1 gets 34 chips, P2 gets 33, P0 gets 33.
      expect(p1).toBe(34);
      expect(p2).toBe(33);
      expect(p0).toBe(33);
    });
  });

  describe("compareMany", () => {
    it("should resolve winner and rankings correctly for multiple hands", () => {
      const p1Hand = bestHand(makeMockDeck(["Ah", "Kh", "2c", "3c", "4c", "5c", "6c"])); // Straight Flush
      const p2Hand = bestHand(makeMockDeck(["Qd", "Jd", "2d", "3c", "4c", "5c", "6c"])); // Straight
      const p3Hand = bestHand(makeMockDeck(["Ts", "9s", "2c", "3c", "4c", "5d", "8d"])); // High Card

      const compareRes = compareMany([
        { playerId: "P1", bestHand: p1Hand },
        { playerId: "P2", bestHand: p2Hand },
        { playerId: "P3", bestHand: p3Hand },
      ]);

      expect(compareRes.winners).toEqual(["P1"]);
      expect(compareRes.rankings).toEqual(["P1", "P2", "P3"]);
    });
  });

  describe("Under-Raise (All-In for Less) Branch", () => {
    it("should not reset other players hasActed flags during an under-raise", () => {
      // 3 players.
      // P0 = 1000 chips. P1 = 1000 chips. P2 = 30 chips.
      const seatsWithShortStack: SeatConfig[] = [
        { id: "P0", name: "Player 0", stack: 1000 },
        { id: "P1", name: "Player 1", stack: 1000 },
        { id: "P2", name: "Player 2", stack: 30 },
      ];

      let state = startHand(config, seatsWithShortStack, mockDeck);

      // Preflop:
      // SB = P1 (posts 10, stack = 990)
      // BB = P2 (posts 20, stack = 10)
      // Current bet = 20. Last raise = 20.
      // Actor: P0. P0 raises to 80 (adding 80).
      let res = transition(state, { type: "raise", playerId: "P0", totalBet: 80 });
      state = (res as any).value;
      expect(state.currentBet).toBe(80);
      expect(state.lastRaiseSize).toBe(60); // 80 - 20 = 60

      // Next: P1 calls 80 (already posted 10, adds 70, stack = 920).
      res = transition(state, { type: "call", playerId: "P1" });
      state = (res as any).value;
      expect(state.players[1]!.hasActed).toBe(true);

      // Next: P2. P2 has stack 10 left. They want to raise all-in.
      // Total bet P2 can reach is 20 (already bet) + 10 = 30.
      // This is a raise from 80 to 30? Wait! 30 is less than currentBet (80).
      // Wait, is a player allowed to "raise" to an amount LESS than the currentBet?
      // No! If the player's total stack is less than the call amount, they can only CALL (which puts them all-in for 30).
      // They cannot choose the "raise" action for less than the currentBet.
      // Let's check: what if the currentBet is 20, P0 raises to 30 all-in?
      // If currentBet is 20, P0's stack is 10, P0 can raise to 30.
      // Let's test this scenario instead:
      // SB = P1 (posts 10), BB = P2 (posts 20).
      // UTG = P0. P0 has stack 25. P0 raises to 25 (all-in).
      // Min raise was to 40. But P0 goes all-in for 25. This is an under-raise!
    });

    it("should allow an under-raise when player goes all-in, without resetting other player hasActed flags", () => {
      const seatsWithShortStack: SeatConfig[] = [
        { id: "P0", name: "Player 0", stack: 25 }, // Short stack
        { id: "P1", name: "Player 1", stack: 1000 },
        { id: "P2", name: "Player 2", stack: 1000 },
      ];

      let state = startHand(config, seatsWithShortStack, mockDeck);

      // Preflop:
      // SB = P1 (posted 10, stack = 990, hasActed = false)
      // BB = P2 (posted 20, stack = 980, hasActed = false)
      // Current bet = 20. Min raise is 40.
      // P1 calls 20 to check hasActed flags. Wait, let's play to SB:
      // P0 is actor. P0 raises to 25 all-in (adds 25).
      // Min raise was 40, so 25 is an under-raise!
      let res = transition(state, { type: "raise", playerId: "P0", totalBet: 25 });
      expect(res.ok).toBe(true);
      state = (res as any).value;

      expect(state.currentBet).toBe(25);
      expect(state.lastRaiseSize).toBe(20); // Unchanged! (Initial big blind was 20)
      expect(state.players[0]!.status).toBe("all-in");

      // Because it is an under-raise, other players' hasActed flags must NOT be reset.
      // Initially, they are all false anyway, but let's verify they remain false.
      expect(state.players[1]!.hasActed).toBe(false);
      expect(state.players[2]!.hasActed).toBe(false);
    });
  });
});
