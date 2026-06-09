import { HandRank } from "../types/HandRank.js";
import { rankValue } from "../utils/cardUtils.js";
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
export function scoreHand(classification) {
    const { rank, primaryCards, kickers } = classification;
    switch (rank) {
        case HandRank.HighCard:
            return [
                0,
                rankValue(kickers[0].rank),
                rankValue(kickers[1].rank),
                rankValue(kickers[2].rank),
                rankValue(kickers[3].rank),
                rankValue(kickers[4].rank),
            ];
        case HandRank.OnePair:
            return [
                1,
                rankValue(primaryCards[0].rank),
                rankValue(kickers[0].rank),
                rankValue(kickers[1].rank),
                rankValue(kickers[2].rank),
            ];
        case HandRank.TwoPair:
            return [
                2,
                rankValue(primaryCards[0].rank),
                rankValue(primaryCards[2].rank),
                rankValue(kickers[0].rank),
            ];
        case HandRank.ThreeOfAKind:
            return [
                3,
                rankValue(primaryCards[0].rank),
                rankValue(kickers[0].rank),
                rankValue(kickers[1].rank),
            ];
        case HandRank.Straight:
            return [
                4,
                rankValue(primaryCards[0].rank),
            ];
        case HandRank.Flush:
            return [
                5,
                rankValue(primaryCards[0].rank),
                rankValue(primaryCards[1].rank),
                rankValue(primaryCards[2].rank),
                rankValue(primaryCards[3].rank),
                rankValue(primaryCards[4].rank),
            ];
        case HandRank.FullHouse:
            return [
                6,
                rankValue(primaryCards[0].rank), // Trip rank
                rankValue(primaryCards[3].rank), // Pair rank
            ];
        case HandRank.FourOfAKind:
            return [
                7,
                rankValue(primaryCards[0].rank),
                rankValue(kickers[0].rank),
            ];
        case HandRank.StraightFlush:
            return [
                8,
                rankValue(primaryCards[0].rank),
            ];
    }
}
