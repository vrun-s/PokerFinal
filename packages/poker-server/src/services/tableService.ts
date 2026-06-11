import {
  TableState,
  TableAction,
  tableReducer,
  applyHandPayouts,
  evictBustedPlayers,
} from "@poker-platform/poker-core";
import { getTableState, saveTableState, publishTableUpdate } from "./redisService.js";
import {
  executeTransaction,
  deductPlayerBalance,
  creditPlayerBalance,
  logHandHistory,
} from "./postgresService.js";

export async function processTableAction(
  tableId: string,
  action: TableAction | { readonly type: "timeout"; readonly playerId: string },
  clientHandActionSeq: number
): Promise<{ success: boolean; state: TableState; error?: string }> {
  try {
    return await executeTransaction(async (client) => {
      const state = await getTableState(tableId);
      if (!state) {
        throw new Error("Table not found");
      }

      // Reject action if client sequence is out of sync with current state (bypass for timeouts)
      if (action.type !== "timeout" && state.handActionSeq !== clientHandActionSeq) {
        throw new Error("Out of sync action sequence (stale action rejected)");
      }

      // Convert timeout to check or fold before running the tableReducer
      let processedAction: TableAction;
      if (action.type === "timeout") {
        if (!state.currentHandState) {
          throw new Error("No active hand for timeout");
        }
        const hand = state.currentHandState;
        const currentActor = hand.players[hand.actorIndex];
        if (!currentActor || currentActor.id !== action.playerId) {
          throw new Error("Stale timeout action");
        }

        const isFold = currentActor.currentRoundBet < hand.currentBet;
        const gameAction = isFold
          ? { type: "fold" as const, playerId: action.playerId }
          : { type: "check" as const, playerId: action.playerId };

        processedAction = {
          type: "dispatchHandAction",
          action: gameAction,
        };
      } else if (action.type === "startNextHand") {
        processedAction = { ...action, deck: undefined };
      } else {
        processedAction = action;
      }

      // 1. Enforce buy-in / top-up balance checks and deductions before running reducer
      if (processedAction.type === "joinTable") {
        await deductPlayerBalance(client, processedAction.playerId, processedAction.buyIn);
      } else if (processedAction.type === "addChips") {
        if (processedAction.amount <= 0) {
          throw new Error("Add chips amount must be positive");
        }
        const seat = state.seats.find(s => s.playerId === processedAction.playerId);
        if (!seat) {
          throw new Error("Player not seated at table");
        }
        if (seat.stack + processedAction.amount > state.config.maxBuyIn) {
          throw new Error("Top-up exceeds table max buy-in");
        }
        await deductPlayerBalance(client, processedAction.playerId, processedAction.amount);
      }

      // 2. Execute the pure table reducer
      const nextState = tableReducer(state, processedAction);

      // If nextState is identical reference, the reducer rejected the action as invalid
      if (nextState === state) {
        throw new Error("Invalid action according to table rules");
      }

      // 3. Process cash-outs (credits) for players leaving the table
      if (processedAction.type === "leaveTable") {
        // Compare seats to identify who left immediately (when table is idle)
        for (let i = 0; i < state.seats.length; i++) {
          const oldSeat = state.seats[i]!;
          const newSeat = nextState.seats[i]!;
          if (oldSeat.playerId !== null && newSeat.playerId === null) {
            await creditPlayerBalance(client, oldSeat.playerId, oldSeat.stack);
          }
        }
      } else if (processedAction.type === "startNextHand") {
        // Compute intermediate state post-payouts & evictions to find leaving players' stacks
        let postPayoutState = applyHandPayouts(state);
        postPayoutState = evictBustedPlayers(postPayoutState);

        // Credit players who left mid-hand and were flushed from pendingLeaves
        for (const playerId of state.pendingLeaves) {
          const seat = postPayoutState.seats.find(s => s.playerId === playerId);
          if (seat && seat.stack > 0) {
            await creditPlayerBalance(client, playerId, seat.stack);
          }
        }

        // Log completed hand history to database
        if (state.currentHandState) {
          await logHandHistory(client, tableId, state.handCount + 1, state);
        }
      }

      // Commit changes to Redis cache
      await saveTableState(tableId, nextState);
      await publishTableUpdate(tableId);
      return { success: true, state: nextState };
    });
  } catch (error: any) {
    // If PG transaction fails, Redis is untouched. Fetch and return current state.
    const originalState = await getTableState(tableId);
    return {
      success: false,
      state: originalState || (null as any),
      error: error.message || "Action failed",
    };
  }
}
