/**
 * Generates all combinations of size k from the input array.
 * This is a generic, pure, non-mutating function.
 *
 * @param arr The source array.
 * @param k The size of combinations to select.
 * @throws {PokerError} If parameters are invalid:
 *                       - k exceeds arr.length (INVALID_COMBINATION_PARAMS)
 *                       - k <= 0 (INVALID_COMBINATION_PARAMS)
 *                       - arr.length is 0 (INVALID_COMBINATION_PARAMS)
 * @returns A readonly array of combinations, where each combination is a readonly array.
 */
export declare function combinations<T>(arr: readonly T[], k: number): readonly (readonly T[])[];
