import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Server } from "socket.io";
import {
  startPlayerTimer,
  clearTimer,
  handleDisconnect,
  handleReconnect,
  getPlayerTimeBank,
  setPlayerTimeBank,
} from "../src/services/timeoutManager.js";
import { processTableAction } from "../src/services/tableService.js";

// Mock redis and table services
const mockRedisStore = new Map<string, string>();
const mockRedisClient = {
  get: vi.fn().mockImplementation(async (key) => mockRedisStore.get(key) || null),
  set: vi.fn().mockImplementation(async (key, val) => {
    mockRedisStore.set(key, val);
  }),
};

vi.mock("../src/services/redisService.js", () => {
  return {
    getTableState: vi.fn().mockResolvedValue({ handActionSeq: 5, currentHandState: {} }),
    saveTableState: vi.fn(),
    get redisClient() {
      return mockRedisClient;
    }
  };
});

vi.mock("../src/services/tableService.js", () => {
  return {
    processTableAction: vi.fn().mockResolvedValue({ success: true, state: {} }),
  };
});

vi.mock("../src/sockets/socketHandlers.js", () => {
  return {
    broadcastTableState: vi.fn(),
  };
});

describe("Timeout Manager & Time Banks", () => {
  let mockIo: any;
  let emitMock: any;
  let inMock: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockRedisStore.clear();

    emitMock = vi.fn();
    inMock = vi.fn().mockReturnValue({ emit: emitMock });
    mockIo = {
      in: inMock,
    } as unknown as Server;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should tick standard countdown and emit timer_tick", async () => {
    await setPlayerTimeBank("1", "P0", 30);
    await startPlayerTimer(mockIo, "1", "P0");

    // Advance 1 second
    vi.advanceTimersByTime(1000);
    expect(inMock).toHaveBeenCalledWith("table:1");
    expect(emitMock).toHaveBeenCalledWith("timer_tick", {
      playerId: "P0",
      timeLeft: 14,
      timeBankLeft: 30,
      isTimeBank: false,
      isPaused: false,
      maxTimeLeft: 15,
    });

    clearTimer("1");
  });

  it("should pause the timer during the 5s disconnect grace period, then resume tick", async () => {
    await setPlayerTimeBank("1", "P0", 30);
    await startPlayerTimer(mockIo, "1", "P0");

    // Advance 1s -> timeLeft becomes 14
    vi.advanceTimersByTime(1000);

    // Player disconnects
    handleDisconnect(mockIo, "1", "P0");

    // Advance 1s -> timer is paused, graceTimeLeft is 4
    vi.advanceTimersByTime(1000);
    expect(emitMock).toHaveBeenLastCalledWith("timer_tick", {
      playerId: "P0",
      timeLeft: 14, // remains 14
      timeBankLeft: 30,
      isTimeBank: false,
      isPaused: true,
      graceTimeLeft: 4,
      maxTimeLeft: 15,
    });

    // Advance 4 more seconds -> grace period expires (graceTimeLeft reaches 0)
    // and countdown resumes in the same interval cycle (timeLeft becomes 13)
    vi.advanceTimersByTime(4000);
    expect(emitMock).toHaveBeenLastCalledWith("timer_tick", {
      playerId: "P0",
      timeLeft: 13,
      timeBankLeft: 30,
      isTimeBank: false,
      isPaused: false,
      maxTimeLeft: 15,
    });

    clearTimer("1");
  });

  it("should resume countdown immediately on reconnect during the grace period", async () => {
    await setPlayerTimeBank("1", "P0", 30);
    await startPlayerTimer(mockIo, "1", "P0");

    // Advance 1s -> timeLeft becomes 14
    vi.advanceTimersByTime(1000);

    // Disconnect
    handleDisconnect(mockIo, "1", "P0");
    vi.advanceTimersByTime(1000); // graceTimeLeft = 4

    // Reconnect
    handleReconnect(mockIo, "1", "P0");

    // Next tick should immediately resume standard countdown (timeLeft becomes 13)
    vi.advanceTimersByTime(1000);
    expect(emitMock).toHaveBeenLastCalledWith("timer_tick", {
      playerId: "P0",
      timeLeft: 13,
      timeBankLeft: 30,
      isTimeBank: false,
      isPaused: false,
      maxTimeLeft: 15,
    });

    clearTimer("1");
  });

  it("should deplete time bank when standard timer is finished, then dispatch timeout action", async () => {
    await setPlayerTimeBank("1", "P0", 2); // short time bank
    await startPlayerTimer(mockIo, "1", "P0");

    // Advance 15 seconds (standard timer finished)
    vi.advanceTimersByTime(15000);
    expect(emitMock).toHaveBeenCalledWith("timer_tick", {
      playerId: "P0",
      timeLeft: 0,
      timeBankLeft: 2,
      isTimeBank: false, // transition tick
      isPaused: false,
      maxTimeLeft: 15,
    });

    const flushPromises = () => new Promise(resolve => process.nextTick(resolve));

    // Advance 1 second -> consumes 1s of time bank
    vi.advanceTimersByTime(1000);
    await flushPromises();
    
    expect(emitMock).toHaveBeenLastCalledWith("timer_tick", {
      playerId: "P0",
      timeLeft: 0,
      timeBankLeft: 1,
      isTimeBank: true,
      isPaused: false,
      maxTimeLeft: 30,
    });

    // Advance 1 second -> consumes remaining time bank and triggers action
    vi.advanceTimersByTime(1000);
    await flushPromises();

    expect(emitMock).toHaveBeenLastCalledWith("timer_tick", {
      playerId: "P0",
      timeLeft: 0,
      timeBankLeft: 0,
      isTimeBank: true,
      isPaused: false,
      maxTimeLeft: 30,
    });

    // Wait for the asynchronous processTableAction to resolve
    await vi.runOnlyPendingTimersAsync();

    expect(processTableAction).toHaveBeenCalledWith("1", { type: "timeout", playerId: "P0" }, 5);

    clearTimer("1");
  });
});
