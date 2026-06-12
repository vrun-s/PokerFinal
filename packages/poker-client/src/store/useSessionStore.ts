import { create } from "zustand";

interface SessionState {
  playerId: string | null;
  name: string | null;
  token: string | null;
  tableId: string | null;
  seatIndex: number | null;
  balance: number | null;
  setSession: (playerId: string, name: string, token: string, balance?: number | null) => void;
  setTableId: (tableId: string | null) => void;
  setSeatIndex: (seatIndex: number | null) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  playerId: localStorage.getItem("poker_playerId") || null,
  name: localStorage.getItem("poker_name") || null,
  token: localStorage.getItem("poker_token") || null,
  tableId: null,
  seatIndex: null,
  balance: localStorage.getItem("poker_balance") ? parseInt(localStorage.getItem("poker_balance")!) : null,

  setSession: (playerId, name, token, balance = null) => {
    localStorage.setItem("poker_playerId", playerId);
    localStorage.setItem("poker_name", name);
    localStorage.setItem("poker_token", token);
    if (balance !== null && balance !== undefined) {
      localStorage.setItem("poker_balance", balance.toString());
    } else {
      localStorage.removeItem("poker_balance");
    }
    set({ playerId, name, token, balance });
  },

  setTableId: (tableId) => set({ tableId }),

  setSeatIndex: (seatIndex) => set({ seatIndex }),

  clearSession: () => {
    localStorage.removeItem("poker_playerId");
    localStorage.removeItem("poker_name");
    localStorage.removeItem("poker_token");
    localStorage.removeItem("poker_balance");
    set({ playerId: null, name: null, token: null, tableId: null, seatIndex: null, balance: null });
  },
}));
