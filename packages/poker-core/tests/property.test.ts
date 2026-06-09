import { describe, it, expect } from "vitest";
import { createDeck } from "../src/deck/createDeck.js";
import { shuffleDeck } from "../src/deck/shuffleDeck.js";
import { dealCards } from "../src/deck/dealCards.js";
import { bestHand } from "../src/evaluation/bestHand.js";
import { compareHands } from "../src/evaluation/compareHands.js";
import { HandRank } from "../src/types/HandRank.js";

// Expected score lengths for each HandRank category
const EXPECTED_SCORE_LENGTHS: Record<HandRank, number> = {
  [HandRank.HighCard]: 6,
  [HandRank.OnePair]: 5,
  [HandRank.TwoPair]: 4,
  [HandRank.ThreeOfAKind]: 4,
  [HandRank.Straight]: 2,
  [HandRank.Flush]: 6,
  [HandRank.FullHouse]: 3,
  [HandRank.FourOfAKind]: 3,
  [HandRank.StraightFlush]: 2,
};

describe("Property-based Invariant Tests", () => {
  it("should validate evaluation and comparison invariants over many random hands", () => {
    const deck = createDeck();
    let seededPRNGState = 42;
    // Simple LCG PRNG for reproducible test runs
    const lcg = () => {
      seededPRNGState = (seededPRNGState * 1664525 + 1013904223) % 4294967296;
      return seededPRNGState / 4294967296;
    };

    // Run over 100 random deals
    for (let i = 0; i < 100; i++) {
      const shuffled = shuffleDeck(deck, lcg);

      // Deal 7 cards to Player A and 7 cards to Player B
      const dealA = dealCards(shuffled, 7);
      const dealB = dealCards(dealA.remaining, 7);

      const handA = bestHand(dealA.dealt);
      const handB = bestHand(dealB.dealt);

      // Invariant 1: bestHand(cards).cards.length is always exactly 5
      expect(handA.cards.length).toBe(5);
      expect(handB.cards.length).toBe(5);

      // Invariant 2: Score array lengths are strictly consistent per HandRank
      const lenA = EXPECTED_SCORE_LENGTHS[handA.classification.rank];
      const lenB = EXPECTED_SCORE_LENGTHS[handB.classification.rank];
      expect(handA.score.length).toBe(lenA);
      expect(handB.score.length).toBe(lenB);

      // Invariant 3: compareHands is reflexive (a vs a is always a tie)
      const reflexiveRes = compareHands(handA, handA);
      expect(reflexiveRes.result).toBe("tie");
      if (reflexiveRes.result === "tie") {
        expect(reflexiveRes.winners[0]).toBe(handA);
        expect(reflexiveRes.winners[1]).toBe(handA);
      }

      // Invariant 4: compareHands is antisymmetric
      const resAB = compareHands(handA, handB);
      const resBA = compareHands(handB, handA);

      if (resAB.result === "win") {
        expect(resBA.result).toBe("loss");
        expect(resBA.winner).toBe(handA);
      } else if (resAB.result === "loss") {
        expect(resBA.result).toBe("win");
        expect(resBA.winner).toBe(handB);
      } else {
        expect(resBA.result).toBe("tie");
        expect(resBA.winners).toContain(handA);
        expect(resBA.winners).toContain(handB);
      }
    }
  });
});
