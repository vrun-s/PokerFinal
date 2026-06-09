import { describe, it, expect } from "vitest";
import { createDeck } from "../src/deck/createDeck.js";
import { SUITS } from "../src/types/Suit.js";
import { RANKS } from "../src/types/Rank.js";

describe("createDeck", () => {
  it("should return a deck of exactly 52 cards", () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
  });

  it("should contain only unique cards with no duplicates", () => {
    const deck = createDeck();
    const uniqueCards = new Set(
      deck.map((card) => `${card.suit}-${card.rank}`)
    );
    expect(uniqueCards.size).toBe(52);
  });

  it("should contain exactly one of each card combination (robust uniqueness check)", () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const matchingCards = deck.filter(
          (c) => c.suit === suit && c.rank === rank
        );
        expect(matchingCards.length).toBe(1);
      }
    }
  });

  it("should return a deck with a deterministic ordering", () => {
    const deck1 = createDeck();
    const deck2 = createDeck();
    expect(deck1).toEqual(deck2);
  });
});
