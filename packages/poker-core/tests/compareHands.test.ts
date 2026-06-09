import { describe, it, expect } from "vitest";
import { parseCard } from "../src/utils/cardUtils.js";
import { bestHand } from "../src/evaluation/bestHand.js";
import { compareHands } from "../src/evaluation/compareHands.js";
import { HandRank } from "../src/types/HandRank.js";

const parseHand = (strings: string[]) => strings.map(parseCard);

describe("compareHands", () => {
  it("should determine a clear winner with different HandRanks", () => {
    // Player A has a Full House: As, Ah, Ac, Ks, Kh (Aces full of Kings)
    const cardsA = parseHand(["As", "Ah", "Ac", "Ks", "Kh", "2c", "3d"]);
    const handA = bestHand(cardsA);

    // Player B has a Flush: As, Qs, Ts, 5s, 2s, Kh, Qd
    const cardsB = parseHand(["As", "Qs", "Ts", "5s", "2s", "Kh", "Qd"]);
    const handB = bestHand(cardsB);

    // Full House (6) > Flush (5). A should win.
    const res = compareHands(handA, handB);
    expect(res.result).toBe("win");
    if (res.result === "win") {
      expect(res.winner).toBe(handA);
    }
  });

  it("should determine winner via kicker tiebreaker with same HandRank", () => {
    // Player A has One Pair of Kings, Ace kicker: Kh, Kd, As, 7c, 3d
    const handA = bestHand(parseHand(["Kh", "Kd", "As", "7c", "3d", "2s", "2h"]));
    // Note: bestHand from these 7 cards will evaluate to Two Pair of Kings and Twos: Kh Kd 2s 2h As
    // Let's create a pure One Pair test case with exactly 5 cards using classify and score:
    // Actually, we can just feed exactly 5 cards to bestHand to construct the hands!
    const bestA = bestHand(parseHand(["Kh", "Kd", "As", "7c", "3d"]));
    const bestB = bestHand(parseHand(["Kh", "Kd", "Qs", "9c", "8d"]));

    // Both have One Pair of Kings. A has Ace kicker (14), B has Queen kicker (12). A wins.
    const res = compareHands(bestA, bestB);
    expect(res.result).toBe("win");
    if (res.result === "win") {
      expect(res.winner).toBe(bestA);
    }

    const resReverse = compareHands(bestB, bestA);
    expect(resReverse.result).toBe("loss");
    if (resReverse.result === "loss") {
      expect(resReverse.winner).toBe(bestA);
    }
  });

  it("should resolve true ties under equal board dominance", () => {
    // Board: As, Ks, Qs, Js, Ts
    // Player A hole: 2h, 3d (Best: As Ks Qs Js Ts, i.e. Royal Flush on board)
    const handA = bestHand(parseHand(["As", "Ks", "Qs", "Js", "Ts", "2h", "3d"]));

    // Player B hole: 2c, 3s (Best: As Ks Qs Js Ts, i.e. Royal Flush on board)
    const handB = bestHand(parseHand(["As", "Ks", "Qs", "Js", "Ts", "2c", "3s"]));

    // Both hands are identical Royal Flushes (Straight Flushes). Should tie.
    const res = compareHands(handA, handB);
    expect(res.result).toBe("tie");
    if (res.result === "tie") {
      expect(res.winners[0]).toBe(handA);
      expect(res.winners[1]).toBe(handB);
    }
  });
});
