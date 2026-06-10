import { compareScores } from "../utils/scoreUtils.js";
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
