/*import { startHand, transition } from "../src/state-machine/reducer.js";
import { distributePayouts } from "../src/state-machine/potCalculations.js";

const state = startHand(
    { smallBlind: 10, bigBlind: 20, dealerIndex: 0 },
    [
        { id: "P0", name: "Alice", stack: 1000 },
        { id: "P1", name: "Bob", stack: 1000 },
        { id: "P2", name: "Carol", stack: 1000 },
    ]
);
function act(state: any, action: any) {
    const result = transition(state, action);
    if (!result.ok) {
        console.error("Action failed:", result.error);
        process.exit(1);
    }
    return result.value;
}

let s = state;

// Preflop
s = act(s, { type: "call", playerId: "P0" });
s = act(s, { type: "call", playerId: "P1" });
s = act(s, { type: "check", playerId: "P2" });
console.log("=== Flop ===", s.communityCards);

// Flop
s = act(s, { type: "check", playerId: "P1" });
s = act(s, { type: "check", playerId: "P2" });
s = act(s, { type: "check", playerId: "P0" });
console.log("=== Turn ===", s.communityCards);

// Turn
s = act(s, { type: "raise", playerId: "P1", totalBet: 50 });
s = act(s, { type: "call", playerId: "P2" });
s = act(s, { type: "fold", playerId: "P0" });
console.log("=== River ===", s.communityCards);

// River
s = act(s, { type: "check", playerId: "P1" });
s = act(s, { type: "check", playerId: "P2" });
console.log("=== Showdown ===", s.currentRound);

// Payouts
const payouts = distributePayouts(s.pots, s.players, s.communityCards, 0);

console.log("Payouts:", payouts);
console.log("=== startHand ===");
console.log("Round:", state.currentRound);
console.log("Actor:", state.players[state.actorIndex]?.name);
console.log("Current bet:", state.currentBet);
console.log("Pots:", state.pots);
state.players.forEach(p =>
    console.log(`  ${p.name}: stack=${p.stack}, bet=${p.currentRoundBet}, status=${p.status}`)
);*/