import { describe, it, expect } from "vitest";
import {
  serializeCard,
  parseCard,
  compareCards,
} from "../src/utils/cardUtils.js";
import { Card } from "../src/types/Card.js";
import { PokerError } from "../src/errors/PokerError.js";

describe("cardUtils", () => {
  describe("serializeCard", () => {
    it("should serialize cards with lowercase suit characters", () => {
      expect(serializeCard({ rank: "A", suit: "spades" })).toBe("As");
      expect(serializeCard({ rank: "T", suit: "hearts" })).toBe("Th");
      expect(serializeCard({ rank: "2", suit: "clubs" })).toBe("2c");
      expect(serializeCard({ rank: "9", suit: "diamonds" })).toBe("9d");
    });
  });

  describe("parseCard", () => {
    it("should parse canonical 2-character strings into Card objects", () => {
      expect(parseCard("As")).toEqual({ rank: "A", suit: "spades" });
      expect(parseCard("Th")).toEqual({ rank: "T", suit: "hearts" });
      expect(parseCard("2c")).toEqual({ rank: "2", suit: "clubs" });
      expect(parseCard("9d")).toEqual({ rank: "9", suit: "diamonds" });
    });

    it("should throw PokerError with INVALID_CARD_SERIALIZATION when string length is not 2", () => {
      expect(() => parseCard("")).toThrow(PokerError);
      expect(() => parseCard("A")).toThrow(PokerError);
      expect(() => parseCard("Ahs")).toThrow(PokerError);
    });

    it("should throw PokerError with INVALID_CARD_SERIALIZATION when rank is invalid", () => {
      try {
        parseCard("1s");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(PokerError);
        expect((err as PokerError).code).toBe("INVALID_CARD_SERIALIZATION");
      }
    });

    it("should throw PokerError with INVALID_CARD_SERIALIZATION when suit is invalid", () => {
      try {
        parseCard("Ax");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(PokerError);
        expect((err as PokerError).code).toBe("INVALID_CARD_SERIALIZATION");
      }
    });
  });

  describe("compareCards", () => {
    it("should compare card ranks correctly", () => {
      const card2c: Card = { rank: "2", suit: "clubs" };
      const card3h: Card = { rank: "3", suit: "hearts" };
      const cardTh: Card = { rank: "T", suit: "hearts" };
      const cardTs: Card = { rank: "T", suit: "spades" };
      const cardAd: Card = { rank: "A", suit: "diamonds" };

      expect(compareCards(card3h, card2c)).toBeGreaterThan(0);
      expect(compareCards(card2c, card3h)).toBeLessThan(0);
      expect(compareCards(cardTh, cardTs)).toBe(0); // Equal rank, ignoring suit
      expect(compareCards(cardAd, cardTh)).toBeGreaterThan(0);
    });
  });
});
