import { create } from "zustand";

export interface ActiveTimer {
  readonly playerId: string;
  readonly timeLeft: number;
  readonly timeBankLeft: number;
  readonly isPaused: boolean;
  readonly isTimeBank?: boolean;
  readonly graceTimeLeft?: number;
}

interface TimerStore {
  activeTimer: ActiveTimer | null;
  setActiveTimer: (timer: ActiveTimer | null) => void;
  clearTimer: () => void;
}

export const useTimerStore = create<TimerStore>((set) => ({
  activeTimer: null,
  setActiveTimer: (activeTimer) => set({ activeTimer }),
  clearTimer: () => set({ activeTimer: null }),
}));
