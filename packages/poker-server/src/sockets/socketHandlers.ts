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
    socket.on("subscribe_table", async (data: { tableId: string; playerId: string }) => {
      const { tableId, playerId } = data;
      socket.data.playerId = playerId;
      socket.data.tableId = tableId;
      await socket.join(`table:${tableId}`);

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
      playerId: string;
      name: string;
      buyIn: number;
      seatIndex: number;
      handActionSeq: number;
    }) => {
      const { tableId, playerId, name, buyIn, seatIndex, handActionSeq } = data;

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

      if (res.success) {
        // Sync active timer for the table state
        syncTimerForTableState(io, res.state, tableId);
        await broadcastTableState(io, tableId, res.state);
      } else {
        socket.emit("error", { message: res.error || "Failed to join table" });
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
      if (playerId !== socket.data.playerId) {
        socket.emit("error", { message: "Unauthorized action player ID" });
        return;
      }

      const res = await processTableAction(tableId, action, handActionSeq);

      if (res.success) {
        // Sync active timer for the table state
        syncTimerForTableState(io, res.state, tableId);
        await broadcastTableState(io, tableId, res.state);
      } else {
        socket.emit("error", { message: res.error || "Action rejected" });
      }
    });

    // 4. Client disconnect
    socket.on("disconnect", () => {
      const { tableId, playerId } = socket.data;
      if (tableId && playerId) {
        // Trigger grace pause if they were the active actor
        handleDisconnect(io, tableId, playerId);
      }
    });
  });
}
