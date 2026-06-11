import { create } from "zustand";
import { SanitizedTableState } from "../types/poker.ts";

interface TableStateStore {
  tableState: SanitizedTableState | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  errorMessage: string | null;
  setTableState: (state: SanitizedTableState | null) => void;
  setConnectionStatus: (status: "connecting" | "connected" | "disconnected") => void;
  setErrorMessage: (message: string | null) => void;
  clearTable: () => void;
}

export const useTableStore = create<TableStateStore>((set) => ({
  tableState: null,
  connectionStatus: "disconnected",
  errorMessage: null,

  setTableState: (tableState) => set({ tableState }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  clearTable: () => set({ tableState: null, errorMessage: null }),
}));
