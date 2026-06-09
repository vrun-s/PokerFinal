import { BestHand } from "../types/BestHand.js";
import { CompareManyResult } from "../types/CompareManyResult.js";

export interface PlayerHand {
  readonly playerId: string;
  readonly bestHand: BestHand;
}

/**
 * Compares two score arrays lexicographically.
 * Returns positive if a > b, negative if a < b, 0 if equal.
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
 * Compares multiple player hands and ranks them from best to worst.
 * Returns the winners (could be multiple on split) and the ordered list of player IDs.
 */
export function compareMany(playerHands: readonly PlayerHand[]): CompareManyResult {
  if (playerHands.length === 0) {
    return { winners: [], rankings: [] };
  }

  // Sort descending: best hand first (so we compare b to a)
  const sorted = [...playerHands].sort((a, b) => {
    return compareScores(b.bestHand.score, a.bestHand.score);
  });

  const rankings = sorted.map(ph => ph.playerId);

  const bestHandScore = sorted[0]!.bestHand.score;
  const winners = sorted
    .filter(ph => compareScores(ph.bestHand.score, bestHandScore) === 0)
    .map(ph => ph.playerId);

  return { winners, rankings };
}
