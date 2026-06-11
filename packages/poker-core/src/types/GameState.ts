import { Card } from "./Card.js";

export type Round = "PreFlop" | "Flop" | "Turn" | "River" | "Showdown" | "Ended";

export type PlayerStatus = "active" | "folded" | "all-in";

export interface PlayerState {
  readonly id: string;
  readonly name: string;
  readonly stack: number;
  readonly cards: readonly [Card, Card];
  readonly currentRoundBet: number;
  readonly totalHandBet: number;
  readonly status: PlayerStatus;
  readonly hasActed: boolean;
}

export interface Pot {
  readonly amount: number;
  readonly eligiblePlayerIds: readonly string[];
}

export interface HandConfig {
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly dealerIndex: number;
}

export interface SeatConfig {
  readonly id: string;
  readonly name: string;
  readonly stack: number;
}

export interface HandState {
  readonly config: HandConfig;
  readonly deck: readonly Card[];
  readonly communityCards: readonly Card[];
  readonly players: readonly PlayerState[];
  readonly currentRound: Round;
  readonly pots: readonly Pot[];
  readonly currentBet: number;
  readonly lastRaiseSize: number;
  readonly actorIndex: number;
}

export type GameAction =
  | { readonly type: "fold"; readonly playerId: string }
  | { readonly type: "check"; readonly playerId: string }
  | { readonly type: "call"; readonly playerId: string }
  | { readonly type: "raise"; readonly playerId: string; readonly totalBet: number };

export type SeatStatus = "empty" | "occupied" | "sitting-out";

export interface Seat {
  readonly index: number;
  readonly playerId: string | null;
  readonly name: string | null;
  readonly stack: number;
  readonly status: SeatStatus;
  readonly mustWaitForBB: boolean;
}

export interface TableConfig {
  readonly maxSeats: 6 | 9;
  readonly minBuyIn: number;
  readonly maxBuyIn: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
}

export interface PendingJoin {
  readonly playerId: string;
  readonly name: string;
  readonly buyIn: number;
  readonly seatIndex: number;
}

export interface TableState {
  readonly config: TableConfig;
  readonly seats: readonly Seat[];
  readonly currentHandState: HandState | null;
  readonly dealerIndex: number;
  readonly handCount: number;
  readonly pendingJoins: readonly PendingJoin[];
  readonly pendingLeaves: readonly string[];
  readonly handActionSeq: number;
  readonly lastBBSeatIdx: number | null;
}

export type TableAction =
  | { readonly type: "joinTable"; readonly playerId: string; readonly name: string; readonly buyIn: number; readonly seatIndex: number }
  | { readonly type: "leaveTable"; readonly playerId: string }
  | { readonly type: "sitOut"; readonly playerId: string }
  | { readonly type: "sitIn"; readonly playerId: string }
  | { readonly type: "addChips"; readonly playerId: string; readonly amount: number }
  | { readonly type: "startNextHand"; readonly deck?: readonly Card[] }
  | { readonly type: "dispatchHandAction"; readonly action: GameAction };
