import React, { useState, useEffect } from "react";
import { useSessionStore } from "./store/useSessionStore.ts";
import { useTableStore } from "./store/useTableStore.ts";
import { PokerTable } from "./components/PokerTable.tsx";
import { ActionPanel } from "./components/ActionPanel.tsx";
import { initializeSocketEvents, subscribeToTable, sendGameAction } from "./services/socketEvents.ts";
import { socket } from "./services/socket.ts";
import { Lobby } from "./components/Lobby.tsx";
import { HistoryPanel } from "./components/HistoryPanel.tsx";

export const App: React.FC = () => {
  const { playerId, name, token, tableId, balance, setSession, clearSession } = useSessionStore();
  const { tableState, connectionStatus } = useTableStore();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [inputUsername, setInputUsername] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [inputDisplayName, setInputDisplayName] = useState("");
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
      socket.off("account_balance");
    };
  }, []);

  // Auto-subscribe if we have active session and tableId is selected
  useEffect(() => {
    if (token && tableId) {
      subscribeToTable(tableId, token);
    }
  }, [token, tableId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = inputUsername.trim();
    const p = inputPassword;
    const d = inputDisplayName.trim();

    if (isRegisterMode) {
      if (!u || !d || !p) {
        setAuthError("All fields are required");
        return;
      }
      const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
      if (!usernameRegex.test(u)) {
        setAuthError("Username must be alphanumeric and between 3 and 20 characters");
        return;
      }
      if (p.length < 8) {
        setAuthError("Password must be at least 8 characters long");
        return;
      }
    } else {
      if (!u || !p) {
        setAuthError("Username and password are required");
        return;
      }
    }

    setIsLoading(true);
    setAuthError("");

    try {
      const apiPrefix = import.meta.env.VITE_API_URL || "";
      if (isRegisterMode) {
        // Register flow
        const registerResponse = await fetch(`${apiPrefix}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, displayName: d, password: p }),
        });

        if (!registerResponse.ok) {
          const errData = await registerResponse.json().catch(() => ({}));
          throw new Error(errData.error || "Registration failed");
        }

        const registerData = await registerResponse.json();
        // Auto-login: use token directly and set initial balance to 10000
        setSession(u, d, registerData.token, 10000);
      } else {
        // Login flow
        const loginResponse = await fetch(`${apiPrefix}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, password: p }),
        });

        if (!loginResponse.ok) {
          const errData = await loginResponse.json().catch(() => ({}));
          throw new Error(errData.error || "Invalid username or password");
        }

        const loginData = await loginResponse.json();
        setSession(u, loginData.name, loginData.token, loginData.balance);
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSit = (seatIndex: number) => {
    if (!token || !tableId) return;
    const buyIn = tableState?.config.minBuyIn || 200;
    
    socket.emit("join_table", {
      tableId,
      token,
      name,
      buyIn,
      seatIndex,
      handActionSeq: tableState ? tableState.stateVersion : 0,
    });
  };

  const handleLeaveTable = () => {
    if (token && playerId && tableId) {
      sendGameAction({ type: "leaveTable", playerId });
    }
    useSessionStore.setState({ tableId: null, seatIndex: null });
    useTableStore.setState({ tableState: null });
  };

  const handleStartHand = () => {
    sendGameAction({ type: "startNextHand" });
  };

  // If not logged in, render auth login screen
  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="glass-panel w-full max-w-sm p-8 flex flex-col gap-5 border-slate-800 bg-slate-900/60"
        >
          <div className="text-center">
            <h2 className="text-3xl font-black tracking-tight text-white mb-1">
              POKER ARENA
            </h2>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
              {isRegisterMode ? "Create an Account" : "Enter the Tournament"}
            </p>
          </div>

          {authError && (
            <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-lg text-center">
              {authError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Username
            </label>
            <input
              type="text"
              placeholder="e.g. user99"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              className="px-3.5 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-slate-400 text-sm"
              required
            />
          </div>

          {isRegisterMode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                placeholder="e.g. Captain Spade"
                value={inputDisplayName}
                onChange={(e) => setInputDisplayName(e.target.value)}
                className="px-3.5 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-slate-400 text-sm"
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              className="px-3.5 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-slate-400 text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-white hover:bg-slate-200 text-slate-950 font-bold rounded-lg text-sm transition-all disabled:opacity-50"
          >
            {isLoading
              ? "Authenticating..."
              : isRegisterMode
              ? "Create Account"
              : "Join Lobby"}
          </button>

          <div className="text-center text-xs text-gray-500 mt-2">
            {isRegisterMode ? (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setAuthError("");
                  }}
                  className="text-white hover:text-slate-200 font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  Log In
                </button>
              </span>
            ) : (
              <span>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setAuthError("");
                  }}
                  className="text-white hover:text-slate-200 font-semibold hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  Register
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    );
  }

  // If logged in but not at a table, render the Lobby screen
  if (!tableId) {
    return <Lobby />;
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
      <header className="glass-panel mx-4 mt-4 px-6 py-4 flex items-center justify-between border-slate-800 bg-slate-900/40 rounded-xl">
        <div className="flex items-center gap-4">
          <span className="text-xl font-black tracking-widest text-cyan-400">
            POKER ARENA
          </span>
          <span className="text-xs bg-slate-900/80 border border-slate-800 px-3 py-1 rounded-full text-gray-400 font-bold uppercase tracking-wider">
            Table #{tableId}
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

          {showStartHandButton && (
            <button
              onClick={handleStartHand}
              className="btn-poker text-amber-300 border-amber-500/20 bg-amber-950/20 hover:bg-amber-900/30"
            >
              Deal Hand
            </button>
          )}

          <button
            onClick={handleLeaveTable}
            className="btn-poker text-xs font-semibold text-cyan-400 hover:text-cyan-300 border-cyan-500/20 bg-cyan-950/20"
          >
            Lobby
          </button>

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
        <HistoryPanel />
      </main>

      {/* Footer / Controls */}
      <footer className="px-4 pb-4">
        <ActionPanel />
      </footer>
    </div>
  );
};
export default App;
