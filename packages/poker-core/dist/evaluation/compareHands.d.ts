import { BestHand } from "../types/BestHand.js";
import { CompareResult } from "../types/CompareResult.js";
/**
 * Compares two evaluated hands.
 * Returns a result indicating if the first hand 'a' won, lost, or tied with 'b'.
 *
 * @param a The first evaluated hand.
 * @param b The second evaluated hand.
 * @returns The CompareResult details.
 */
export declare function compareHands(a: BestHand, b: BestHand): CompareResult;
