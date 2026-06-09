import { Card } from "../types/Card.js";
import { Suit, SUITS } from "../types/Suit.js";
import { Rank, RANKS } from "../types/Rank.js";
import { PokerError } from "../errors/PokerError.js";

// Suit short character mappings
const SUIT_TO_CHAR: Record<Suit, string> = {
  hearts: "h",
  diamonds: "d",
  clubs: "c",
  spades: "s",
};

const CHAR_TO_SUIT: Record<string, Suit> = {
  h: "hearts",
  d: "diamonds",
  c: "clubs",
  s: "spades",
};

// Rank comparison value mapping
const RANK_VALUES: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/**
 * Returns the numeric rank value of a Rank.
 * 2 -> 2, ..., T -> 10, J -> 11, Q -> 12, K -> 13, A -> 14.
 *
 * @param rank The Rank to get the value of.
 * @returns The numeric rank value.
 */
export function rankValue(rank: Rank): number {
  const val = RANK_VALUES[rank];
  if (val === undefined) {
    throw new PokerError(
      "INVALID_ARGUMENT",
      `Invalid card rank: ${rank}`
    );
  }
  return val;
}

/**
 * Serializes a Card object into a canonical 2-character string representation.
 * Example: { rank: 'T', suit: 'hearts' } -> 'Th'
 *
 * @param card The Card to serialize.
 * @returns The 2-character string representation.
 */
export function serializeCard(card: Card): string {
  const suitChar = SUIT_TO_CHAR[card.suit];
  if (!suitChar) {
    throw new PokerError(
      "INVALID_ARGUMENT",
      `Invalid suit when serializing card: ${card.suit}`
    );
  }
  return `${card.rank}${suitChar}`;
}

/**
 * Parses a canonical 2-character string representation back into a Card object.
 * Example: 'Th' -> { rank: 'T', suit: 'hearts' }
 *
 * @param str The 2-character string representation.
 * @throws {PokerError} If the string representation is invalid.
 * @returns The parsed Card object.
 */
export function parseCard(str: string): Card {
  if (typeof str !== "string" || str.length !== 2) {
    throw new PokerError(
      "INVALID_CARD_SERIALIZATION",
      `Invalid card serialization string (must be 2 characters): "${str}"`
    );
  }

  const rankStr = str[0];
  const suitChar = str[1];

  if (!rankStr || !suitChar) {
    throw new PokerError(
      "INVALID_CARD_SERIALIZATION",
      `Failed to extract rank and suit from string: "${str}"`
    );
  }

  const rank = RANKS.find((r) => r === rankStr);
  const suit = CHAR_TO_SUIT[suitChar];

  if (!rank || !suit) {
    throw new PokerError(
      "INVALID_CARD_SERIALIZATION",
      `Invalid rank "${rankStr}" or suit "${suitChar}" in string: "${str}"`
    );
  }

  return { rank, suit };
}

/**
 * Compares two cards by their rank value.
 *
 * @param a The first card.
 * @param b The second card.
 * @returns A positive number if a > b, negative if a < b, 0 if equal.
 */
export function compareCards(a: Card, b: Card): number {
  return rankValue(a.rank) - rankValue(b.rank);
}
