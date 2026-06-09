import { BestHand } from "./BestHand.js";
/**
 * Represents the outcome of comparing two hands.
 */
export type CompareResult = {
    readonly result: "win";
    readonly winner: BestHand;
} | {
    readonly result: "loss";
    readonly winner: BestHand;
} | {
    readonly result: "tie";
    readonly winners: readonly [BestHand, BestHand];
};
