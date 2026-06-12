import { Server } from "socket.io";
import { config } from "../config.js";
import { getTableState, redisClient } from "./redisService.js";
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

// Map of tableId -> ActiveTimer (tracked in-memory per node for local interval executions)
const activeTimers = new Map<string, ActiveTimer>();

export async function getPlayerTimeBank(tableId: string, playerId: string): Promise<number> {
  const key = `timebank:${tableId}:${playerId}`;
  const data = await redisClient.get(key);
  if (data === null) {
    // Initialize standard time bank in Redis
    await redisClient.set(key, config.TIME_BANK_DEFAULT_SECONDS.toString());
    return config.TIME_BANK_DEFAULT_SECONDS;
  }
  return parseInt(data, 10);
}

export async function setPlayerTimeBank(tableId: string, playerId: string, seconds: number): Promise<void> {
  const key = `timebank:${tableId}:${playerId}`;
  await redisClient.set(key, seconds.toString());
}

export function clearTimer(tableId: string): void {
  const timer = activeTimers.get(tableId);
  if (timer) {
    clearInterval(timer.intervalId);
    activeTimers.delete(tableId);
  }
}

export async function startPlayerTimer(io: Server, tableId: string, playerId: string): Promise<void> {
  // Clear any existing timer for this table first
  clearTimer(tableId);

  const timeBankLeft = await getPlayerTimeBank(tableId, playerId);

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
      } else {
        // Broadcast grace period status
        io.in(`table:${tableId}`).emit("timer_tick", {
          playerId,
          timeLeft: currentTimer.timeLeft,
          timeBankLeft: currentTimer.timeBankLeft,
          isTimeBank: false,
          isPaused: true,
          graceTimeLeft: currentTimer.graceTimeLeft,
          maxTimeLeft: config.ACTION_TIMEOUT_SECONDS,
        });
        return;
      }
    }

    if (currentTimer.timeLeft > 0) {
      currentTimer.timeLeft--;
      io.in(`table:${tableId}`).emit("timer_tick", {
        playerId,
        timeLeft: currentTimer.timeLeft,
        timeBankLeft: currentTimer.timeBankLeft,
        isTimeBank: false,
        isPaused: false,
        maxTimeLeft: config.ACTION_TIMEOUT_SECONDS,
      });
    } else if (currentTimer.timeBankLeft > 0) {
      currentTimer.timeBankLeft--;
      await setPlayerTimeBank(tableId, playerId, currentTimer.timeBankLeft);
      io.in(`table:${tableId}`).emit("timer_tick", {
        playerId,
        timeLeft: 0,
        timeBankLeft: currentTimer.timeBankLeft,
        isTimeBank: true,
        isPaused: false,
        maxTimeLeft: config.TIME_BANK_DEFAULT_SECONDS,
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
          await syncTimerForTableState(io, res.state, tableId);
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
export async function syncTimerForTableState(io: Server, state: TableState, tableId: string): Promise<void> {
  if (state.currentHandState) {
    const hand = state.currentHandState;
    if (hand.currentRound === "Showdown" || hand.currentRound === "Ended") {
      clearTimer(tableId);
    } else {
      const activeActor = hand.players[hand.actorIndex];
      if (activeActor) {
        await startPlayerTimer(io, tableId, activeActor.id);
      } else {
        clearTimer(tableId);
      }
    }
  } else {
    clearTimer(tableId);
  }
}
