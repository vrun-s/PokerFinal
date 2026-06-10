import { compareScores } from "../utils/scoreUtils.js";
/**
 * Compares multiple player hands and ranks them from best to worst.
 * Returns the winners (could be multiple on split) and the ordered list of player IDs.
 */
export function compareMany(playerHands) {
    if (playerHands.length === 0) {
        return { winners: [], rankings: [] };
    }
    // Sort descending: best hand first (so we compare b to a)
    const sorted = [...playerHands].sort((a, b) => {
        return compareScores(b.bestHand.score, a.bestHand.score);
    });
    const rankings = sorted.map(ph => ph.playerId);
    const bestHandScore = sorted[0].bestHand.score;
    const winners = sorted
        .filter(ph => compareScores(ph.bestHand.score, bestHandScore) === 0)
        .map(ph => ph.playerId);
    return { winners, rankings };
}
