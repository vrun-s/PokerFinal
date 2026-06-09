import { Deck } from "../types/Deck.js";
/**
 * Creates a standard 52-card poker deck.
 * The deck is created with a deterministic ordering:
 * Suits: HEARTS, DIAMONDS, CLUBS, SPADES.
 * Ranks: 2 through A.
 *
 * @returns A readonly array representing the standard 52-card deck.
 */
export declare function createDeck(): Deck;
