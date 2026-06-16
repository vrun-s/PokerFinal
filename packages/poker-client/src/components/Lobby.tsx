import React, { useState, useEffect } from "react";
import { useSessionStore } from "../store/useSessionStore.ts";
import { subscribeToTable } from "../services/socketEvents.ts";

interface TableInfo {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  playersSeated: number;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  balance: number;
}

export const Lobby: React.FC = () => {
  const { name, token, balance, clearSession } = useSessionStore();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string>("");

  const apiPrefix = import.meta.env.VITE_API_URL || "";

  const fetchTables = async () => {
    try {
      const response = await fetch(`${apiPrefix}/api/tables`);
      if (response.ok) {
        const data = await response.json();
        setTables(data);
      }
    } catch (err) {
      console.error("Failed to fetch tables", err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${apiPrefix}/api/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchLeaderboard();

    // Poll tables every 5 seconds
    const interval = setInterval(fetchTables, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinTable = (tableId: string) => {
    if (token) {
      subscribeToTable(tableId, token);
    } else {
      setError("Please log in first");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-white p-4 md:p-8">
      {/* Header */}
      <header className="glass-panel w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between border-slate-800 bg-slate-900/40 rounded-xl mb-8">
        <div className="flex items-center gap-4">
          <span className="text-xl font-black tracking-widest text-cyan-400">
            POKER ARENA
          </span>
          <span className="text-xs bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-full text-gray-400 font-bold uppercase tracking-wider">
            Lobby
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <span>Welcome,</span>
              <span className="font-bold text-white">{name}</span>
            </div>
            {balance !== null && (
              <span className="text-xs bg-emerald-950/40 border border-emerald-900/30 px-3.5 py-1 rounded-full text-emerald-400 font-bold uppercase tracking-wider">
                Wallet Balance: ${balance}
              </span>
            )}
          </div>

          <button
            onClick={clearSession}
            className="btn-poker text-xs font-semibold text-gray-500 hover:text-gray-300"
          >
            Log Out
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto w-full text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-lg text-center mb-6">
          {error}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-6xl mx-auto flex-1">
        {/* Tables list */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider mb-2">
            Active Cash Tables
          </h3>

          <div className="flex flex-col gap-4">
            {tables.length === 0 ? (
              <div className="glass-panel p-8 text-center text-gray-500 rounded-xl border-slate-800/50 bg-slate-900/20">
                Loading tables...
              </div>
            ) : (
              tables.map((table) => (
                <div
                  key={table.id}
                  className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-slate-800 hover:border-slate-700 bg-slate-900/20 hover:bg-slate-900/30 rounded-xl transition-all duration-300"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-xl font-bold text-white">
                        {table.name}
                      </h4>
                      <span className="text-xs bg-cyan-950/40 border border-cyan-900/30 px-2 py-0.5 rounded-md text-cyan-400 font-semibold">
                        {table.playersSeated}/6 Players
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400 mt-1">
                      <div>
                        Blinds: <span className="text-white font-semibold">${table.smallBlind}/${table.bigBlind}</span>
                      </div>
                      <div>
                        Min/Max Buy-in: <span className="text-white font-semibold">${table.minBuyIn}/${table.maxBuyIn}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinTable(table.id)}
                    className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-sm transition-all duration-300 shadow-md shadow-cyan-950/20 active:scale-95"
                  >
                    Join Table
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leaderboard widget */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-gray-400 uppercase tracking-wider mb-2">
            Top Players Leaderboard
          </h3>

          <div className="glass-panel p-6 border-slate-800 bg-slate-900/20 rounded-xl flex flex-col gap-3">
            {leaderboard.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No rankings available
              </div>
            ) : (
              leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between border-b border-slate-800/40 pb-2.5 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        index === 0
                          ? "bg-amber-400/20 text-amber-400 border border-amber-400/30"
                          : index === 1
                          ? "bg-slate-300/20 text-slate-300 border border-slate-300/30"
                          : index === 2
                          ? "bg-amber-600/20 text-amber-600 border border-amber-600/30"
                          : "bg-slate-800 text-gray-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="font-semibold text-gray-200">
                      {player.name}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-400 text-sm">
                    ${player.balance}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
