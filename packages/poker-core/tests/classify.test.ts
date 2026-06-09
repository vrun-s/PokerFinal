import { describe, it, expect } from "vitest";
import { parseCard } from "../src/utils/cardUtils.js";
import { classify } from "../src/evaluation/classify.js";
import { HandRank } from "../src/types/HandRank.js";
import { PokerError } from "../src/errors/PokerError.js";

// Helper to parse array of strings to cards
const parseHand = (strings: string[]) => strings.map(parseCard);

describe("classify", () => {
  it("should throw error if input hand does not contain exactly 5 cards", () => {
    expect(() => classify(parseHand(["As", "Kh", "Qd", "Jc"]))).toThrow(
      PokerError
    );
    expect(() => classify(parseHand(["As", "Kh", "Qd", "Jc"]))).toThrow(
      "classify must be called with exactly 5 cards"
    );
  });

  // Fixture tables for all 9 HandRanks
  it("should classify Straight Flush", () => {
    const hand = parseHand(["Ts", "9s", "8s", "7s", "6s"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.StraightFlush);
    expect(res.primaryCards.map((c) => c.rank)).toEqual([
      "T",
      "9",
      "8",
      "7",
      "6",
    ]);
    expect(res.kickers.length).toBe(0);
  });

  it("should classify Wheel Straight Flush (Ace low)", () => {
    const hand = parseHand(["5h", "4h", "3h", "2h", "Ah"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.StraightFlush);
    expect(res.primaryCards.map((c) => c.rank)).toEqual([
      "5",
      "4",
      "3",
      "2",
      "A",
    ]);
    expect(res.kickers.length).toBe(0);
  });

  it("should classify Four of a Kind", () => {
    const hand = parseHand(["As", "Ah", "Ac", "Ad", "Ks"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.FourOfAKind);
    expect(res.primaryCards.map((c) => c.rank)).toEqual(["A", "A", "A", "A"]);
    expect(res.kickers.map((c) => c.rank)).toEqual(["K"]);
  });

  it("should classify Full House", () => {
    const hand = parseHand(["As", "Ah", "Ac", "Ks", "Kh"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.FullHouse);
    expect(res.primaryCards.map((c) => c.rank)).toEqual([
      "A",
      "A",
      "A",
      "K",
      "K",
    ]);
    expect(res.kickers.length).toBe(0);
  });

  it("should classify Full House vs Two Pair fixture: Kh Kd Qh Qd Qs", () => {
    const hand = parseHand(["Kh", "Kd", "Qh", "Qd", "Qs"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.FullHouse); // Queens full of Kings
    expect(res.primaryCards.map((c) => c.rank)).toEqual([
      "Q",
      "Q",
      "Q",
      "K",
      "K",
    ]);
  });

  it("should classify Flush", () => {
    const hand = parseHand(["As", "Qs", "Ts", "5s", "2s"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.Flush);
    expect(res.primaryCards.map((c) => c.rank)).toEqual([
      "A",
      "Q",
      "T",
      "5",
      "2",
    ]);
    expect(res.kickers.length).toBe(0);
  });

  it("should classify Straight", () => {
    const hand = parseHand(["Ts", "9h", "8d", "7c", "6s"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.Straight);
    expect(res.primaryCards.map((c) => c.rank)).toEqual([
      "T",
      "9",
      "8",
      "7",
      "6",
    ]);
    expect(res.kickers.length).toBe(0);
  });

  it("should classify Wheel Straight (Ace low)", () => {
    const hand = parseHand(["5s", "4h", "3d", "2c", "As"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.Straight);
    expect(res.primaryCards.map((c) => c.rank)).toEqual([
      "5",
      "4",
      "3",
      "2",
      "A",
    ]);
    expect(res.kickers.length).toBe(0);
  });

  it("should classify Three of a Kind", () => {
    const hand = parseHand(["Ts", "Th", "Td", "As", "Ks"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.ThreeOfAKind);
    expect(res.primaryCards.map((c) => c.rank)).toEqual(["T", "T", "T"]);
    expect(res.kickers.map((c) => c.rank)).toEqual(["A", "K"]);
  });

  it("should classify Two Pair", () => {
    const hand = parseHand(["Ts", "Th", "9s", "9h", "As"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.TwoPair);
    expect(res.primaryCards.map((c) => c.rank)).toEqual([
      "T",
      "T",
      "9",
      "9",
    ]);
    expect(res.kickers.map((c) => c.rank)).toEqual(["A"]);
  });

  it("should classify One Pair", () => {
    const hand = parseHand(["Ts", "Th", "As", "Ks", "Qd"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.OnePair);
    expect(res.primaryCards.map((c) => c.rank)).toEqual(["T", "T"]);
    expect(res.kickers.map((c) => c.rank)).toEqual(["A", "K", "Q"]);
  });

  it("should classify High Card", () => {
    const hand = parseHand(["As", "Ks", "Qd", "Jh", "9s"]);
    const res = classify(hand);
    expect(res.rank).toBe(HandRank.HighCard);
    expect(res.primaryCards.length).toBe(0);
    expect(res.kickers.map((c) => c.rank)).toEqual(["A", "K", "Q", "J", "9"]);
  });
});
