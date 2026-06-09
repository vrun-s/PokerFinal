import { HandState, PlayerState, Round } from "../types/GameState.js";
import { Card } from "../types/Card.js";
import { dealCards } from "../deck/dealCards.js";
import { calculatePots } from "./potCalculations.js";

/**
 * Determine who acts next, starting the search from the index immediately following the current actorIndex.
 * Skip folded or all-in players.
 * If no eligible player is found, returns the current actorIndex.
 */
export function nextActor(state: HandState): number {
  const N = state.players.length;
  const startIdx = state.actorIndex;
  
  for (let i = 1; i <= N; i++) {
    const idx = (startIdx + i) % N;
    const player = state.players[idx];
    if (player && player.status === "active") {
      return idx;
    }
  }
  return startIdx;
}

/**
 * Determines if the current betting round is complete.
 * The round is complete if all active (non-folded, non-all-in) players have
 * acted (hasActed === true) and matched the current round bet.
 */
export function isBettingRoundComplete(state: HandState): boolean {
  const activePlayers = state.players.filter(p => p.status === "active");
  if (activePlayers.length === 0) {
    return true;
  }
  return activePlayers.every(p => p.hasActed && p.currentRoundBet === state.currentBet);
}

/**
 * Advances the hand to the next round, dealing appropriate community cards
 * and resetting the betting round state.
 * Handles the "skip to showdown" runout if there is <= 1 active player left.
 */
export function advanceRound(state: HandState): HandState {
  // 1. Calculate pots at the end of the current round
  const updatedPots = calculatePots(state.players);

  // 2. Prepare players for the next round (reset currentRoundBet and hasActed)
  const resetPlayers = state.players.map(p => ({
    ...p,
    currentRoundBet: 0,
    hasActed: false,
  }));

  // Determine the next round
  let nextRound: Round = "PreFlop";
  if (state.currentRound === "PreFlop") nextRound = "Flop";
  else if (state.currentRound === "Flop") nextRound = "Turn";
  else if (state.currentRound === "Turn") nextRound = "River";
  else if (state.currentRound === "River") nextRound = "Showdown";
  else nextRound = "Ended";

  // Check how many non-folded players are left
  const nonFoldedPlayers = resetPlayers.filter(p => p.status !== "folded");
  
  // Check how many active (non-folded, non-all-in) players are left
  const activePlayers = resetPlayers.filter(p => p.status === "active");

  // Skip to Showdown condition:
  // If we have >= 2 non-folded players, but <= 1 active player (meaning others are all-in),
  // there can be no more betting. Run out all remaining board cards and go to Showdown.
  if (nonFoldedPlayers.length >= 2 && activePlayers.length <= 1 && nextRound !== "Showdown" && nextRound !== "Ended") {
    const cardsNeeded = 5 - state.communityCards.length;
    let newDeck = state.deck;
    let newCommunity = [...state.communityCards];

    if (cardsNeeded > 0) {
      const { dealt, remaining } = dealCards(newDeck, cardsNeeded);
      newCommunity = [...newCommunity, ...dealt];
      newDeck = remaining;
    }

    return {
      ...state,
      currentRound: "Showdown",
      deck: newDeck,
      communityCards: newCommunity,
      players: resetPlayers,
      pots: updatedPots,
      currentBet: 0,
      lastRaiseSize: state.config.bigBlind,
      actorIndex: -1,
    };
  }

  // Standard round transition
  let cardsToDeal = 0;
  if (nextRound === "Flop") cardsToDeal = 3;
  else if (nextRound === "Turn") cardsToDeal = 1;
  else if (nextRound === "River") cardsToDeal = 1;

  let newDeck = state.deck;
  let newCommunity = [...state.communityCards];

  if (cardsToDeal > 0) {
    const { dealt, remaining } = dealCards(newDeck, cardsToDeal);
    newCommunity = [...newCommunity, ...dealt];
    newDeck = remaining;
  }
  // Find the first active player left of the button to act next
  let nextActorIdx = -1;
  if (nextRound !== "Showdown" && nextRound !== "Ended") {
    nextActorIdx = state.config.dealerIndex;
    const N = resetPlayers.length;
    for (let i = 1; i <= N; i++) {
      const idx = (state.config.dealerIndex + i) % N;
      if (resetPlayers[idx]?.status === "active") {
        nextActorIdx = idx;
        break;
      }
    }
  }

  return {
    ...state,
    currentRound: nextRound,
    deck: newDeck,
    communityCards: newCommunity,
    players: resetPlayers,
    pots: updatedPots,
    currentBet: 0,
    lastRaiseSize: state.config.bigBlind,
    actorIndex: nextActorIdx,
  };
}
