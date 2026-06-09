import { Card } from "../types/Card.js";
import { Deck } from "../types/Deck.js";
/**
 * Deals a specified number of cards from the top of the deck.
 * This is a pure function and does not mutate the input deck.
 *
 * @param deck The current deck.
 * @param count The number of cards to deal.
 * @throws {PokerError} If the requested count is negative (INVALID_DEAL_COUNT),
 *                       or if the deck is empty (EMPTY_DECK),
 *                       or if count exceeds the remaining deck size (INSUFFICIENT_CARDS).
 * @returns An object containing the dealt cards and the remaining deck.
 */
export declare function dealCards(deck: Deck, count: number): {
    dealt: Card[];
    remaining: Deck;
};
