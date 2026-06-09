import { describe, it, expect } from "vitest";
import { createDeck } from "../src/deck/createDeck.js";
import { dealCards } from "../src/deck/dealCards.js";
import { PokerError } from "../src/errors/PokerError.js";

describe("dealCards", () => {
  it("should deal the correct number of cards", () => {
    const deck = createDeck();
    const count = 5;
    const { dealt } = dealCards(deck, count);
    expect(dealt.length).toBe(count);
  });

  it("should return the correct remaining deck size", () => {
    const deck = createDeck();
    const count = 5;
    const { remaining } = dealCards(deck, count);
    expect(remaining.length).toBe(deck.length - count);
  });

  it("should ensure the remaining deck contains exactly the cards not in dealt (exact deal reconstruction)", () => {
    const deck = createDeck();
    const count = 7;
    const { dealt, remaining } = dealCards(deck, count);

    // Concatenating dealt and remaining should recreate the original deck exactly
    const reconstructedDeck = [...dealt, ...remaining];
    expect(reconstructedDeck).toEqual(deck);
  });

  it("should ensure dealt cards are completely removed from the remaining deck", () => {
    const deck = createDeck();
    const count = 5;
    const { dealt, remaining } = dealCards(deck, count);

    for (const card of dealt) {
      const isDealtCardInRemaining = remaining.some(
        (remCard) => remCard.suit === card.suit && remCard.rank === card.rank
      );
      expect(isDealtCardInRemaining).toBe(false);
    }
  });

  it("should not mutate the original deck", () => {
    const deck = createDeck();
    const originalLength = deck.length;
    const count = 5;

    dealCards(deck, count);

    expect(deck.length).toBe(originalLength);
  });

  it("should throw PokerError with INSUFFICIENT_CARDS when trying to deal more cards than remaining", () => {
    const deck = createDeck();
    const count = deck.length + 1;

    try {
      dealCards(deck, count);
      expect.fail("Should have thrown a PokerError");
    } catch (error) {
      expect(error).toBeInstanceOf(PokerError);
      const pokerErr = error as PokerError;
      expect(pokerErr.code).toBe("INSUFFICIENT_CARDS");
      expect(pokerErr.message).toContain(
        `Cannot deal ${count} cards. Only 52 cards remaining in the deck.`
      );
    }
  });

  it("should throw PokerError with INVALID_DEAL_COUNT when trying to deal a negative number of cards", () => {
    const deck = createDeck();
    try {
      dealCards(deck, -1);
      expect.fail("Should have thrown a PokerError");
    } catch (error) {
      expect(error).toBeInstanceOf(PokerError);
      const pokerErr = error as PokerError;
      expect(pokerErr.code).toBe("INVALID_DEAL_COUNT");
    }
  });

  it("should throw PokerError with EMPTY_DECK when trying to deal from an empty deck", () => {
    try {
      dealCards([], 1);
      expect.fail("Should have thrown a PokerError");
    } catch (error) {
      expect(error).toBeInstanceOf(PokerError);
      const pokerErr = error as PokerError;
      expect(pokerErr.code).toBe("EMPTY_DECK");
    }
  });
});
