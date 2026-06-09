/**
 * Compares two score arrays lexicographically.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
function compareScores(a, b) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const valA = a[i];
        const valB = b[i];
        if (valA !== undefined && valB !== undefined) {
            if (valA > valB)
                return 1;
            if (valA < valB)
                return -1;
        }
    }
    return a.length - b.length;
}
/**
 * Compares two evaluated hands.
 * Returns a result indicating if the first hand 'a' won, lost, or tied with 'b'.
 *
 * @param a The first evaluated hand.
 * @param b The second evaluated hand.
 * @returns The CompareResult details.
 */
export function compareHands(a, b) {
    const cmp = compareScores(a.score, b.score);
    if (cmp > 0) {
        return { result: "win", winner: a };
    }
    else if (cmp < 0) {
        return { result: "loss", winner: b };
    }
    else {
        return { result: "tie", winners: [a, b] };
    }
}
/*
 * Phase 3 Preview / Sketch for Multi-Player Hand Comparison:
 *
 * export function compareMany(hands: readonly BestHand[]): {
 *   readonly winners: readonly BestHand[]; // 1 winner, or 2+ on a split pot
 *   readonly ranking: readonly BestHand[]; // all hands sorted best to worst
 * } {
 *   // ...
 * }
 */
