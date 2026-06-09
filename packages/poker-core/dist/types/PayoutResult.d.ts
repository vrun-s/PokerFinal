export interface Payout {
    readonly playerId: string;
    readonly amount: number;
}
/**
 * Represents the final payouts for a hand.
 */
export interface PayoutResult {
    readonly payouts: readonly Payout[];
}
