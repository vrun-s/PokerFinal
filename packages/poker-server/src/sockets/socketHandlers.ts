import { Server, Socket } from "socket.io";
import { TableState, TableAction } from "@poker-platform/poker-core";
import { getTableState } from "../services/redisService.js";
import { processTableAction } from "../services/tableService.js";
import { sanitizeStateForClient } from "./sanitizeState.js";
import {
  handleDisconnect,
  handleReconnect,
  syncTimerForTableState,
} from "../services/timeoutManager.js";
import crypto from "crypto";
import { logger } from "../services/logger.js";

const AUTH_SECRET = process.env.AUTH_SECRET || "poker-server-secret-key-12345";

export function generatePlayerToken(playerId: string): string {
  const hash = crypto.createHmac("sha256", AUTH_SECRET).update(playerId).digest("hex");
  return `${playerId}.${hash}`;
}

export function verifyPlayerToken(token: string): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [playerId, hash] = parts;
  if (!playerId || !hash) return null;
  const expectedHash = crypto.createHmac("sha256", AUTH_SECRET).update(playerId).digest("hex");
  if (hash === expectedHash) {
    return playerId;
  }
  return null;
}

function validateActionPlayerId(action: TableAction, authenticatedPlayerId: string): boolean {
  // Runtime guard: Clients must never submit 'timeout' actions.
  // Although TypeScript compile-time types exclude it, raw Socket.IO payloads are untrusted JSON.
  const rawAction = action as unknown;
  if (
    typeof rawAction === "object" &&
    rawAction !== null &&
    "type" in rawAction &&
    (rawAction as { type: string }).type === "timeout"
  ) {
    return false;
  }
  if (action.type === "dispatchHandAction") {
    return action.action.playerId === authenticatedPlayerId;
  }
  if (action.type === "startNextHand") {
    return true; // startNextHand does not target a specific player
  }
  // For joinTable, leaveTable, sitOut, sitIn, addChips
  return action.playerId === authenticatedPlayerId;
}

export async function broadcastTableState(io: Server, tableId: string, state: TableState): Promise<void> {
  const room = `table:${tableId}`;
  const sockets = await io.in(room).fetchSockets();

  for (const socket of sockets) {
    const playerId = socket.data.playerId || "";
    const sanitized = sanitizeStateForClient(state, playerId);
    socket.emit("table_state", sanitized);
  }
}

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    // 1. Subscribe to table changes (observe / connect)
    socket.on("subscribe_table", async (data: { tableId: string; token: string }) => {
      const { tableId, token } = data;
      const playerId = verifyPlayerToken(token);
      if (!playerId) {
        socket.emit("error", { message: "Invalid authentication token" });
        return;
      }
      socket.data.playerId = playerId;
      socket.data.tableId = tableId;
      await socket.join(`table:${tableId}`);

      logger.info({ tableId, playerId }, "Player subscribed to table room");

      // Handle timer reconnect grace period resume
      handleReconnect(io, tableId, playerId);

      const state = await getTableState(tableId);
      if (state) {
        const sanitized = sanitizeStateForClient(state, playerId);
        socket.emit("table_state", sanitized);
      } else {
        socket.emit("error", { message: "Table not found" });
      }
    });

    // 2. Seating join table action
    socket.on("join_table", async (data: {
      tableId: string;
      token: string;
      name: string;
      buyIn: number;
      seatIndex: number;
      handActionSeq: number;
    }) => {
      const { tableId, token, name, buyIn, seatIndex, handActionSeq } = data;
      const playerId = verifyPlayerToken(token);
      if (!playerId) {
        socket.emit("error", { message: "Invalid authentication token" });
        return;
      }

      socket.data.playerId = playerId;
      socket.data.tableId = tableId;
      await socket.join(`table:${tableId}`);

      const joinAction: TableAction = {
        type: "joinTable",
        playerId,
        name,
        buyIn,
        seatIndex,
      };

      const res = await processTableAction(tableId, joinAction, handActionSeq);

      if (!res.success) {
        logger.error({ tableId, playerId, error: res.error || "Failed to join table" }, "Player join table action failed");
        socket.emit("error", { message: res.error || "Failed to join table" });
      } else {
        logger.info({ tableId, playerId, seatIndex, buyIn }, "Player successfully joined table");
      }
    });

    // 3. Dispatch hand or table action
    socket.on("game_action", async (data: {
      tableId: string;
      playerId: string;
      action: TableAction;
      handActionSeq: number;
    }) => {
      const { tableId, playerId, action, handActionSeq } = data;

      // Enforce authorization check that playerId matches socket data
      if (!socket.data.playerId || playerId !== socket.data.playerId) {
        socket.emit("error", { message: "Unauthorized action player ID" });
        return;
      }

      // Enforce check that player ID inside the action matches socket data, and reject forged timeouts
      if (!validateActionPlayerId(action, socket.data.playerId)) {
        socket.emit("error", { message: "Unauthorized action player ID or invalid action type" });
        return;
      }

      logger.info({ tableId, playerId, actionType: action.type }, "Received client game action");

      const res = await processTableAction(tableId, action, handActionSeq);

      if (!res.success) {
        logger.error({ tableId, playerId, actionType: action.type, error: res.error || "Action rejected" }, "Client game action rejected");
        socket.emit("error", { message: res.error || "Action rejected" });
      }
    });

    // 4. Client disconnect
    socket.on("disconnect", () => {
      const { tableId, playerId } = socket.data;
      if (tableId && playerId) {
        logger.info({ tableId, playerId }, "Player disconnected");
        // Trigger grace pause if they were the active actor
        handleDisconnect(io, tableId, playerId);
      }
    });
  });
}
