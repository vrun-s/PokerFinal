import { Server } from "socket.io";
import { config } from "../config.js";
import { getTableState } from "./redisService.js";
import { processTableAction } from "./tableService.js";
import { TableState } from "@poker-platform/poker-core";
import { broadcastTableState } from "../sockets/socketHandlers.js";

interface ActiveTimer {
  tableId: string;
  playerId: string;
  timeLeft: number;
  timeBankLeft: number;
  isPaused: boolean;
  graceTimeLeft: number;
  intervalId: NodeJS.Timeout;
}

// Map of tableId -> ActiveTimer
const activeTimers = new Map<string, ActiveTimer>();

// Map of "tableId:playerId" -> remaining time bank seconds
const playerTimeBanks = new Map<string, number>();

export function getPlayerTimeBank(tableId: string, playerId: string): number {
  const key = `${tableId}:${playerId}`;
  if (!playerTimeBanks.has(key)) {
    playerTimeBanks.set(key, config.TIME_BANK_DEFAULT_SECONDS);
  }
  return playerTimeBanks.get(key)!;
}

export function setPlayerTimeBank(tableId: string, playerId: string, seconds: number): void {
  playerTimeBanks.set(`${tableId}:${playerId}`, seconds);
}

export function clearTimer(tableId: string): void {
  const timer = activeTimers.get(tableId);
  if (timer) {
    clearInterval(timer.intervalId);
    activeTimers.delete(tableId);
  }
}

export function startPlayerTimer(io: Server, tableId: string, playerId: string): void {
  // Clear any existing timer for this table first
  clearTimer(tableId);

  const timeBankLeft = getPlayerTimeBank(tableId, playerId);

  const timer: ActiveTimer = {
    tableId,
    playerId,
    timeLeft: config.ACTION_TIMEOUT_SECONDS,
    timeBankLeft,
    isPaused: false,
    graceTimeLeft: config.DISCONNECT_GRACE_PAUSE_SECONDS,
    intervalId: null as any, // assigned below
  };

  timer.intervalId = setInterval(async () => {
    const currentTimer = activeTimers.get(tableId);
    if (!currentTimer || currentTimer.intervalId !== timer.intervalId) {
      clearInterval(timer.intervalId);
      return;
    }

    if (currentTimer.isPaused) {
      currentTimer.graceTimeLeft--;
      if (currentTimer.graceTimeLeft <= 0) {
        currentTimer.isPaused = false;
      }
      // Broadcast grace period status
      io.in(`table:${tableId}`).emit("timer_tick", {
        playerId,
        timeLeft: currentTimer.timeLeft,
        timeBankLeft: currentTimer.timeBankLeft,
        isTimeBank: false,
        isPaused: true,
        graceTimeLeft: currentTimer.graceTimeLeft,
      });
      return;
    }

    if (currentTimer.timeLeft > 0) {
      currentTimer.timeLeft--;
      io.in(`table:${tableId}`).emit("timer_tick", {
        playerId,
        timeLeft: currentTimer.timeLeft,
        timeBankLeft: currentTimer.timeBankLeft,
        isTimeBank: false,
        isPaused: false,
      });
    } else if (currentTimer.timeBankLeft > 0) {
      currentTimer.timeBankLeft--;
      setPlayerTimeBank(tableId, playerId, currentTimer.timeBankLeft);
      io.in(`table:${tableId}`).emit("timer_tick", {
        playerId,
        timeLeft: 0,
        timeBankLeft: currentTimer.timeBankLeft,
        isTimeBank: true,
        isPaused: false,
      });
    } else {
      // Timer and Time Bank expired -> Trigger automatic timeout action
      clearInterval(currentTimer.intervalId);
      activeTimers.delete(tableId);

      const state = await getTableState(tableId);
      if (state && state.currentHandState) {
        const timeoutAction = { type: "timeout" as const, playerId };
        const res = await processTableAction(tableId, timeoutAction, state.handActionSeq);
        if (res.success) {
          await broadcastTableState(io, tableId, res.state);
          // Start timer for the next actor if hand is still running
          syncTimerForTableState(io, res.state, tableId);
        }
      }
    }
  }, 1000);

  activeTimers.set(tableId, timer);
}

export function handleDisconnect(io: Server, tableId: string, playerId: string): void {
  const timer = activeTimers.get(tableId);
  if (timer && timer.playerId === playerId) {
    timer.isPaused = true;
    timer.graceTimeLeft = config.DISCONNECT_GRACE_PAUSE_SECONDS;
  }
}

export function handleReconnect(io: Server, tableId: string, playerId: string): void {
  const timer = activeTimers.get(tableId);
  if (timer && timer.playerId === playerId) {
    timer.isPaused = false;
  }
}

/**
 * Automatically inspects the table state to set or clear active timers.
 */
export function syncTimerForTableState(io: Server, state: TableState, tableId: string): void {
  if (state.currentHandState) {
    const hand = state.currentHandState;
    if (hand.currentRound === "Showdown" || hand.currentRound === "Ended") {
      clearTimer(tableId);
    } else {
      const activeActor = hand.players[hand.actorIndex];
      if (activeActor) {
        startPlayerTimer(io, tableId, activeActor.id);
      } else {
        clearTimer(tableId);
      }
    }
  } else {
    clearTimer(tableId);
  }
}
