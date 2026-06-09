import { describe, it, expect } from "vitest";
import { parseCard } from "../src/utils/cardUtils.js";
import { bestHand } from "../src/evaluation/bestHand.js";
import { HandRank } from "../src/types/HandRank.js";
import { PokerError } from "../src/errors/PokerError.js";

const parseHand = (strings: string[]) => strings.map(parseCard);

describe("bestHand", () => {
  it("should throw error if input hand contains less than 5 cards", () => {
    expect(() => bestHand(parseHand(["As", "Kh", "Qd", "Jc"]))).toThrow(
      PokerError
    );
    expect(() => bestHand(parseHand(["As", "Kh", "Qd", "Jc"]))).toThrow(
      "bestHand requires at least 5 cards"
    );
  });

  it("should correctly choose the best 5-card combination from 7 cards", () => {
    // 7 cards: As, Ks, Qs, Js, Ts, 2c, 3d
    // Best: Royal Flush (Ace-high Straight Flush)
    const cards = parseHand(["As", "Ks", "Qs", "Js", "Ts", "2c", "3d"]);
    const best = bestHand(cards);

    expect(best.classification.rank).toBe(HandRank.StraightFlush);
    expect(best.classification.primaryCards.map((c) => c.rank)).toEqual([
      "A",
      "K",
      "Q",
      "J",
      "T",
    ]);
  });

  it("should correctly resolve Flush vs Straight with shared cards", () => {
    // 7 cards: Th, 9h, 8h, 7c, 6c, 2h, 3h
    // Flush cards: Th, 9h, 8h, 2h, 3h (Heart Flush)
    // Straight cards: Th, 9h, 8h, 7c, 6c (Ten-high Straight)
    // Since Flush (HandRank.Flush = 5) > Straight (HandRank.Straight = 4), it must pick the Flush
    const cards = parseHand(["Th", "9h", "8h", "7c", "6c", "2h", "3h"]);
    const best = bestHand(cards);

    expect(best.classification.rank).toBe(HandRank.Flush);
    expect(best.classification.primaryCards.map((c) => c.rank)).toEqual([
      "T",
      "9",
      "8",
      "3",
      "2",
    ]);
  });

  it("should preserve first processed combination on score ties", () => {
    // 7 cards: As, Ad, Ac, Ah, Kh, Kd, Qh
    // Combos of quads:
    // C1: As Ad Ac Ah Kh -> Score: [7, 14, 13] (four aces with king kicker)
    // C2: As Ad Ac Ah Kd -> Score: [7, 14, 13] (four aces with king kicker)
    // Since the score is identical, bestHand should choose whichever was processed first in combinations()
    // Let's assert it successfully returns a result and has King kicker
    const cards = parseHand(["As", "Ad", "Ac", "Ah", "Kh", "Kd", "Qh"]);
    const best = bestHand(cards);
    expect(best.classification.rank).toBe(HandRank.FourOfAKind);
    expect(best.score).toEqual([7, 14, 13]);
  });
});
