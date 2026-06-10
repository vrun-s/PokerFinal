import { startHand, transition } from "./reducer.js";
import { distributePayouts } from "./potCalculations.js";
/**
 * Initializes a new TableState with empty seats.
 */
export function createTable(config) {
    const seats = Array.from({ length: config.maxSeats }, (_, index) => ({
        index,
        playerId: null,
        name: null,
        stack: 0,
        status: "empty",
        mustWaitForBB: false,
    }));
    return {
        config,
        seats,
        currentHandState: null,
        dealerIndex: 0,
        handCount: 0,
        pendingJoins: [],
        pendingLeaves: [],
    };
}
/**
 * Lifts payouts from the completed HandState and applies them to the corresponding seat stacks.
 * Guard Clause: If currentHandState is null, this is a no-op.
 */
export function applyHandPayouts(state) {
    if (!state.currentHandState) {
        return state;
    }
    const hand = state.currentHandState;
    if (hand.currentRound !== "Showdown" && hand.currentRound !== "Ended") {
        return state;
    }
    const payoutResult = distributePayouts(hand.pots, hand.players, hand.communityCards, hand.config.dealerIndex);
    const updatedSeats = state.seats.map(seat => {
        if (seat.playerId === null)
            return seat;
        const handPlayer = hand.players.find(p => p.id === seat.playerId);
        if (!handPlayer) {
            return seat;
        }
        const payout = payoutResult.payouts.find(p => p.playerId === seat.playerId);
        const payoutAmount = payout ? payout.amount : 0;
        return {
            ...seat,
            stack: handPlayer.stack + payoutAmount,
        };
    });
    return {
        ...state,
        seats: updatedSeats,
    };
}
/**
 * Evicts players with stack === 0 by transitioning their seat status to "empty".
 */
export function evictBustedPlayers(state) {
    const updatedSeats = state.seats.map(seat => {
        if (seat.status === "occupied" && seat.stack === 0) {
            return {
                ...seat,
                playerId: null,
                name: null,
                stack: 0,
                status: "empty",
                mustWaitForBB: false,
            };
        }
        return seat;
    });
    return {
        ...state,
        seats: updatedSeats,
    };
}
/**
 * Processes pending leaves first, then pending joins.
 * Newly joined players are seated with mustWaitForBB = true.
 */
export function flushPendingActions(state) {
    let seats = [...state.seats];
    // 1. Process leaves
    for (const leaveId of state.pendingLeaves) {
        seats = seats.map(seat => {
            if (seat.playerId === leaveId) {
                return {
                    ...seat,
                    playerId: null,
                    name: null,
                    stack: 0,
                    status: "empty",
                    mustWaitForBB: false,
                };
            }
            return seat;
        });
    }
    // 2. Process joins
    for (const join of state.pendingJoins) {
        const seat = seats[join.seatIndex];
        if (seat && seat.status === "empty") {
            seats[join.seatIndex] = {
                index: join.seatIndex,
                playerId: join.playerId,
                name: join.name,
                stack: join.buyIn,
                status: "occupied",
                mustWaitForBB: true,
            };
        }
    }
    return {
        ...state,
        seats,
        pendingJoins: [],
        pendingLeaves: [],
    };
}
/**
 * Advances the dealer button by exactly one seat index clockwise unconditionally (Dead Button rule).
 */
export function rotateDealerButton(state) {
    const M = state.config.maxSeats;
    const nextDealerIdx = (state.dealerIndex + 1) % M;
    return {
        ...state,
        dealerIndex: nextDealerIdx,
    };
}
/**
 * Helper to compute clockwise distance from start index to target index modulo M.
 */
function getClockwiseDistance(start, target, M) {
    return (target - start + M) % M;
}
/**
 * Assigns blinds, clears mustWaitForBB for passed players, and starts a new HandState.
 */
