// Domain Types
export { SUITS } from "./types/Suit.js";
export type { Suit } from "./types/Suit.js";
export { RANKS } from "./types/Rank.js";
export type { Rank } from "./types/Rank.js";
export type { Card } from "./types/Card.js";
export type { Hand } from "./types/Hand.js";
export type { Deck } from "./types/Deck.js";
export type { PRNG } from "./types/PRNG.js";
export { HandRank } from "./types/HandRank.js";
export type { Classification } from "./types/Classification.js";
export type { PlayerHand } from "./evaluation/compareMany.js";
export type { BestHand } from "./types/BestHand.js";
export type { CompareResult } from "./types/CompareResult.js";

// State Machine & Error Types
export type { Result } from "./types/Result.js";
export type { ActionError, ActionErrorCode } from "./types/ActionError.js";
export type { CompareManyResult } from "./types/CompareManyResult.js";
export type { PayoutResult, Payout } from "./types/PayoutResult.js";
export type {
  Round,
  PlayerStatus,
  PlayerState,
  Pot,
  HandConfig,
  SeatConfig,
  HandState,
  GameAction,
  SeatStatus,
  Seat,
  TableConfig,
  PendingJoin,
  TableState,
  TableAction,
} from "./types/GameState.js";

// Custom Errors
export { PokerError } from "./errors/PokerError.js";
export type { PokerErrorCode } from "./errors/PokerError.js";

// Core Functions
export { createDeck } from "./deck/createDeck.js";
export { shuffleDeck } from "./deck/shuffleDeck.js";
export { dealCards } from "./deck/dealCards.js";

// Card Utilities
export {
  serializeCard,
  parseCard,
  compareCards,
  rankValue,
} from "./utils/cardUtils.js";


// Evaluation Functions
export { bestHand } from "./evaluation/bestHand.js";
export { compareHands } from "./evaluation/compareHands.js";
export { compareMany } from "./evaluation/compareMany.js";

// Game State Machine Functions
export { calculatePots, distributePayouts } from "./state-machine/potCalculations.js";
export { startHand, transition } from "./state-machine/reducer.js";
export {
  createTable,
  tableReducer
} from "./state-machine/table.js";

