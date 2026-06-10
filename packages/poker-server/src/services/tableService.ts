import { TableState, TableAction, tableReducer, distributePayouts } from "@poker-platform/poker-core";
import { getTableState, saveTableState } from "./redisService.js";
import {
  executeTransaction,
  deductPlayerBalance,
  creditPlayerBalance,
  logHandHistory,
} from "./postgresService.js";

export async function processTableAction(
  tableId: string,
  action: TableAction,
  clientHandActionSeq: number
): Promise<{ success: boolean; state: TableState; error?: string }> {
  try {
    return await executeTransaction(async (client) => {
      const state = await getTableState(tableId);
      if (!state) {
        throw new Error("Table not found");
      }

      // Reject action if client sequence is out of sync with current state
      if (state.handActionSeq !== clientHandActionSeq) {
        throw new Error("Out of sync action sequence (stale action rejected)");
      }

      // 1. Enforce buy-in / top-up balance checks and deductions before running reducer
      if (action.type === "joinTable") {
        await deductPlayerBalance(client, action.playerId, action.buyIn);
      } else if (action.type === "addChips") {
        await deductPlayerBalance(client, action.playerId, action.amount);
      }

      // 2. Execute the pure table reducer
      const nextState = tableReducer(state, action);

      // If nextState is identical reference, the reducer rejected the action as invalid
      if (nextState === state) {
        throw new Error("Invalid action according to table rules");
      }

      // 3. Process cash-outs (credits) for players leaving the table
      if (action.type === "leaveTable") {
        // Compare seats to identify who left immediately (when table is idle)
        for (let i = 0; i < state.seats.length; i++) {
          const oldSeat = state.seats[i]!;
          const newSeat = nextState.seats[i]!;
          if (oldSeat.playerId !== null && newSeat.playerId === null) {
            await creditPlayerBalance(client, oldSeat.playerId, oldSeat.stack);
          }
        }
      } else if (action.type === "startNextHand") {
        // Credit players who left mid-hand and were flushed from pendingLeaves
        for (let i = 0; i < state.seats.length; i++) {
          const oldSeat = state.seats[i]!;
          const newSeat = nextState.seats[i]!;
          if (oldSeat.playerId !== null && newSeat.playerId === null) {
            // Compute post-payout stack
            let postPayoutStack = oldSeat.stack;
            if (state.currentHandState) {
              const hand = state.currentHandState;
              if (hand.currentRound === "Showdown" || hand.currentRound === "Ended") {
                const payoutResult = distributePayouts(
                  hand.pots,
                  hand.players,
                  hand.communityCards,
                  hand.config.dealerIndex
                );
                const handPlayer = hand.players.find(p => p.id === oldSeat.playerId);
                if (handPlayer) {
                  const payout = payoutResult.payouts.find(p => p.playerId === oldSeat.playerId);
                  const payoutAmount = payout ? payout.amount : 0;
                  postPayoutStack = handPlayer.stack + payoutAmount;
                }
              }
            }
            if (postPayoutStack > 0) {
              await creditPlayerBalance(client, oldSeat.playerId, postPayoutStack);
            }
          }
        }

        // Log completed hand history to database
        if (state.currentHandState) {
          await logHandHistory(client, tableId, state.handCount + 1, state);
        }
      }

      // Commit changes to Redis cache
      await saveTableState(tableId, nextState);
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
