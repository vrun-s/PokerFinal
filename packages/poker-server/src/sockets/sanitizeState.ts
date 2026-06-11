import { TableState, Card } from "@poker-platform/poker-core";

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

export function sanitizeStateForClient(state: TableState, playerId: string): SanitizedTableState {
  const sanitizedSeats = state.seats.map(s => ({
    index: s.index,
    playerId: s.playerId,
    name: s.name,
    stack: s.stack,
    status: s.status,
    mustWaitForBB: s.mustWaitForBB,
  }));

  let sanitizedHand: SanitizedHandState | null = null;

  if (state.currentHandState) {
    const hand = state.currentHandState;
    const isShowdown = hand.currentRound === "Showdown";

    const sanitizedPlayers = hand.players.map(p => {
      // Show cards if it's the target player
      // OR if it's showdown and the player hasn't folded (tabled cards)
      const shouldShowCards = p.id === playerId || (isShowdown && p.status !== "folded");

      return {
        id: p.id,
        name: p.name,
        stack: p.stack,
        cards: shouldShowCards ? p.cards : [null, null],
        currentRoundBet: p.currentRoundBet,
        totalHandBet: p.totalHandBet,
        status: p.status,
        hasActed: p.hasActed,
      };
    });

    const legalActions: LegalAction[] = [];
    if (hand.actorIndex !== -1) {
      const currentActor = hand.players[hand.actorIndex];
      if (currentActor && currentActor.id === playerId && currentActor.status === "active") {
        legalActions.push({ type: "fold" });

        if (currentActor.currentRoundBet === hand.currentBet) {
          legalActions.push({ type: "check" });
        }

        if (currentActor.currentRoundBet < hand.currentBet) {
          const callAmount = hand.currentBet - currentActor.currentRoundBet;
          legalActions.push({
            type: "call",
            callAmount: Math.min(callAmount, currentActor.stack),
          });
        }

        const callAmount = hand.currentBet - currentActor.currentRoundBet;
        const canRaise = !currentActor.hasActed && currentActor.stack > callAmount;
        if (canRaise) {
          const minRaise = hand.currentBet + hand.lastRaiseSize;
          legalActions.push({
            type: "raise",
            minRaise,
          });
        }
      }
    }

    sanitizedHand = {
      config: {
        smallBlind: hand.config.smallBlind,
        bigBlind: hand.config.bigBlind,
        dealerIndex: hand.config.dealerIndex,
      },
      communityCards: hand.communityCards,
      players: sanitizedPlayers,
      currentRound: hand.currentRound,
      pots: hand.pots.map(pot => ({
        amount: pot.amount,
        eligiblePlayerIds: pot.eligiblePlayerIds,
      })),
      currentBet: hand.currentBet,
      lastRaiseSize: hand.lastRaiseSize,
      actorIndex: hand.actorIndex,
      legalActions,
    };
  }

  return {
    config: {
      maxSeats: state.config.maxSeats,
      minBuyIn: state.config.minBuyIn,
      maxBuyIn: state.config.maxBuyIn,
      smallBlind: state.config.smallBlind,
      bigBlind: state.config.bigBlind,
    },
    seats: sanitizedSeats,
    currentHandState: sanitizedHand,
    dealerIndex: state.dealerIndex,
    handCount: state.handCount,
    handActionSeq: state.handActionSeq,
    stateVersion: state.handActionSeq,
  };
}
