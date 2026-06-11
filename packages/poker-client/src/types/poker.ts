export interface Card {
  readonly suit: "hearts" | "diamonds" | "clubs" | "spades";
  readonly rank: string;
}

export interface LegalAction {
  readonly type: "fold" | "check" | "call" | "raise";
  readonly minRaise?: number;
  readonly callAmount?: number;
}

export interface SanitizedPlayerState {
  readonly id: string;
  readonly name: string;
  readonly stack: number;
  readonly cards: readonly (Card | null)[];
  readonly currentRoundBet: number;
  readonly totalHandBet: number;
  readonly status: "active" | "folded" | "all-in";
  readonly hasActed: boolean;
}

export interface SanitizedHandState {
  readonly config: {
    readonly smallBlind: number;
    readonly bigBlind: number;
    readonly dealerIndex: number;
  };
  readonly communityCards: readonly Card[];
  readonly players: readonly SanitizedPlayerState[];
  readonly currentRound: "PreFlop" | "Flop" | "Turn" | "River" | "Showdown" | "Ended";
  readonly pots: readonly {
    readonly amount: number;
    readonly eligiblePlayerIds: readonly string[];
  }[];
  readonly currentBet: number;
  readonly lastRaiseSize: number;
  readonly actorIndex: number;
  readonly legalActions: readonly LegalAction[];
}

export interface SanitizedTableState {
  readonly config: {
    readonly maxSeats: 6 | 9;
    readonly minBuyIn: number;
    readonly maxBuyIn: number;
    readonly smallBlind: number;
    readonly bigBlind: number;
  };
  readonly seats: readonly {
    readonly index: number;
    readonly playerId: string | null;
    readonly name: string | null;
    readonly stack: number;
    readonly status: "empty" | "occupied" | "sitting-out";
    readonly mustWaitForBB: boolean;
  }[];
  readonly currentHandState: SanitizedHandState | null;
  readonly dealerIndex: number;
  readonly handCount: number;
  readonly handActionSeq: number;
  readonly stateVersion: number;
}