export function assignBlindsAndStart(state, deck, overridePrevBBSeatIdx) {
    const M = state.config.maxSeats;
    // Find all occupied seats with stack > 0
    const occupiedSeats = state.seats.filter(s => s.status === "occupied" && s.stack > 0);
    if (occupiedSeats.length < 2) {
        return {
            ...state,
            currentHandState: null,
        };
    }
    let prevBBSeatIdx = -1;
    if (overridePrevBBSeatIdx !== undefined) {
        prevBBSeatIdx = overridePrevBBSeatIdx;
    }
    else if (state.currentHandState) {
        const hand = state.currentHandState;
        const N_prev = hand.players.length;
        let bbIdx_prev = 0;
        if (N_prev === 2) {
            bbIdx_prev = (hand.config.dealerIndex + 1) % 2;
        }
        else {
            bbIdx_prev = (hand.config.dealerIndex + 2) % N_prev;
        }
        const prevBBPlayerId = hand.players[bbIdx_prev]?.id;
        if (prevBBPlayerId) {
            const seat = state.seats.find(s => s.playerId === prevBBPlayerId);
            if (seat) {
                prevBBSeatIdx = seat.index;
            }
        }
    }
    let updatedSeats = [...state.seats];
    let newBBSeatIdx = -1;
    if (prevBBSeatIdx !== -1) {
        // Determine the next BB seat index (next occupied seat clockwise from prev BB)
        for (let i = 1; i <= M; i++) {
            const idx = (prevBBSeatIdx + i) % M;
            if (occupiedSeats.some(s => s.index === idx)) {
                newBBSeatIdx = idx;
                break;
            }
        }
        // Clear mustWaitForBB using modular arithmetic
        updatedSeats = state.seats.map(seat => {
            if (seat.status === "occupied" && seat.stack > 0 && seat.mustWaitForBB) {
                const x = seat.index;
                const d_x = getClockwiseDistance(prevBBSeatIdx, x, M);
                const d_bb = getClockwiseDistance(prevBBSeatIdx, newBBSeatIdx, M);
                if (d_x > 0 && d_x <= d_bb) {
                    return {
                        ...seat,
                        mustWaitForBB: false,
                    };
                }
            }
            return seat;
        });
    }
    else {
        // Table was idle / first hand: clear mustWaitForBB for all occupied seats with stack > 0
        updatedSeats = state.seats.map(seat => {
            if (seat.status === "occupied" && seat.stack > 0) {
                return {
                    ...seat,
                    mustWaitForBB: false,
                };
            }
            return seat;
        });
    }
    // Recalculate eligible seats participating in the new hand
    const activeSeats = updatedSeats.filter(s => s.status === "occupied" && s.stack > 0 && !s.mustWaitForBB);
    if (activeSeats.length < 2) {
        return {
            ...state,
            seats: updatedSeats,
            currentHandState: null,
        };
    }
    // Find the dealer seat in activeSeats that minimizes distance clockwise to state.dealerIndex
    let dealerSeat = activeSeats[0];
    let minDistance = getClockwiseDistance(dealerSeat.index, state.dealerIndex, M);
    for (const seat of activeSeats) {
        const dist = getClockwiseDistance(seat.index, state.dealerIndex, M);
        if (dist < minDistance) {
            minDistance = dist;
            dealerSeat = seat;
        }
    }
    // Sort active seats clockwise starting from index 0
    const sortedActiveSeats = [...activeSeats].sort((a, b) => a.index - b.index);
    // Map to SeatConfig structure for startHand
    const handSeatsConfig = sortedActiveSeats.map(s => ({
        id: s.playerId,
        name: s.name,
        stack: s.stack,
    }));
    // Find the index of the dealer seat in the sorted handSeatsConfig list
    const handDealerIndex = sortedActiveSeats.findIndex(s => s.index === dealerSeat.index);
    const handConfig = {
        smallBlind: state.config.smallBlind,
        bigBlind: state.config.bigBlind,
        dealerIndex: handDealerIndex,
    };
    const currentHandState = startHand(handConfig, handSeatsConfig, deck);
    return {
        ...state,
        seats: updatedSeats,
        currentHandState,
        handCount: state.handCount + 1,
    };
}
/**
 * Pure state reducer for Table Orchestration.
 */
