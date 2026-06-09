import { Card } from "./Card.js";
import { Classification } from "./Classification.js";
/**
 * Represents the best 5-card combination selected from a larger set.
 */
export interface BestHand {
    /**
     * The exactly 5 cards forming the best hand.
     */
    readonly cards: readonly Card[];
    /**
     * The detailed classification of these 5 cards.
     */
    readonly classification: Classification;
    /**
     * The pre-computed score array for fast lexicographical comparison.
     */
    readonly score: readonly number[];
}
