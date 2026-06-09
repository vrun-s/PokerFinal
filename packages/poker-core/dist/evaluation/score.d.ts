import { Classification } from "../types/Classification.js";
/**
 * Computes a lexicographical score array representing the hand strength.
 *
 * HandRank      score layout
 * HighCard      [0, k1, k2, k3, k4, k5]
 * OnePair       [1, pairRank, k1, k2, k3]
 * TwoPair       [2, highPairRank, lowPairRank, k1]
 * ThreeOfAKind  [3, tripRank, k1, k2]
 * Straight      [4, highCardRank]
 * Flush         [5, k1, k2, k3, k4, k5]
 * FullHouse     [6, tripRank, pairRank]
 * FourOfAKind   [7, quadRank, k1]
 * StraightFlush [8, highCardRank]
 *
 * @param classification The hand classification details.
 * @returns The numeric score array.
 */
export declare function scoreHand(classification: Classification): readonly number[];
