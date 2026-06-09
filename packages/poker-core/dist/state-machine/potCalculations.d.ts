import { PlayerState, Pot } from "../types/GameState.js";
import { Card } from "../types/Card.js";
import { PayoutResult } from "../types/PayoutResult.js";
/**
 * Dynamically calculates the main and side pots based on players' total commitments.
 * Folded players (including folded all-in players) are excluded from pot eligibility.
 */
export declare function calculatePots(players: readonly PlayerState[]): readonly Pot[];
/**
 * Evaluates hands at showdown and distributes all pots to the winners.
 * Handles split pots and odd-chip distribution (gives odd chips to winning players
 * closest to the left of the button dealerIndex).
 */
export declare function distributePayouts(pots: readonly Pot[], players: readonly PlayerState[], communityCards: readonly Card[], dealerIndex: number): PayoutResult;
