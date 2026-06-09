import { HandState } from "../types/GameState.js";
/**
 * Determine who acts next, starting the search from the index immediately following the current actorIndex.
 * Skip folded or all-in players.
 * If no eligible player is found, returns the current actorIndex.
 */
export declare function nextActor(state: HandState): number;
/**
 * Determines if the current betting round is complete.
 * The round is complete if all active (non-folded, non-all-in) players have
 * acted (hasActed === true) and matched the current round bet.
 */
export declare function isBettingRoundComplete(state: HandState): boolean;
/**
 * Advances the hand to the next round, dealing appropriate community cards
 * and resetting the betting round state.
 * Handles the "skip to showdown" runout if there is <= 1 active player left.
 */
export declare function advanceRound(state: HandState): HandState;
