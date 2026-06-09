import { Card } from "../types/Card.js";
import { BestHand } from "../types/BestHand.js";
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
export declare function bestHand(cards: readonly Card[]): BestHand;
