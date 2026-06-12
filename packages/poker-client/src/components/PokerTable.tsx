import React from "react";
import { useTableStore } from "../store/useTableStore.ts";
import { useSessionStore } from "../store/useSessionStore.ts";
import { useTimerStore } from "../store/useTimerStore.ts";
import { socket } from "../services/socket.ts";
import { subscribeToTable } from "../services/socketEvents.ts";

interface PokerTableProps {
  onSit: (seatIndex: number) => void;
}

export const PokerTable: React.FC<PokerTableProps> = ({ onSit }) => {
  const { tableState, connectionStatus, errorMessage } = useTableStore();
  const { playerId, seatIndex } = useSessionStore();
  const { activeTimer } = useTimerStore();

  if (!tableState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
        <p className="text-gray-400">Loading table state...</p>
      </div>
    );
  }

  const maxSeats = tableState.config.maxSeats;
  const hand = tableState.currentHandState;

  // Calculate layout index so seated hero is always at layout position 0 (bottom)
  const getLayoutIdx = (seatIdx: number) => {
    if (seatIndex === null) return seatIdx; // Spectator view
    return (seatIdx - seatIndex + maxSeats) % maxSeats;
  };

  // Find total pot size
  const totalPot = hand ? hand.pots.reduce((sum, p) => sum + p.amount, 0) : 0;

  const renderSuitSymbol = (suit: string) => {
    switch (suit) {
      case "hearts": return "♥";
      case "diamonds": return "♦";
      case "clubs": return "♣";
      case "spades": return "♠";
      default: return "";
    }
  };

  return (
    <div className="relative w-full max-w-5xl px-4 py-8 mx-auto">
      {errorMessage && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-950/90 border border-red-500/40 text-red-200 px-6 py-2.5 rounded-xl text-sm font-semibold shadow-2xl backdrop-blur-md z-50 flex items-center gap-2 animate-pulse">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}
      {/* Oval felt board layout */}
      <div className="table-outer">
        <div className="table-felt"></div>

        {/* Reconnection Overlay */}
        {connectionStatus !== "connected" && (
          <div className="reconnect-overlay flex flex-col items-center justify-center p-6 text-center">
            {connectionStatus === "connecting" ? (
              <>
                <div className="spinner"></div>
                <h3 className="text-xl font-bold mb-1 text-white">Connecting...</h3>
                <p className="text-gray-400 text-sm">Attempting to establish server link</p>
              </>
            ) : (
              <>
                <div className="text-amber-500 text-3xl mb-3">⚠️</div>
                <h3 className="text-xl font-bold mb-1 text-white">Connection Lost</h3>
                <p className="text-gray-400 text-sm mb-4">You are disconnected from the server.</p>
                <button
                  onClick={() => {
                    const token = useSessionStore.getState().token;
                    const tableId = useSessionStore.getState().tableId;
                    if (token) {
                      subscribeToTable(tableId || "1", token);
                    }
                  }}
                  className="btn-poker primary px-6 py-2 rounded-lg text-sm bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                >
                  Manual Reconnect
                </button>
              </>
            )}
          </div>
        )}

        {/* Center Felt - Pots & Board Cards */}
        <div className="table-center-felt">
          {/* Main Pot */}
          {totalPot > 0 && (
            <div className="glass-panel px-4 py-1.5 rounded-full flex items-center gap-2 text-sm font-semibold border-amber-500/20">
              <span className="text-amber-400 text-xs">POT</span>
              <span className="text-white text-lg font-bold">${totalPot}</span>
              {hand && hand.pots.length > 1 && (
                <span className="text-xs text-gray-400">({hand.pots.length} pots)</span>
              )}
            </div>
          )}

          {/* Community Board */}
          {hand && hand.communityCards.length > 0 ? (
            <div className="flex gap-2 p-3 bg-black/30 rounded-xl backdrop-blur-md border border-white/5">
              {hand.communityCards.map((card, idx) => (
                <div
                  key={`${card.rank}-${card.suit}-${idx}`}
                  className={`card suit-${card.suit} flex-shrink-0`}
                >
                  <div className="text-left leading-none">{card.rank}</div>
                  <div className="text-center text-xl leading-none">
                    {renderSuitSymbol(card.suit)}
                  </div>
                  <div className="text-right leading-none rotate-180">{card.rank}</div>
                </div>
              ))}
            </div>
          ) : (
            hand && (
              <div className="text-xs tracking-wider text-gray-500 font-semibold uppercase">
                Dealing Hand Count: {tableState.handCount}
              </div>
            )
          )}
        </div>

        {/* Seating Layout around table */}
        {tableState.seats.map((seat) => {
          const layoutIdx = getLayoutIdx(seat.index);
          const isOccupied = seat.status === "occupied" || seat.status === "sitting-out";
          const handPlayer = isOccupied ? hand?.players.find((p) => p.id === seat.playerId) : null;
          const isActor = handPlayer && hand?.actorIndex !== -1 && hand?.players[hand.actorIndex]?.id === seat.playerId;

          // Get timer details for this seat if they are acting
          const seatTimer = isActor && activeTimer?.playerId === seat.playerId ? activeTimer : null;
          let timerPercentage = 0;
          if (seatTimer) {
            const maxTime = seatTimer.maxTimeLeft || (seatTimer.isTimeBank ? 30 : 15);
            const currentValue = seatTimer.isTimeBank ? seatTimer.timeBankLeft : seatTimer.timeLeft;
            timerPercentage = (currentValue / maxTime) * 100;
          }

          // Is dealer button at this seat?
          const isDealer = hand ? hand.config.dealerIndex === hand.players.findIndex(p => p.id === seat.playerId) : tableState.dealerIndex === seat.index;

          return (
            <div
              key={seat.index}
              className={`seat seat-${layoutIdx}`}
            >
              {isOccupied ? (
                <div
                  className={`relative flex flex-col items-center justify-between w-full h-full p-2 rounded-2xl border text-center transition-all ${seatTimer
                      ? "timer-active-border"
                      : isActor
                        ? "active-glow border-cyan-400 bg-slate-900/90"
                        : "border-slate-800 bg-slate-900/90"
                    } ${handPlayer?.status === "folded" ? "opacity-45" : ""}`}
                  style={seatTimer ? { "--timer-pct": `${timerPercentage}%` } as React.CSSProperties : undefined}
                >

                  {/* Player Name */}
                  <div className="text-sm font-semibold truncate max-w-[110px] text-white">
                    {seat.name}
                  </div>

                  {/* Hole Cards */}
                  {handPlayer && handPlayer.status !== "folded" && (
                    <div className="absolute -top-14 flex gap-1 z-20">
                      {handPlayer.cards.map((card, cardIdx) =>
                        card ? (
                          <div
                            key={cardIdx}
                            className={`card suit-${card.suit} !w-[36px] !h-[50px] !text-xs flex-shrink-0 flex flex-col justify-between p-1`}
                          >
                            <div className="text-left leading-none">{card.rank}</div>
                            <div className="text-center leading-none text-[10px]">
                              {renderSuitSymbol(card.suit)}
                            </div>
                            <div className="text-right leading-none rotate-180">{card.rank}</div>
                          </div>
                        ) : (
                          <div
                            key={cardIdx}
                            className="card card-back !w-[36px] !h-[50px] flex-shrink-0"
                          ></div>
                        )
                      )}
                    </div>
                  )}

                  {/* Stack / Status */}
                  <div className="text-xs font-bold text-emerald-400">
                    {seat.status === "sitting-out" ? (
                      <span className="text-red-400 uppercase tracking-widest text-[10px]">Sit Out</span>
                    ) : (
                      `$${seat.stack}`
                    )}
                  </div>

                  {/* Active Timer Indicator Overlay text */}
                  {seatTimer && (
                    <div className="text-[10px] text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/40">
                      {seatTimer.isTimeBank ? `BANK ${seatTimer.timeBankLeft}s` : `TIME ${seatTimer.timeLeft}s`}
                    </div>
                  )}

                  {/* Player Action Chips Bet display */}
                  {handPlayer && handPlayer.currentRoundBet > 0 && (
                    <div className="absolute -bottom-8 bg-black/60 px-3 py-1 rounded-full text-xs font-bold text-amber-300 border border-white/5 shadow-md flex items-center gap-1 z-30">
                      <span>Chips</span>
                      <span>${handPlayer.currentRoundBet}</span>
                    </div>
                  )}

                  {/* Dealer Button Badge */}
                  {isDealer && (
                    <div className="absolute -right-2 -bottom-2 bg-yellow-500 text-black text-[10px] font-black w-5 h-5 rounded-full border border-white flex items-center justify-center shadow-lg select-none">
                      D
                    </div>
                  )}
                </div>
              ) : (
                /* Empty Seat */
                <button
                  onClick={() => onSit(seat.index)}
                  disabled={seatIndex !== null}
                  className="btn-poker w-28 h-12 rounded-full text-xs border border-dashed border-white/10 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-gray-400 hover:text-emerald-400 shadow-inner flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg leading-none">+</span>
                  <span>Sit Here</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
