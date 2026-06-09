import { bestHand } from "../evaluation/bestHand.js";
import { compareMany } from "../evaluation/compareMany.js";
/**
 * Checks if two player ID lists contain the exact same elements (order-independent).
 */
function haveSameElements(arr1, arr2) {
    if (arr1.length !== arr2.length)
        return false;
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    return sorted1.every((val, index) => val === sorted2[index]);
}
/**
 * Dynamically calculates the main and side pots based on players' total commitments.
 * Folded players (including folded all-in players) are excluded from pot eligibility.
 */
export function calculatePots(players) {
    // Get all unique non-zero totalHandBet values, sorted ascending
    const bets = Array.from(new Set(players.map(p => p.totalHandBet)))
        .filter(b => b > 0)
        .sort((a, b) => a - b);
    const pots = [];
    let previousTier = 0;
    for (const tier of bets) {
        const tierContribution = tier - previousTier;
        let potAmount = 0;
        const eligiblePlayerIds = [];
        for (const player of players) {
            if (player.totalHandBet >= tier) {
                potAmount += tierContribution;
                if (player.status !== "folded") {
                    eligiblePlayerIds.push(player.id);
                }
            }
            else if (player.totalHandBet > previousTier) {
                // Player is all-in/committed at an intermediate amount between previousTier and tier
                potAmount += (player.totalHandBet - previousTier);
                if (player.status !== "folded") {
                    eligiblePlayerIds.push(player.id);
                }
            }
        }
        if (potAmount > 0 && eligiblePlayerIds.length > 0) {
            pots.push({
                amount: potAmount,
                eligiblePlayerIds,
            });
        }
        previousTier = tier;
    }
    // Merge pots with identical eligible player sets
    const mergedPots = [];
    for (const pot of pots) {
        const existing = mergedPots.find(p => haveSameElements(p.eligiblePlayerIds, pot.eligiblePlayerIds));
        if (existing) {
            const idx = mergedPots.indexOf(existing);
            mergedPots[idx] = {
                amount: existing.amount + pot.amount,
                eligiblePlayerIds: existing.eligiblePlayerIds,
            };
        }
        else {
            mergedPots.push(pot);
        }
    }
    return mergedPots;
}
/**
 * Evaluates hands at showdown and distributes all pots to the winners.
 * Handles split pots and odd-chip distribution (gives odd chips to winning players
 * closest to the left of the button dealerIndex).
 */
export function distributePayouts(pots, players, communityCards, dealerIndex) {
    const payoutsMap = {};
    // Initialize payouts for all players to 0
    for (const player of players) {
        payoutsMap[player.id] = 0;
    }
    const N = players.length;
    // Lazy best hand evaluator to avoid calling bestHand when not needed (e.g. uncontested pots)
    const bestHandsMap = {};
    const getBestHand = (id) => {
        if (!bestHandsMap[id]) {
            const player = players.find(p => p.id === id);
            const combinedCards = [...player.cards, ...communityCards];
            bestHandsMap[id] = bestHand(combinedCards);
        }
        return bestHandsMap[id];
    };
    for (const pot of pots) {
        const eligibleActiveIds = pot.eligiblePlayerIds.filter(id => {
            const player = players.find(p => p.id === id);
            return player && player.status !== "folded";
        });
        if (eligibleActiveIds.length === 0) {
            // In the rare event that all players eligible for this pot have folded,
            // distribute it to the remaining non-folded players at the table, or refund.
            // Under standard rules, this shouldn't happen because if everyone folded, the hand would have ended.
            // But as a fallback, award to any non-folded players.
            const activePlayers = players.filter(p => p.status !== "folded");
            if (activePlayers.length > 0) {
                const share = Math.floor(pot.amount / activePlayers.length);
                const remainder = pot.amount % activePlayers.length;
                const sortedActive = [...activePlayers].sort((a, b) => {
                    const idxA = players.findIndex(p => p.id === a.id);
                    const idxB = players.findIndex(p => p.id === b.id);
                    const distA = (idxA - dealerIndex - 1 + N) % N;
                    const distB = (idxB - dealerIndex - 1 + N) % N;
                    return distA - distB;
                });
                for (let i = 0; i < sortedActive.length; i++) {
                    const p = sortedActive[i];
                    payoutsMap[p.id] = (payoutsMap[p.id] || 0) + share + (i < remainder ? 1 : 0);
                }
            }
            continue;
        }
        if (eligibleActiveIds.length === 1) {
            const winnerId = eligibleActiveIds[0];
            payoutsMap[winnerId] = (payoutsMap[winnerId] || 0) + pot.amount;
            continue;
        }
        // Evaluate hands for eligible active players
        const potHands = eligibleActiveIds.map(id => ({
            playerId: id,
            bestHand: getBestHand(id),
        }));
        // Find winners for this pot
        const { winners } = compareMany(potHands);
        // Distribute pot among winners
        const share = Math.floor(pot.amount / winners.length);
        const remainder = pot.amount % winners.length;
        // Sort winners closest to the left of the button (clockwise)
        const sortedWinners = [...winners].sort((a, b) => {
            const idxA = players.findIndex(p => p.id === a);
            const idxB = players.findIndex(p => p.id === b);
            const distA = (idxA - dealerIndex - 1 + N) % N;
            const distB = (idxB - dealerIndex - 1 + N) % N;
            return distA - distB;
        });
        for (let i = 0; i < sortedWinners.length; i++) {
            const winnerId = sortedWinners[i];
            payoutsMap[winnerId] = (payoutsMap[winnerId] || 0) + share + (i < remainder ? 1 : 0);
        }
    }
    const payouts = Object.entries(payoutsMap).map(([playerId, amount]) => ({
        playerId,
        amount,
    }));
    return { payouts };
}
