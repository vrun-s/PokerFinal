import { Card } from "../types/Card.js";
import { BestHand } from "../types/BestHand.js";
import { PokerError } from "../errors/PokerError.js";
import { combinations } from "../utils/combinations.js";
import { classify } from "./classify.js";
import { scoreHand } from "./score.js";

/**
 * Compares two score arrays lexicographically.
 * Returns positive if a > b, negative if a < b, and 0 if equal.
 */
function compareScores(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const valA = a[i];
    const valB = b[i];
    if (valA !== undefined && valB !== undefined) {
      if (valA > valB) return 1;
      if (valA < valB) return -1;
    }
  }
  return a.length - b.length;
}

/**
 * Evaluates a set of 5 or more cards (typically 7 in Texas Hold'em)
 * and returns the best 5-card hand.
 *
 * If two different 5-card combinations produce identical scores,
 * the first combination generated is kept.
 *
 * @param cards The array of cards (at least 5).
 * @throws {PokerError} INVALID_BEST_HAND_SIZE if cards.length < 5.
 * @returns The best 5-card hand representation.
 */
export function bestHand(cards: readonly Card[]): BestHand {
  if (cards.length < 5) {
    throw new PokerError(
      "INVALID_BEST_HAND_SIZE",
      `bestHand requires at least 5 cards. Received ${cards.length}.`
    );
  }

  // 1. Generate all C(n, 5) combinations
  const combos = combinations(cards, 5);

  // 2. Classify, score, and reduce to find the best combination
  let best: BestHand | null = null;

  for (const combo of combos) {
    const classification = classify(combo);
    const score = scoreHand(classification);
    const currentHand: BestHand = {
      cards: combo,
      classification,
      score,
    };

    if (best === null) {
      best = currentHand;
    } else {
      const cmp = compareScores(score, best.score);
      // Keep first on tiebreak (only replace if strictly better)
      if (cmp > 0) {
        best = currentHand;
      }
    }
  }

  // This will never be null because combinations throws on k > length, meaning combos is non-empty.
  return best!;
}
