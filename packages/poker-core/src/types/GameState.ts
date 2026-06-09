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
