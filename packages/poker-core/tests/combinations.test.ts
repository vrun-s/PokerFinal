import { describe, it, expect } from "vitest";
import { combinations } from "../src/utils/combinations.js";
import { PokerError } from "../src/errors/PokerError.js";

describe("combinations", () => {
  it("should generate all C(5, 3) = 10 combinations", () => {
    const arr = [1, 2, 3, 4, 5];
    const combos = combinations(arr, 3);
    expect(combos.length).toBe(10);
    expect(combos).toContainEqual([1, 2, 3]);
    expect(combos).toContainEqual([3, 4, 5]);
  });

  it("should throw PokerError on invalid parameters", () => {
    // k > length
    expect(() => combinations([1, 2], 3)).toThrow(PokerError);
    // k <= 0
    expect(() => combinations([1, 2], 0)).toThrow(PokerError);
    expect(() => combinations([1, 2], -1)).toThrow(PokerError);
    // empty array
    expect(() => combinations([], 1)).toThrow(PokerError);
  });
});
