import { socket } from "./socket.ts";
import { useTableStore } from "../store/useTableStore.ts";
import { useTimerStore } from "../store/useTimerStore.ts";
import { useSessionStore } from "../store/useSessionStore.ts";
import { SanitizedTableState } from "../types/poker.ts";
import { bestHand, compareMany, HandRank } from "@poker-platform/poker-core";
import type { Card } from "@poker-platform/poker-core";

function handRankToLabel(rank: HandRank): string {
  switch (rank) {
    case HandRank.HighCard:      return "High Card";
    case HandRank.OnePair:       return "One Pair";
    case HandRank.TwoPair:       return "Two Pair";
    case HandRank.ThreeOfAKind:  return "Three of a Kind";
    case HandRank.Straight:      return "Straight";
    case HandRank.Flush:         return "Flush";
    case HandRank.FullHouse:     return "Full House";
    case HandRank.FourOfAKind:   return "Four of a Kind";
    case HandRank.StraightFlush: return "Straight Flush";
    default:                     return "Unknown Hand";
  }
}

export function initializeSocketEvents() {
  socket.on("connect", () => {
    useTableStore.getState().setConnectionStatus("connected");
    
    // Auto-resubscribe if we had a tableId and token (reconnection flow)
    const { tableId, token } = useSessionStore.getState();
    if (tableId && token) {
      socket.emit("subscribe_table", { tableId, token });
    }
  });

  socket.on("disconnect", () => {
    useTableStore.getState().setConnectionStatus("disconnected");
    useTimerStore.getState().clearTimer();
  });

  socket.on("table_state", (state: SanitizedTableState) => {
    useTableStore.getState().setTableState(state);
    
    // If the active actor changes or the hand ends, clear timer just in case it doesn't tick
    if (!state.currentHandState) {
      useTimerStore.getState().clearTimer();
    } else {
      const hand = state.currentHandState;
      const round = hand.currentRound;
      if (round === "Showdown" || round === "Ended") {
        const totalPot = hand.pots.reduce((s, p) => s + p.amount, 0);

        // Players who are still in the hand with revealed cards
        const eligible = hand.players.filter(
          p => p.status !== "folded" && p.cards.every(c => c !== null)
        );

        // Fold-out path: only one survivor, community cards may be < 3
        const totalCards = eligible.length > 0
          ? eligible[0]!.cards.length + hand.communityCards.length
          : 0;

        if (eligible.length === 1 && totalCards < 5) {
          const winner = eligible[0]!;
          useTableStore.getState().setHandResult({
            resultKey: winner.id + "-" + state.handCount,
            winners: [{
              playerId: winner.id,
              playerName: winner.name,
              handRankLabel: "Winner by fold",
              isFoldWin: true,
              isSplit: false,
              totalPot,
            }],
          });
        } else if (eligible.length > 0) {
          // Showdown / evaluated path
          try {
            const playerHands = eligible.map(p => {
              const computed = bestHand([...(p.cards as any), ...hand.communityCards] as any);
              return { playerId: p.id, bestHand: computed };
            });

            const result = compareMany(playerHands);
            const isSplit = result.winners.length > 1;

            const winnerInfos = result.winners.map(wId => {
              const player = eligible.find(p => p.id === wId)!;
              const ph = playerHands.find(ph => ph.playerId === wId)!;
              return {
                playerId: wId,
                playerName: player.name,
                handRankLabel: handRankToLabel(ph.bestHand.classification.rank),
                isFoldWin: false,
                isSplit,
                totalPot,
              };
            });

            useTableStore.getState().setHandResult({
              resultKey: result.winners.join("-") + "-" + state.handCount,
              winners: winnerInfos,
            });
          } catch (err) {
            console.error("Failed to compute hand results client-side:", err);
          }
        }
      }
    }
    
    // Determine client's seatIndex dynamically from seats matching playerId
    const { playerId } = useSessionStore.getState();
    if (playerId) {
      const mySeat = state.seats.find((s) => s.playerId === playerId);
      if (mySeat) {
        useSessionStore.getState().setSeatIndex(mySeat.index);
      } else {
        useSessionStore.getState().setSeatIndex(null);
      }
    }
  });

  socket.on("timer_tick", (timer) => {
    useTimerStore.getState().setActiveTimer(timer);
  });

  socket.on("error", (err: any) => {
    console.error("Socket error received from server:", err);
    const message = typeof err === "string" ? err : err.message || "An unknown error occurred";
    useTableStore.getState().setErrorMessage(message);
    setTimeout(() => {
      if (useTableStore.getState().errorMessage === message) {
        useTableStore.getState().setErrorMessage(null);
      }
    }, 5000);
  });
}

// Infrastructure helper to send actions securely with stateVersion (sequence check)
export function sendGameAction(actionPayload: any) {
  const { tableId, playerId } = useSessionStore.getState();
  const { tableState } = useTableStore.getState();
  
  if (!tableId || !playerId) {
    console.error("Cannot send game action: missing tableId or playerId");
    return;
  }

  const payload = {
    tableId,
    playerId,
    handActionSeq: tableState ? tableState.stateVersion : 0,
    action: actionPayload,
  };

  socket.emit("game_action", payload);
}

export function subscribeToTable(tableId: string, token: string) {
  useSessionStore.getState().setTableId(tableId);
  useTableStore.getState().setConnectionStatus("connecting");
  
  if (!socket.connected) {
    socket.connect();
  } else {
    socket.emit("subscribe_table", { tableId, token });
  }
}
