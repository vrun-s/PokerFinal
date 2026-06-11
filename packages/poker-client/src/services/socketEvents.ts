import { socket } from "./socket.ts";
import { useTableStore } from "../store/useTableStore.ts";
import { useTimerStore } from "../store/useTimerStore.ts";
import { useSessionStore } from "../store/useSessionStore.ts";
import { SanitizedTableState } from "../types/poker.ts";

export function initializeSocketEvents() {
  socket.on("connect", () => {
    useTableStore.getState().setConnectionStatus("connected");
    
    // Auto-resubscribe if we had a tableId and token (reconnection flow)
    const { tableId, token } = useSessionStore.getState();
    if (tableId && token) {
      socket.emit("subscribe_table", { tableId, token });
    }
  });

  socket.on("disconnect", () => {
    useTableStore.getState().setConnectionStatus("disconnected");
    useTimerStore.getState().clearTimer();
  });

  socket.on("table_state", (state: SanitizedTableState) => {
    useTableStore.getState().setTableState(state);
    
    // If the active actor changes or the hand ends, clear timer just in case it doesn't tick
    if (!state.currentHandState) {
      useTimerStore.getState().clearTimer();
    }
    
    // Determine client's seatIndex dynamically from seats matching playerId
    const { playerId } = useSessionStore.getState();
    if (playerId) {
      const mySeat = state.seats.find((s) => s.playerId === playerId);
      if (mySeat) {
        useSessionStore.getState().setSeatIndex(mySeat.index);
      } else {
        useSessionStore.getState().setSeatIndex(null);
      }
    }
  });

  socket.on("timer_tick", (timer) => {
    useTimerStore.getState().setActiveTimer(timer);
  });

  socket.on("error", (err: any) => {
    console.error("Socket error received from server:", err);
    const message = typeof err === "string" ? err : err.message || "An unknown error occurred";
    useTableStore.getState().setErrorMessage(message);
    setTimeout(() => {
      if (useTableStore.getState().errorMessage === message) {
        useTableStore.getState().setErrorMessage(null);
      }
    }, 5000);
  });
}

// Infrastructure helper to send actions securely with stateVersion (sequence check)
export function sendGameAction(actionPayload: any) {
  const { tableId, playerId } = useSessionStore.getState();
  const { tableState } = useTableStore.getState();
  
  if (!tableId || !playerId) {
    console.error("Cannot send game action: missing tableId or playerId");
    return;
  }

  const payload = {
    tableId,
    playerId,
    handActionSeq: tableState ? tableState.stateVersion : 0,
    action: actionPayload,
  };

  socket.emit("game_action", payload);
}

export function subscribeToTable(tableId: string, token: string) {
  useSessionStore.getState().setTableId(tableId);
  useTableStore.getState().setConnectionStatus("connecting");
  
  if (!socket.connected) {
    socket.connect();
  } else {
    socket.emit("subscribe_table", { tableId, token });
  }
}
