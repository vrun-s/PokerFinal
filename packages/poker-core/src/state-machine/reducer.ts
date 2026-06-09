import { HandState, PlayerState, GameAction, HandConfig, SeatConfig, PlayerStatus } from "../types/GameState.js";
import { Result } from "../types/Result.js";
import { ActionError } from "../types/ActionError.js";
import { Card } from "../types/Card.js";
import { createDeck } from "../deck/createDeck.js";
import { shuffleDeck } from "../deck/shuffleDeck.js";
import { calculatePots } from "./potCalculations.js";
import { isBettingRoundComplete, advanceRound, nextActor } from "./bettingRound.js";

/**
 * Initializes a new HandState by shuffling a deck, dealing hole cards,
 * posting blinds, and setting the first actor.
 */
export function startHand(
  config: HandConfig,
  seats: readonly SeatConfig[],
  deck?: readonly Card[]
): HandState {
  const initialDeck = deck ? deck : shuffleDeck(createDeck());
  const N = seats.length;

  let currentDeck = initialDeck;

  // Deal exactly 2 cards to each player
  const players: PlayerState[] = seats.map((seat) => {
    const cards = [currentDeck[0]!, currentDeck[1]!] as const;
    currentDeck = currentDeck.slice(2);
    return {
      id: seat.id,
      name: seat.name,
      stack: seat.stack,
      cards,
      currentRoundBet: 0,
      totalHandBet: 0,
      status: "active",
      hasActed: false,
    };
  });
  // Determine Small Blind and Big Blind indices
  let sbIdx = 0;
  let bbIdx = 0;
  let actorIdx = 0;

  if (N === 2) {
    // Heads-up special rules:
    // dealerIndex posts Small Blind and acts first preflop.
    // The other player posts Big Blind and acts last preflop.
    sbIdx = config.dealerIndex;
    bbIdx = (config.dealerIndex + 1) % 2;
    actorIdx = sbIdx;
  } else {
    // Standard rules:
    // Small Blind is left of button
    // Big Blind is left of Small Blind
    // UTG is left of Big Blind
    sbIdx = (config.dealerIndex + 1) % N;
    bbIdx = (config.dealerIndex + 2) % N;
    actorIdx = (config.dealerIndex + 3) % N;
  }

  // Deduct small blind chips
  const sbPlayer = players[sbIdx]!;
  let sbBet = config.smallBlind;
  let sbStatus: PlayerStatus = sbPlayer.status;
  let sbStack = sbPlayer.stack - config.smallBlind;

  if (sbPlayer.stack <= config.smallBlind) {
    sbBet = sbPlayer.stack;
    sbStack = 0;
    sbStatus = "all-in";
  }

  players[sbIdx] = {
    ...sbPlayer,
    stack: sbStack,
    currentRoundBet: sbBet,
    totalHandBet: sbBet,
    status: sbStatus,
  };

  // Deduct big blind chips
  const bbPlayer = players[bbIdx]!;
  let bbBet = config.bigBlind;
  let bbStatus: PlayerStatus = bbPlayer.status;
  let bbStack = bbPlayer.stack - config.bigBlind;

  if (bbPlayer.stack <= config.bigBlind) {
    bbBet = bbPlayer.stack;
    bbStack = 0;
    bbStatus = "all-in";
  }

  players[bbIdx] = {
    ...bbPlayer,
    stack: bbStack,
    currentRoundBet: bbBet,
    totalHandBet: bbBet,
    status: bbStatus,
  };

  const currentBet = Math.max(sbBet, bbBet);
  const initialPots = calculatePots(players);

  return {
    config,
    deck: currentDeck,
    communityCards: [],
    players,
    currentRound: "PreFlop",
    pots: initialPots,
    currentBet,
    lastRaiseSize: config.bigBlind,
    actorIndex: actorIdx,
  };
}

/**
 * Pure state transition reducer.
 * Validates the player action and returns the next HandState or an ActionError.
 */
