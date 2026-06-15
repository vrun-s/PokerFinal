import { create } from "zustand";
import { SanitizedTableState } from "../types/poker.ts";

export interface WinnerInfo {
  playerName: string;
  playerId: string;
  handRankLabel: string;  // e.g. "Full House" | "Winner by fold"
  isFoldWin: boolean;
  isSplit: boolean;
  totalPot: number;       // always the full pot, not floored per-winner
}

export interface HandResultSnapshot {
  resultKey: string;      // opaque identity key, e.g. playerId + handCount
  winners: WinnerInfo[];
}

interface TableStateStore {
  tableState: SanitizedTableState | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  errorMessage: string | null;
  handResult: HandResultSnapshot | null;
  setTableState: (state: SanitizedTableState | null) => void;
  setConnectionStatus: (status: "connecting" | "connected" | "disconnected") => void;
  setErrorMessage: (message: string | null) => void;
  setHandResult: (result: HandResultSnapshot | null) => void;
  clearTable: () => void;
}

export const useTableStore = create<TableStateStore>((set) => ({
  tableState: null,
  connectionStatus: "disconnected",
  errorMessage: null,
  handResult: null,

  setTableState: (tableState) => set({ tableState }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  setHandResult: (handResult) => set({ handResult }),
  clearTable: () => set({ tableState: null, errorMessage: null, handResult: null }),
}));

