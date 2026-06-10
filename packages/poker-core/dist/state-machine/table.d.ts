import type { TableState, TableConfig, TableAction } from "../types/GameState.js";
import type { Card } from "../types/Card.js";
/**
 * Initializes a new TableState with empty seats.
 */
export declare function createTable(config: TableConfig): TableState;
/**
 * Lifts payouts from the completed HandState and applies them to the corresponding seat stacks.
 * Guard Clause: If currentHandState is null, this is a no-op.
 */
export declare function applyHandPayouts(state: TableState): TableState;
/**
 * Evicts players with stack === 0 by transitioning their seat status to "empty".
 */
export declare function evictBustedPlayers(state: TableState): TableState;
/**
 * Processes pending leaves first, then pending joins.
 * Newly joined players are seated with mustWaitForBB = true.
 */
export declare function flushPendingActions(state: TableState): TableState;
/**
 * Advances the dealer button by exactly one seat index clockwise unconditionally (Dead Button rule).
 */
export declare function rotateDealerButton(state: TableState): TableState;
/**
 * Assigns blinds, clears mustWaitForBB for passed players, and starts a new HandState.
 */
export declare function assignBlindsAndStart(state: TableState, deck?: readonly Card[], overridePrevBBSeatIdx?: number): TableState;
/**
 * Pure state reducer for Table Orchestration.
 */
export declare function tableReducer(state: TableState, action: TableAction): TableState;
