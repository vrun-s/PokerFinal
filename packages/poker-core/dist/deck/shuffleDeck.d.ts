import { Deck } from "../types/Deck.js";
import { PRNG } from "../types/PRNG.js";
/**
 * Shuffles a poker deck using the Fisher-Yates algorithm.
 * This is a pure function that does not mutate the input deck.
 *
 * To support deterministic replay systems and unit testing,
 * an optional PRNG function can be provided.
 *
 * @param deck The deck to shuffle.
 * @param randomFn An optional custom PRNG function. Expected to return values in [0, 1)
 *                 with a uniform distribution. Defaults to Math.random.
 * @returns A new readonly deck containing the shuffled cards.
 */
export declare function shuffleDeck(deck: Deck, randomFn?: PRNG): Deck;
