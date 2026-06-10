import { BestHand } from "../types/BestHand.js";
import { CompareManyResult } from "../types/CompareManyResult.js";
/**
 * Represents a player's hand for comparison purposes.
 */
export interface PlayerHand {
    readonly playerId: string;
    readonly bestHand: BestHand;
}
/**
 * Compares multiple player hands and ranks them from best to worst.
 * Returns the winners (could be multiple on split) and the ordered list of player IDs.
 */
export declare function compareMany(playerHands: readonly PlayerHand[]): CompareManyResult;
