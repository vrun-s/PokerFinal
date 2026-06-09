import { Card } from "../types/Card.js";
import { Deck } from "../types/Deck.js";
import { PokerError } from "../errors/PokerError.js";

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
export function dealCards(
  deck: Deck,
  count: number
): {
  dealt: Card[];
  remaining: Deck;
} {
  if (count < 0) {
    throw new PokerError(
      "INVALID_DEAL_COUNT",
      "Cannot deal a negative number of cards."
    );
  }
  if (deck.length === 0 && count > 0) {
    throw new PokerError(
      "EMPTY_DECK",
      "Cannot deal cards from an empty deck."
    );
  }
  if (count > deck.length) {
    throw new PokerError(
      "INSUFFICIENT_CARDS",
      `Cannot deal ${count} cards. Only ${deck.length} cards remaining in the deck.`
    );
  }

  const dealt = deck.slice(0, count);
  const remaining = deck.slice(count);

  return {
    dealt,
    remaining,
  };
}
