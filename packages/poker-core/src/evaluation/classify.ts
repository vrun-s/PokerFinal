import { Card } from "../types/Card.js";
import { Rank } from "../types/Rank.js";
import { Classification } from "../types/Classification.js";
import { HandRank } from "../types/HandRank.js";
import { PokerError } from "../errors/PokerError.js";
import { rankValue } from "../utils/cardUtils.js";

/**
 * Classifies a 5-card hand.
 * Strictly checks that the hand has exactly 5 cards.
 *
 * Policy for primaryCards and kickers:
 * - HighCard: primaryCards = [], kickers = all 5 cards (sorted descending)
 * - OnePair: primaryCards = 2 cards of the pair, kickers = 3 remaining cards (sorted descending)
 * - TwoPair: primaryCards = 4 cards of the two pairs (sorted descending by pair rank), kickers = 1 remaining card
 * - ThreeOfAKind: primaryCards = 3 cards of the set, kickers = 2 remaining cards (sorted descending)
 * - Straight: primaryCards = all 5 cards forming the straight, kickers = []
 * - Flush: primaryCards = all 5 cards forming the flush (sorted descending), kickers = []
 * - FullHouse: primaryCards = all 5 cards (3 cards of the set, then 2 cards of the pair), kickers = []
 * - FourOfAKind: primaryCards = 4 cards of the quad, kickers = 1 remaining card
 * - StraightFlush: primaryCards = all 5 cards forming the straight flush, kickers = []
 *
 * Cascade Order:
 * 1. Straight Flush
 * 2. Four of a Kind
 * 3. Full House
 * 4. Flush
 * 5. Straight
 * 6. Three of a Kind
 * 7. Two Pair
 * 8. One Pair
 * 9. High Card
 *
 * @param cards Exactly 5 cards to classify.
 * @throws {PokerError} INVALID_HAND_SIZE if cards.length !== 5.
 * @returns The hand Classification.
 */
export function classify(cards: readonly Card[]): Classification {
  if (cards.length !== 5) {
    throw new PokerError(
      "INVALID_HAND_SIZE",
      `classify must be called with exactly 5 cards. Received ${cards.length}.`
    );
  }

  // 1. Sort cards by rank value descending
  const sorted = [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));

  // 2. Check flush
  const isFlush = sorted.every((c) => c.suit === sorted[0]!.suit);

  // 3. Check straight (including Wheel straight A-2-3-4-5)
  const rankVals = sorted.map((c) => rankValue(c.rank));
  let isStraight = false;
  let isWheel = false;

  // Regular straight: 5 unique consecutive ranks
  const uniqueRanksCount = new Set(rankVals).size;
  if (uniqueRanksCount === 5) {
    if (rankVals[0]! - rankVals[4]! === 4) {
      isStraight = true;
    } else if (
      rankVals[0] === 14 && // Ace
      rankVals[1] === 5 &&
      rankVals[2] === 4 &&
      rankVals[3] === 3 &&
      rankVals[4] === 2
    ) {
      isStraight = true;
      isWheel = true;
    }
  }

  // Rearrange cards for straight/wheel representation
  let straightCards = sorted;
  if (isWheel) {
    // Put Ace at the end because it acts as low card (5-4-3-2-A)
    straightCards = [sorted[1]!, sorted[2]!, sorted[3]!, sorted[4]!, sorted[0]!];
  }

  // 4. Group by rank to check duplicates
  const groupMap = new Map<Rank, Card[]>();
  for (const card of sorted) {
    const list = groupMap.get(card.rank) || [];
    list.push(card);
    groupMap.set(card.rank, list);
  }

  const groups = Array.from(groupMap.entries()).map(([rank, list]) => ({
    rank,
    cards: list,
    count: list.length,
  }));

  // Sort groups: count descending, then rank value descending
  groups.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return rankValue(b.rank) - rankValue(a.rank);
  });

  // Cascade classification checks
  if (isStraight && isFlush) {
    return {
      rank: HandRank.StraightFlush,
      primaryCards: straightCards,
      kickers: [],
    };
  }

  if (groups[0]!.count === 4) {
    return {
      rank: HandRank.FourOfAKind,
      primaryCards: groups[0]!.cards,
      kickers: groups[1]!.cards,
    };
  }

  if (groups[0]!.count === 3 && groups[1]!.count === 2) {
    return {
      rank: HandRank.FullHouse,
      primaryCards: [...groups[0]!.cards, ...groups[1]!.cards],
      kickers: [],
    };
  }

  if (isFlush) {
    return {
      rank: HandRank.Flush,
      primaryCards: sorted,
      kickers: [],
    };
  }

  if (isStraight) {
    return {
      rank: HandRank.Straight,
      primaryCards: straightCards,
      kickers: [],
    };
  }

  if (groups[0]!.count === 3) {
    return {
      rank: HandRank.ThreeOfAKind,
      primaryCards: groups[0]!.cards,
      kickers: [...groups[1]!.cards, ...groups[2]!.cards],
    };
  }

  if (groups[0]!.count === 2 && groups[1]!.count === 2) {
    return {
      rank: HandRank.TwoPair,
      primaryCards: [...groups[0]!.cards, ...groups[1]!.cards],
      kickers: groups[2]!.cards,
    };
  }

  if (groups[0]!.count === 2) {
    return {
      rank: HandRank.OnePair,
      primaryCards: groups[0]!.cards,
      kickers: [...groups[1]!.cards, ...groups[2]!.cards, ...groups[3]!.cards],
    };
  }

  // High Card
  return {
    rank: HandRank.HighCard,
    primaryCards: [],
    kickers: sorted,
  };
}
