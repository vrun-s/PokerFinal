import React, { useState, useEffect } from "react";
import { useSessionStore } from "../store/useSessionStore.ts";
import { useTableStore } from "../store/useTableStore.ts";
import { bestHand, compareMany, HandRank } from "@poker-platform/poker-core";

interface HandHistoryRow {
  hand_number: number;
  state_log: any;
  created_at: string;
}

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

function getCardSuitSymbol(suit: string): string {
  switch (suit) {
    case "hearts font-bold":
    case "hearts": return "♥";
    case "diamonds": return "♦";
    case "clubs": return "♣";
    case "spades": return "♠";
    default: return "";
  }
}

function getCardSuitColor(suit: string): string {
  return suit === "hearts" || suit === "diamonds" ? "text-red-500" : "text-gray-300";
}

export const HistoryPanel: React.FC = () => {
  const { tableId, token } = useSessionStore();
  const { tableState } = useTableStore();
  const [history, setHistory] = useState<HandHistoryRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const apiPrefix = import.meta.env.VITE_API_URL || "";
  const handCount = tableState?.handCount || 0;

  const fetchHistory = async () => {
    if (!tableId || !token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${apiPrefix}/api/tables/${tableId}/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch hand history", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, tableId, handCount]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 top-24 z-40 px-4 py-2.5 bg-slate-900/90 border border-slate-800 text-cyan-400 font-bold rounded-lg text-xs hover:bg-slate-850 active:scale-95 transition-all shadow-lg"
      >
        View Hand History
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 z-50 bg-slate-950/95 border-l border-slate-800 shadow-2xl flex flex-col">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/45">
        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
          Table Hand History
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:bg-slate-800 transition-all"
        >
          Close
        </button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {isLoading && history.length === 0 ? (
          <div className="text-center text-gray-500 text-xs py-8">
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div className="text-center text-gray-500 text-xs py-8">
            No completed hands logged yet
          </div>
        ) : (
          history.map((row) => {
            const state = row.state_log;
            const hand = state?.currentHandState;
            if (!hand) return null;

            const totalPot = hand.pots.reduce((s: number, p: any) => s + p.amount, 0);
            const eligible = hand.players.filter((p: any) => p.status !== "folded");

            let winnersSummary = "";
            let handRankLabel = "";

            if (eligible.length === 1) {
              winnersSummary = eligible[0].name;
              handRankLabel = "Winner by fold";
            } else if (eligible.length > 0) {
              try {
                // Compute winner client-side from logged cards & board
                const playerHands = eligible.map((p: any) => {
                  const computed = bestHand([...(p.cards as any), ...hand.communityCards] as any);
                  return { playerId: p.id, bestHand: computed };
                });

                const result = compareMany(playerHands);
                const winnerNames = result.winners.map(wId => {
                  const p = eligible.find((x: any) => x.id === wId);
                  return p ? p.name : wId;
                });

                winnersSummary = winnerNames.join(", ");
                const firstWinnerHand = playerHands.find((ph: any) => ph.playerId === result.winners[0]);
                if (firstWinnerHand) {
                  handRankLabel = handRankToLabel(firstWinnerHand.bestHand.classification.rank);
                }
              } catch (e) {
                console.error("Error evaluating logged hand winners", e);
                winnersSummary = "Showdown Evaluation Error";
              }
            }

            return (
              <div
                key={row.hand_number}
                className="glass-panel p-3.5 border-slate-800/80 bg-slate-900/20 hover:bg-slate-900/30 rounded-lg flex flex-col gap-2.5 transition-all text-xs"
              >
                <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  <span>Hand #{row.hand_number}</span>
                  <span className="text-emerald-400 font-extrabold text-xs">Pot: ${totalPot}</span>
                </div>

                {/* Board Cards */}
                {hand.communityCards && hand.communityCards.length > 0 && (
                  <div className="flex gap-1.5 items-center">
                    <span className="text-gray-500 font-semibold text-[10px] uppercase mr-1">Board:</span>
                    <div className="flex gap-1">
                      {hand.communityCards.map((card: any, i: number) => (
                        <span
                          key={i}
                          className={`w-6 h-8 bg-slate-900 border border-slate-800 rounded flex flex-col items-center justify-center font-bold text-xs select-none shadow-sm ${getCardSuitColor(
                            card.suit
                          )}`}
                        >
                          <span>{card.rank}</span>
                          <span className="text-[10px]">{getCardSuitSymbol(card.suit)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Winner Description */}
                <div className="border-t border-slate-800/60 pt-2 flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1 text-[11px]">
                    <span className="text-gray-400">Winner:</span>
                    <span className="font-bold text-gray-200">{winnersSummary}</span>
                  </div>
                  {handRankLabel && (
                    <div className="text-[10px] text-cyan-400 font-semibold">
                      {handRankLabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
