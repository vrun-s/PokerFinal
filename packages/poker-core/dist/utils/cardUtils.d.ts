import { Card } from "../types/Card.js";
import { Rank } from "../types/Rank.js";
/**
 * Returns the numeric rank value of a Rank.
 * 2 -> 2, ..., T -> 10, J -> 11, Q -> 12, K -> 13, A -> 14.
 *
 * @param rank The Rank to get the value of.
 * @returns The numeric rank value.
 */
export declare function rankValue(rank: Rank): number;
/**
 * Serializes a Card object into a canonical 2-character string representation.
 * Example: { rank: 'T', suit: 'hearts' } -> 'Th'
 *
 * @param card The Card to serialize.
 * @returns The 2-character string representation.
 */
export declare function serializeCard(card: Card): string;
/**
 * Parses a canonical 2-character string representation back into a Card object.
 * Example: 'Th' -> { rank: 'T', suit: 'hearts' }
 *
 * @param str The 2-character string representation.
 * @throws {PokerError} If the string representation is invalid.
 * @returns The parsed Card object.
 */
export declare function parseCard(str: string): Card;
/**
 * Compares two cards by their rank value.
 *
 * @param a The first card.
 * @param b The second card.
 * @returns A positive number if a > b, negative if a < b, 0 if equal.
 */
export declare function compareCards(a: Card, b: Card): number;
