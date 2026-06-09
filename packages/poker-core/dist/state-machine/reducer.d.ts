import { HandState, GameAction, HandConfig, SeatConfig } from "../types/GameState.js";
import { Result } from "../types/Result.js";
import { ActionError } from "../types/ActionError.js";
import { Card } from "../types/Card.js";
/**
 * Initializes a new HandState by shuffling a deck, dealing hole cards,
 * posting blinds, and setting the first actor.
 */
export declare function startHand(config: HandConfig, seats: readonly SeatConfig[], deck?: readonly Card[]): HandState;
/**
 * Pure state transition reducer.
 * Validates the player action and returns the next HandState or an ActionError.
 */
export declare function transition(state: HandState, action: GameAction): Result<HandState, ActionError>;
