import { create } from "zustand";
import { SanitizedTableState } from "../types/poker.ts";

interface TableStateStore {
  tableState: SanitizedTableState | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  setTableState: (state: SanitizedTableState | null) => void;
  setConnectionStatus: (status: "connecting" | "connected" | "disconnected") => void;
  clearTable: () => void;
}

export const useTableStore = create<TableStateStore>((set) => ({
  tableState: null,
  connectionStatus: "disconnected",

  setTableState: (tableState) => set({ tableState }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  clearTable: () => set({ tableState: null }),
}));