export function tableReducer(state, action) {
    switch (action.type) {
        case "joinTable": {
            // Check if seat index is valid and empty
            const seat = state.seats[action.seatIndex];
            if (!seat || seat.status !== "empty") {
                return state;
            }
            // Check if playerId already seated and not scheduled to leave
            const isSeated = state.seats.some(s => s.playerId === action.playerId && !state.pendingLeaves.includes(action.playerId));
            if (isSeated || state.pendingJoins.some(j => j.playerId === action.playerId)) {
                return state;
            }
            if (state.currentHandState !== null) {
                // Queue join mid-hand
                const pendingJoins = [...state.pendingJoins, {
                        playerId: action.playerId,
                        name: action.name,
                        buyIn: action.buyIn,
                        seatIndex: action.seatIndex,
                    }];
                return { ...state, pendingJoins };
            }
            else {
                // Seat immediately
                const seats = state.seats.map(s => {
                    if (s.index === action.seatIndex) {
                        return {
                            index: s.index,
                            playerId: action.playerId,
                            name: action.name,
                            stack: action.buyIn,
                            status: "occupied",
                            mustWaitForBB: false, // Starts immediately since table is idle
                        };
                    }
                    return s;
                });
                return { ...state, seats };
            }
        }
        case "leaveTable": {
            const isSeated = state.seats.some(s => s.playerId === action.playerId);
            const isPendingJoin = state.pendingJoins.some(j => j.playerId === action.playerId);
            if (!isSeated && !isPendingJoin) {
                return state;
            }
            if (state.currentHandState !== null) {
                // Queue leave mid-hand
                // If they have a pending join, we can just remove them from pendingJoins
                if (isPendingJoin) {
                    return {
                        ...state,
                        pendingJoins: state.pendingJoins.filter(j => j.playerId !== action.playerId),
                    };
                }
                // If they are seated, queue leave
                if (!state.pendingLeaves.includes(action.playerId)) {
                    return {
                        ...state,
                        pendingLeaves: [...state.pendingLeaves, action.playerId],
                    };
                }
                return state;
            }
            else {
                // Apply immediately
                if (isPendingJoin) {
                    return {
                        ...state,
                        pendingJoins: state.pendingJoins.filter(j => j.playerId !== action.playerId),
                    };
                }
                const seats = state.seats.map(s => {
                    if (s.playerId === action.playerId) {
                        return {
                            ...s,
                            playerId: null,
                            name: null,
                            stack: 0,
                            status: "empty",
                            mustWaitForBB: false,
                        };
                    }
                    return s;
                });
                return { ...state, seats };
            }
        }
        case "sitOut": {
            const seats = state.seats.map(s => {
                if (s.playerId === action.playerId && s.status === "occupied") {
                    return {
                        ...s,
                        status: "sitting-out",
                    };
                }
                return s;
            });
            return { ...state, seats };
        }
        case "sitIn": {
            const seats = state.seats.map(s => {
                if (s.playerId === action.playerId && s.status === "sitting-out") {
                    return {
                        ...s,
                        status: "occupied",
                        mustWaitForBB: true, // Sitting back in requires waiting for Big Blind
                    };
                }
                return s;
            });
            return { ...state, seats };
        }
        case "addChips": {
            const seats = state.seats.map(s => {
                if (s.playerId === action.playerId) {
                    return {
                        ...s,
                        stack: s.stack + action.amount,
                    };
                }
                return s;
            });
            return { ...state, seats };
        }
        case "startNextHand": {
            // Find the previous BB seat index from the CURRENT table state (before evictions/leaves)
            let prevBBSeatIdx = undefined;
            if (state.currentHandState) {
                const hand = state.currentHandState;
                const N_prev = hand.players.length;
                let bbIdx_prev = 0;
                if (N_prev === 2) {
                    bbIdx_prev = (hand.config.dealerIndex + 1) % 2;
                }
                else {
                    bbIdx_prev = (hand.config.dealerIndex + 2) % N_prev;
                }
                const prevBBPlayerId = hand.players[bbIdx_prev]?.id;
                if (prevBBPlayerId) {
                    const seat = state.seats.find(s => s.playerId === prevBBPlayerId);
                    if (seat) {
                        prevBBSeatIdx = seat.index;
                    }
                }
            }
            let nextState = applyHandPayouts(state);
            nextState = evictBustedPlayers(nextState);
            nextState = flushPendingActions(nextState);
            if (state.handCount > 0) {
                nextState = rotateDealerButton(nextState);
            }
            return assignBlindsAndStart(nextState, action.deck, prevBBSeatIdx);
        }
        case "timeout": {
            if (!state.currentHandState) {
                return state;
            }
            const hand = state.currentHandState;
            const currentActor = hand.players[hand.actorIndex];
            if (!currentActor || currentActor.id !== action.playerId) {
                // Stale timeout protection
                return state;
            }
            // Convert timeout to check (if possible) or fold
            const isCheckPossible = currentActor.currentRoundBet === hand.currentBet;
            const handAction = isCheckPossible
                ? { type: "check", playerId: action.playerId }
                : { type: "fold", playerId: action.playerId };
            const res = transition(hand, handAction);
            if (!res.ok) {
                return state;
            }
            return {
                ...state,
                currentHandState: res.value,
            };
        }
        case "dispatchHandAction": {
            if (!state.currentHandState) {
                return state;
            }
            const res = transition(state.currentHandState, action.action);
            if (!res.ok) {
                return state; // Action validation error
            }
            return {
                ...state,
                currentHandState: res.value,
            };
        }
    }
}
