import { Card } from "../types/Card.js";
import { Classification } from "../types/Classification.js";
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
export declare function classify(cards: readonly Card[]): Classification;
