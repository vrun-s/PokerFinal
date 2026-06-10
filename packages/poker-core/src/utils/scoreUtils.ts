/**
 * Compares two score arrays lexicographically.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareScores(
    a: readonly number[],
    b: readonly number[]
): number {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        if (a[i]! > b[i]!) return 1;
        if (a[i]! < b[i]!) return -1;
    }
    return a.length - b.length;
}