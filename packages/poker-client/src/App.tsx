import React, { useState, useEffect } from "react";
import { useSessionStore } from "./store/useSessionStore.ts";
import { useTableStore } from "./store/useTableStore.ts";
import { PokerTable } from "./components/PokerTable.tsx";
import { ActionPanel } from "./components/ActionPanel.tsx";
import { initializeSocketEvents, subscribeToTable, sendGameAction } from "./services/socketEvents.ts";
import { socket } from "./services/socket.ts";

export const App: React.FC = () => {
  const { playerId, name, token, tableId, setSession, clearSession } = useSessionStore();
  const { tableState, connectionStatus } = useTableStore();
  
  const [inputPlayerId, setInputPlayerId] = useState("");
  const [inputName, setInputName] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Initialize socket events once on mount
  useEffect(() => {
    initializeSocketEvents();
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("table_state");
      socket.off("timer_tick");
      socket.off("error");
    };
  }, []);

  // Auto-subscribe if we have active session
  useEffect(() => {
    if (token) {
      subscribeToTable("1", token);
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPlayerId.trim() || !inputName.trim()) {
      setAuthError("Player ID and Name are required");
      return;
    }

    setIsLoading(true);
    setAuthError("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: inputPlayerId, name: inputName }),
      });

      if (!response.ok) {
        throw new Error("Authentication failed");
      }

      const data = await response.json();
      setSession(inputPlayerId, inputName, data.token);
    } catch (err: any) {
      setAuthError(err.message || "Failed to authenticate");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSit = (seatIndex: number) => {
    if (!token) return;
    const buyIn = tableState?.config.minBuyIn || 200;
    
    socket.emit("join_table", {
      tableId: "1",
      token,
      name,
      buyIn,
      seatIndex,
      handActionSeq: tableState ? tableState.stateVersion : 0,
    });
  };

  const handleStartHand = () => {
    sendGameAction({ type: "startNextHand" });
  };

  // If not logged in, render auth login screen
  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="glass-panel w-full max-w-sm p-8 flex flex-col gap-5 border-slate-800 bg-slate-950/60"
        >
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-white mb-1">
              POKER ARENA
            </h2>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
              Enter the Tournament
            </p>
          </div>

          {authError && (
            <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-lg text-center">
              {authError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Player Username
            </label>
            <input
              type="text"
              placeholder="e.g. user_99"
              value={inputPlayerId}
              onChange={(e) => setInputPlayerId(e.target.value)}
              className="px-3.5 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-cyan-500 text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. Captain Spade"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              className="px-3.5 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-cyan-500 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-poker primary py-2.5 rounded-lg text-sm"
          >
            {isLoading ? "Authenticating..." : "Join Lobby"}
          </button>
        </form>
      </div>
    );
  }

  const isHandRunning = tableState?.currentHandState !== null;
  const isHandCompleted =
    tableState?.currentHandState &&
    (tableState.currentHandState.currentRound === "Showdown" ||
      tableState.currentHandState.currentRound === "Ended");

  const showStartHandButton = tableState && (!isHandRunning || isHandCompleted);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass-panel mx-4 mt-4 px-6 py-4 flex items-center justify-between border-slate-800 bg-slate-955/40 rounded-xl">
        <div className="flex items-center gap-4">
          <span className="text-xl font-black tracking-widest text-cyan-400">
            POKER ARENA
          </span>
          <span className="text-xs bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-full text-gray-400 font-bold uppercase tracking-wider">
            Table #1
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Welcome,</span>
            <span className="font-bold text-white">{name}</span>
          </div>

          {showStartHandButton && (
            <button
              onClick={handleStartHand}
              className="btn-poker text-amber-300 border-amber-500/20 bg-amber-950/20 hover:bg-amber-900/30"
            >
              Deal Hand
            </button>
          )}

          <button
            onClick={clearSession}
            className="btn-poker text-xs font-semibold text-gray-500 hover:text-gray-300"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Board */}
      <main className="flex-1 flex items-center justify-center p-4">
        <PokerTable onSit={handleSit} />
      </main>

      {/* Footer / Controls */}
      <footer className="px-4 pb-4">
        <ActionPanel />
      </footer>
    </div>
  );
};
export default App;
