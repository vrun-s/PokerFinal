import { PokerError } from "../errors/PokerError.js";

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
export function combinations<T>(
  arr: readonly T[],
  k: number
): readonly (readonly T[])[] {
  if (arr.length === 0) {
    throw new PokerError(
      "INVALID_COMBINATION_PARAMS",
      "Cannot generate combinations from an empty array."
    );
  }
  if (k <= 0) {
    throw new PokerError(
      "INVALID_COMBINATION_PARAMS",
      `Combination size k must be positive. Received k = ${k}.`
    );
  }
  if (k > arr.length) {
    throw new PokerError(
      "INVALID_COMBINATION_PARAMS",
      `Combination size k (${k}) cannot exceed array length (${arr.length}).`
    );
  }

  const results: (readonly T[])[] = [];

  function helper(start: number, path: readonly T[]) {
    if (path.length === k) {
      results.push(path);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      const element = arr[i];
      if (element !== undefined) {
        helper(i + 1, [...path, element]);
      }
    }
  }

  helper(0, []);
  return results;
}