export function transition(
  state: HandState,
  action: GameAction
): Result<HandState, ActionError> {
  const { currentRound, actorIndex, players, currentBet, lastRaiseSize } = state;

  if (currentRound === "Showdown" || currentRound === "Ended") {
    return {
      ok: false,
      error: { code: "INVALID_ACTION", message: "Hand is already completed." },
    };
  }

  // Find the acting player
  const playerIdx = players.findIndex((p) => p.id === action.playerId);
  if (playerIdx === -1) {
    return {
      ok: false,
      error: { code: "PLAYER_NOT_ACTIVE", message: "Player not found." },
    };
  }

  if (playerIdx !== actorIndex) {
    return {
      ok: false,
      error: { code: "NOT_PLAYER_TURN", message: "It is not this player turn." },
    };
  }

  const player = players[playerIdx]!;
  if (player.status !== "active") {
    return {
      ok: false,
      error: { code: "PLAYER_NOT_ACTIVE", message: "Player is folded or all-in." },
    };
  }

  let updatedPlayers = [...players];

  switch (action.type) {
    case "fold": {
      // Update player to folded
      updatedPlayers[playerIdx] = {
        ...player,
        status: "folded",
        hasActed: true,
      };
      break;
    }

    case "check": {
      // Player can only check if they have matched the currentBet
      if (player.currentRoundBet !== currentBet) {
        return {
          ok: false,
          error: { code: "INVALID_CHECK", message: "Cannot check when there is an active bet." },
        };
      }
      updatedPlayers[playerIdx] = {
        ...player,
        hasActed: true,
      };
      break;
    }

    case "call": {
      const callAmount = currentBet - player.currentRoundBet;
      if (callAmount <= 0) {
        // Equivalent to check
        updatedPlayers[playerIdx] = {
          ...player,
          hasActed: true,
        };
      } else if (player.stack <= callAmount) {
        // All-in call
        updatedPlayers[playerIdx] = {
          ...player,
          stack: 0,
          currentRoundBet: player.currentRoundBet + player.stack,
          totalHandBet: player.totalHandBet + player.stack,
          status: "all-in",
          hasActed: true,
        };
      } else {
        // Standard call
        updatedPlayers[playerIdx] = {
          ...player,
          stack: player.stack - callAmount,
          currentRoundBet: currentBet,
          totalHandBet: player.totalHandBet + callAmount,
          hasActed: true,
        };
      }
      break;
    }

    case "raise": {
      const totalBet = action.totalBet;
      
      if (totalBet <= currentBet) {
        return {
          ok: false,
          error: { code: "INVALID_RAISE_AMOUNT", message: "Raise bet must exceed current bet." },
        };
      }

      const chipsToAdd = totalBet - player.currentRoundBet;
      if (player.stack < chipsToAdd) {
        return {
          ok: false,
          error: { code: "INVALID_RAISE_AMOUNT", message: "Insufficient stack to perform raise." },
        };
      }

      // Compute lastRaiseSize first before updating currentBet
      const newRaiseSize = totalBet - currentBet;
      const minRaise = currentBet + lastRaiseSize;
      const isAllIn = chipsToAdd === player.stack;

      if (totalBet < minRaise && !isAllIn) {
        return {
          ok: false,
          error: { code: "INVALID_RAISE_AMOUNT", message: "Raise is below the minimum raise size." },
        };
      }

      // Update player
      updatedPlayers[playerIdx] = {
        ...player,
        stack: player.stack - chipsToAdd,
        currentRoundBet: totalBet,
        totalHandBet: player.totalHandBet + chipsToAdd,
        status: isAllIn ? "all-in" : "active",
        hasActed: true,
      };

      // Update state parameters
      const isFullRaise = totalBet >= minRaise;
      let nextLastRaiseSize = lastRaiseSize;
      let nextCurrentBet = totalBet;

      if (isFullRaise) {
        nextLastRaiseSize = newRaiseSize;
        // Reset hasActed to false for all other active (non-all-in, non-folded) players
        updatedPlayers = updatedPlayers.map((p, idx) => {
          if (idx === playerIdx || p.status !== "active") {
            return p;
          }
          return {
            ...p,
            hasActed: false,
          };
        });
      } else {
        // Under-raise: does NOT reset hasActed for other active players.
        // It does not change lastRaiseSize.
      }

      // Return transition with updated bet state
      const intermediateState: HandState = {
        ...state,
        players: updatedPlayers,
        currentBet: nextCurrentBet,
        lastRaiseSize: nextLastRaiseSize,
      };

      // Run cleanup and check round completion
      return handlePostAction(intermediateState);
    }
  }

  const intermediateState: HandState = {
    ...state,
    players: updatedPlayers,
  };

  return handlePostAction(intermediateState);
}

/**
 * Handles round and game completion checks after an action is processed.
 */
function handlePostAction(state: HandState): Result<HandState, ActionError> {
  // Check if only 1 player remains in the hand (everyone else folded)
  const nonFolded = state.players.filter(p => p.status !== "folded");
  if (nonFolded.length === 1) {
    const finalPots = calculatePots(state.players);
    const finalPlayers = state.players.map(p => ({
      ...p,
      currentRoundBet: 0,
      hasActed: false,
    }));
    return {
      ok: true,
      value: {
        ...state,
        currentRound: "Ended",
        players: finalPlayers,
        pots: finalPots,
        actorIndex: -1,
      },
    };
  }

  // Check if the current betting round is complete
  if (isBettingRoundComplete(state)) {
    return {
      ok: true,
      value: advanceRound(state),
    };
  }

  // Move action to the next actor
  return {
    ok: true,
    value: {
      ...state,
      actorIndex: nextActor(state),
    },
  };
}
