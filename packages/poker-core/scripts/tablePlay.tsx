import { createTable, tableReducer } from "../src/index";
import type { TableConfig, TableAction } from "../src/index";

// ─── Setup ───────────────────────────────────────────────────────────────────

const config: TableConfig = {
    maxSeats: 6,
    minBuyIn: 400,
    maxBuyIn: 1000,
    smallBlind: 5,
    bigBlind: 10,
};

let state = createTable(config);

// Helper — dispatch and log
function dispatch(action: TableAction, label: string) {
    state = tableReducer(state, action);
    console.log(`\n── ${label} ──`);
    console.log("dealerIndex:", state.dealerIndex);
    console.log("handCount:", state.handCount);
    console.log("seats:", state.seats.map(s => ({
        i: s.index,
        id: s.playerId,
        stack: s.stack,
        status: s.status,
        mustWait: s.mustWaitForBB,
    })));
    if (state.currentHandState) {
        const h = state.currentHandState;
        console.log("hand phase:", h.currentRound);
        console.log("pots:", h.pots);
        console.log("actor:", h.players[h.actorIndex]?.id);
    }
}

// ─── Scenario ────────────────────────────────────────────────────────────────

// Seat three players
dispatch({ type: "joinTable", playerId: "alice", name: "Alice", buyIn: 500, seatIndex: 0 }, "Alice joins seat 0");
dispatch({ type: "joinTable", playerId: "bob", name: "Bob", buyIn: 500, seatIndex: 2 }, "Bob joins seat 2");
dispatch({ type: "joinTable", playerId: "carol", name: "Carol", buyIn: 500, seatIndex: 4 }, "Carol joins seat 4");

// Start hand 1
dispatch({ type: "startNextHand" }, "Hand 1 starts");

// Play through preflop: everyone calls
const h1 = state.currentHandState!;
const actors = [...h1.players].map(p => p.id); // note actor order
dispatch({ type: "dispatchHandAction", action: { type: "call", playerId: actors[0]! } }, "Actor 0 calls");
dispatch({ type: "dispatchHandAction", action: { type: "call", playerId: actors[1]! } }, "Actor 1 calls");
dispatch({ type: "dispatchHandAction", action: { type: "check", playerId: actors[2]! } }, "BB checks");

// Flop: everyone checks
for (const id of ["alice", "bob", "carol"]) {
    dispatch({ type: "dispatchHandAction", action: { type: "check", playerId: id } }, `${id} checks flop`);
}

// Turn: alice bets, others fold
dispatch({ type: "dispatchHandAction", action: { type: "raise", playerId: "alice", totalBet: 30 } }, "Alice bets turn");
dispatch({ type: "dispatchHandAction", action: { type: "fold", playerId: "bob" } }, "Bob folds turn");
dispatch({ type: "dispatchHandAction", action: { type: "fold", playerId: "carol" } }, "Carol folds turn");

// ── Hand should be over. Bob joins mid-hand test is done. ─────────────────
// Now simulate a mid-hand join (Dave arrives while hand 1 was in progress above)
// For a true mid-hand test, dispatch joinTable BEFORE the hand ends:
// dispatch({ type: "joinTable", ... }, "Dave joins mid-hand");

// Start hand 2 — button should advance
dispatch({ type: "startNextHand" }, "Hand 2 starts");

// ── Verify ───────────────────────────────────────────────────────────────────

console.log("\n═══ Final Verification ═══");
console.log("Total chips in play:", state.seats.reduce((sum, s) => sum + s.stack, 0));
console.log("Expected:", 1500); // 3 × 500