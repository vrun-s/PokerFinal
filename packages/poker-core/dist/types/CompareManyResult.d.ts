/**
 * Represents the results of comparing multiple player hands.
 */
export interface CompareManyResult {
    /**
     * The IDs of the players who won the comparison (multiple in case of split).
     */
    readonly winners: readonly string[];
    /**
     * The IDs of all compared players sorted from best to worst hand.
     */
    readonly rankings: readonly string[];
}
