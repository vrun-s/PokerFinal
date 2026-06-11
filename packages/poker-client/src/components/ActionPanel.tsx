import React, { useState, useEffect } from "react";
import { useTableStore } from "../store/useTableStore.ts";
import { useSessionStore } from "../store/useSessionStore.ts";
import { sendGameAction } from "../services/socketEvents.ts";

export const ActionPanel: React.FC = () => {
  const { tableState, connectionStatus } = useTableStore();
  const { playerId, seatIndex } = useSessionStore();
  
  const [raiseValue, setRaiseValue] = useState<number>(0);
  const [buyInAmount, setBuyInAmount] = useState<number>(200);

  const isConnected = connectionStatus === "connected";
  const hand = tableState?.currentHandState;
  const isMyTurn = hand && hand.actorIndex !== -1 && hand.players[hand.actorIndex]?.id === playerId;
  const activeActor = hand && hand.actorIndex !== -1 ? hand.players[hand.actorIndex] : null;
  const myPlayerState = hand && playerId ? hand.players.find((p) => p.id === playerId) : null;

  // Retrieve legalActions for current actor
  const legalActions = isMyTurn && hand ? hand.legalActions : [];

  const foldAction = legalActions.find((a) => a.type === "fold");
  const checkAction = legalActions.find((a) => a.type === "check");
  const callAction = legalActions.find((a) => a.type === "call");
  const raiseAction = legalActions.find((a) => a.type === "raise");

  // Determine raise limits
  const minRaise = raiseAction?.minRaise || 0;
  const maxRaise = myPlayerState ? myPlayerState.currentRoundBet + myPlayerState.stack : 0;

  // Reset raise slider when it becomes your turn
  useEffect(() => {
    if (isMyTurn && minRaise > 0) {
      setRaiseValue(minRaise);
    }
  }, [isMyTurn, minRaise]);

  if (!tableState) return null;

  const handleAction = (type: "fold" | "check" | "call" | "raise", extra?: any) => {
    if (!isConnected) return;
    if (type === "raise") {
      sendGameAction({
        type: "dispatchHandAction",
        action: {
          type: "raise",
          playerId,
          totalBet: raiseValue,
        },
      });
    } else {
      sendGameAction({
        type: "dispatchHandAction",
        action: {
          type: type,
          playerId,
        },
      });
    }
  };

  const handleLeave = () => {
    if (!isConnected) return;
    sendGameAction({ type: "leaveTable", playerId });
  };

  const handleSitOut = () => {
    if (!isConnected) return;
    sendGameAction({ type: "sitOut", playerId });
  };

  const handleSitIn = () => {
    if (!isConnected) return;
    sendGameAction({ type: "sitIn", playerId });
  };

  const handleAddChips = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    sendGameAction({
      type: "addChips",
      playerId,
      amount: buyInAmount,
    });
  };

  const isSittingOut = tableState.seats.find(s => s.playerId === playerId)?.status === "sitting-out";

  return (
    <div className="glass-panel w-full max-w-5xl mx-auto p-6 mt-4 flex flex-col gap-4 border-slate-800 bg-slate-950/40">
      {/* Turn indicator / spectator text */}
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          {!isConnected ? (
            <span className="text-red-400 font-bold">● Connection Lost</span>
          ) : hand ? (
            isMyTurn ? (
              <span className="text-cyan-400 font-bold animate-pulse">● Your Turn to Act</span>
            ) : activeActor ? (
              <span className="text-gray-400">Waiting for {activeActor.name}...</span>
            ) : null
          ) : (
            <span className="text-gray-500 font-medium">Table is waiting for players to deal the next hand.</span>
          )}
        </div>

        {/* Global seat controls */}
        {seatIndex !== null && (
          <div className="flex items-center gap-3">
            {isSittingOut ? (
              <button disabled={!isConnected} onClick={handleSitIn} className="btn-poker text-emerald-400 bg-emerald-950/20 hover:bg-emerald-900/30 border-emerald-900/40">
                Sit In
              </button>
            ) : (
              <button disabled={!isConnected} onClick={handleSitOut} className="btn-poker text-amber-400 bg-amber-950/20 hover:bg-amber-900/30 border-amber-900/40">
                Sit Out
              </button>
            )}

            {/* Top-up form */}
            <form onSubmit={handleAddChips} className="flex items-center gap-2">
              <input
                type="number"
                disabled={!isConnected}
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(parseInt(e.target.value) || 0)}
                className="w-20 px-2.5 py-1 bg-slate-900/80 border border-slate-800 rounded text-sm text-center text-white focus:outline-none focus:border-cyan-500"
              />
              <button type="submit" disabled={!isConnected} className="btn-poker">
                + Chips
              </button>
            </form>

            <button disabled={!isConnected} onClick={handleLeave} className="btn-poker text-red-400 bg-red-950/20 hover:bg-red-900/30 border-red-900/40">
              Leave Seat
            </button>
          </div>
        )}
      </div>

      {/* Main gameplay action controls panel */}
      {isMyTurn ? (
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between border-t border-slate-900 pt-4">
          <div className="flex gap-3 w-full md:w-auto">
            {foldAction && (
              <button
                disabled={!isConnected}
                onClick={() => handleAction("fold")}
                className="btn-poker flex-1 md:flex-none border-red-900/30 text-red-400 bg-red-950/10 hover:bg-red-900/20"
              >
                Fold
              </button>
            )}

            {checkAction && (
              <button
                disabled={!isConnected}
                onClick={() => handleAction("check")}
                className="btn-poker flex-1 md:flex-none border-cyan-900/30 text-cyan-400 bg-cyan-950/10 hover:bg-cyan-900/20"
              >
                Check
              </button>
            )}

            {callAction && (
              <button
                disabled={!isConnected}
                onClick={() => handleAction("call")}
                className="btn-poker flex-1 md:flex-none primary"
              >
                Call ${callAction.callAmount}
              </button>
            )}
          </div>

          {/* Raise Slider Controls */}
          {raiseAction && minRaise > 0 && maxRaise >= minRaise && (
            <div className="flex items-center gap-4 w-full md:w-auto flex-1 md:max-w-md">
              <input
                type="range"
                disabled={!isConnected}
                min={minRaise}
                max={maxRaise}
                step={tableState.config.smallBlind}
                value={raiseValue}
                onChange={(e) => setRaiseValue(parseInt(e.target.value) || minRaise)}
                className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              
              <div className="flex items-center gap-2 whitespace-nowrap">
                <input
                  type="number"
                  disabled={!isConnected}
                  min={minRaise}
                  max={maxRaise}
                  value={raiseValue}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || minRaise;
                    setRaiseValue(Math.max(minRaise, Math.min(maxRaise, val)));
                  }}
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-center text-white"
                />
                
                <button
                  disabled={!isConnected}
                  onClick={() => handleAction("raise")}
                  className="btn-poker primary px-6"
                >
                  Raise to ${raiseValue}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        seatIndex === null && (
          <div className="text-center text-sm text-gray-500 py-2">
            You are currently observing the table. Select an empty seat above to start playing.
          </div>
        )
      )}
    </div>
  );
};
