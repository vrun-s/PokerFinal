import { describe, it, expect } from "vitest";
import { createDeck } from "../src/deck/createDeck.js";
import { shuffleDeck } from "../src/deck/shuffleDeck.js";

describe("shuffleDeck", () => {
  it("should preserve the card count of 52", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled.length).toBe(52);
  });

  it("should contain exactly the same 52 cards as the original deck (no cards lost or mutated)", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);

    // Assert that every card from the original deck exists in the shuffled deck
    for (const originalCard of deck) {
      const found = shuffled.some(
        (c) => c.suit === originalCard.suit && c.rank === originalCard.rank
      );
      expect(found).toBe(true);
    }
  });

  it("should preserve card uniqueness", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const uniqueCards = new Set(
      shuffled.map((card) => `${card.suit}-${card.rank}`)
    );
    expect(uniqueCards.size).toBe(52);
  });

  it("should not mutate the original deck", () => {
    const deck = createDeck();
    const originalCopy = [...deck];
    shuffleDeck(deck);
    expect(deck).toEqual(originalCopy);
  });

  it("should return a different order compared to the original deck", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).not.toEqual(deck);
  });

  it("should support deterministic seeded shuffles for testing/replay systems", () => {
    const seedGenerator = (seed: number) => {
      let state = seed;
      return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
      };
    };

    const deck = createDeck();
    const random1 = seedGenerator(12345);
    const random2 = seedGenerator(12345);
    const random3 = seedGenerator(99999);

    const shuffled1 = shuffleDeck(deck, random1);
    const shuffled2 = shuffleDeck(deck, random2);
    const shuffled3 = shuffleDeck(deck, random3);

    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).not.toEqual(shuffled3);
  });
});
