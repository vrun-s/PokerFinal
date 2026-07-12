import { Server } from "socket.io";
import { config } from "../config.js";
import { getTableState, redisClient } from "./redisService.js";
import { processTableAction } from "./tableService.js";
import { TableState } from "@poker-platform/poker-core";
import { broadcastTableState } from "../sockets/socketHandlers.js";
import { logger } from "./logger.js";

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

// Map of tableId:playerId -> Timeout ID
const inactivityTimers = new Map<string, NodeJS.Timeout>();

export function startInactivityTimer(io: Server, tableId: string, playerId: string): void {
  const key = `${tableId}:${playerId}`;
  if (inactivityTimers.has(key)) {
    return; // Idempotency check: no-op if a timer is already running for this player
  }

  const timeoutMs = (config.INACTIVITY_TIMEOUT_SECONDS || 300) * 1000;

  const timeoutId = setTimeout(async () => {
    logger.info({ tableId, playerId }, "Inactivity timeout reached, verifying status before eviction");
    inactivityTimers.delete(key);

    try {
      const state = await getTableState(tableId);
      if (state) {
        const seat = state.seats.find(s => s.playerId === playerId);
        if (!seat) {
          logger.info({ tableId, playerId }, "Inactivity eviction cancelled: player already left table");
          return;
        }

        // Re-verify connection and activity status to prevent race conditions
        const isSittingOut = seat.status === "sitting-out";
        const playerSockets = await io.in(playerId).fetchSockets();
        const isDisconnected = playerSockets.length === 0;

        const isCurrentActor = state.currentHandState &&
          (state.currentHandState.currentRound !== "Showdown" && state.currentHandState.currentRound !== "Ended") &&
          state.currentHandState.players[state.currentHandState.actorIndex]?.id === playerId;

        const stillInactive = isSittingOut || (isDisconnected && !isCurrentActor);

        if (stillInactive) {
          logger.info({ tableId, playerId }, "Inactivity eviction re-verified, dispatching leaveTable");
          const leaveAction = { type: "leaveTable" as const, playerId };
          const res = await processTableAction(tableId, leaveAction, state.handActionSeq);
          if (res.success) {
            await broadcastTableState(io, tableId, res.state);
            await syncTimerForTableState(io, res.state, tableId);
          }
        } else {
          logger.info({ tableId, playerId }, "Inactivity eviction aborted: player is active or reconnected");
        }
      }
    } catch (err: any) {
      logger.error({ tableId, playerId, error: err.message }, "Error during inactivity eviction");
    }
  }, timeoutMs);

  inactivityTimers.set(key, timeoutId);
}

export function clearInactivityTimer(tableId: string, playerId: string): void {
  const key = `${tableId}:${playerId}`;
  const timeoutId = inactivityTimers.get(key);
  if (timeoutId) {
    clearTimeout(timeoutId);
    inactivityTimers.delete(key);
  }
}

export function hasInactivityTimer(tableId: string, playerId: string): boolean {
  return inactivityTimers.has(`${tableId}:${playerId}`);
}

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

export async function handleDisconnect(io: Server, tableId: string, playerId: string): Promise<void> {
  const timer = activeTimers.get(tableId);
  if (timer && timer.playerId === playerId) {
    timer.isPaused = true;
    timer.graceTimeLeft = config.DISCONNECT_GRACE_PAUSE_SECONDS;
  } else {
    // Player is not the active actor. Start inactivity timer if they are seated.
    try {
      const state = await getTableState(tableId);
      if (state) {
        const isSeated = state.seats.some(s => s.playerId === playerId);
        if (isSeated) {
          startInactivityTimer(io, tableId, playerId);
        }
      }
    } catch (err: any) {
      logger.error({ tableId, playerId, error: err.message }, "Error handling disconnect in handleDisconnect");
    }
  }
}

export async function handleReconnect(io: Server, tableId: string, playerId: string): Promise<void> {
  const timer = activeTimers.get(tableId);
  if (timer && timer.playerId === playerId) {
    timer.isPaused = false;
  }

  try {
    const state = await getTableState(tableId);
    if (state) {
      const seat = state.seats.find(s => s.playerId === playerId);
      // Only clear the inactivity timer if they are NOT still sitting out.
      // A sitting-out player reconnecting should NOT reset or clear their idle eviction clock.
      if (seat && seat.status !== "sitting-out") {
        clearInactivityTimer(tableId, playerId);
      }
    } else {
      clearInactivityTimer(tableId, playerId);
    }
  } catch (err: any) {
    logger.error({ tableId, playerId, error: err.message }, "Error handling reconnect in handleReconnect");
    clearInactivityTimer(tableId, playerId);
  }
}

/**
 * Automatically inspects the table state to set or clear active timers.
 */
export async function syncTimerForTableState(io: Server, state: TableState, tableId: string): Promise<void> {
  // Clear inactivity timers for players who are no longer seated at this table
  const seats = state.seats || [];
  const seatedPlayerIds = new Set(seats.map(s => s.playerId).filter((id): id is string => id !== null));
  for (const key of inactivityTimers.keys()) {
    if (key.startsWith(`${tableId}:`)) {
      const [, playerId] = key.split(":");
      if (playerId && !seatedPlayerIds.has(playerId)) {
        clearInactivityTimer(tableId, playerId);
      }
    }
  }

  if (state.currentHandState) {
    const hand = state.currentHandState;
    if (hand.currentRound === "Showdown" || hand.currentRound === "Ended") {
      clearTimer(tableId);
    } else {
      const activeActor = hand.players[hand.actorIndex];
      if (activeActor) {
        // Clear inactivity timer for the player who becomes the active actor.
        // NOTE: If they are disconnected, it's safe to clear their inactivity timer here because
        // their turn-timer starts running now. Within ~20-45s (ACTION_TIMEOUT_SECONDS + time bank),
        // the turn timer will auto-fold/check them and chain a sitOut action, which restarts
        // a fresh inactivity timer. Thus, the gap is bounded by one turn-timer cycle.
        clearInactivityTimer(tableId, activeActor.id);
        await startPlayerTimer(io, tableId, activeActor.id);
      } else {
        clearTimer(tableId);
      }
    }
  } else {
    clearTimer(tableId);
  }
}
