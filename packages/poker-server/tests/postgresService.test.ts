import { describe, it, expect, vi, beforeEach } from "vitest";

// Set up pg mocks (use mockPrefix to avoid hoisting errors)
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockClient = {
  query: mockQuery,
  release: mockRelease,
};
const mockConnect = vi.fn().mockResolvedValue(mockClient);

vi.mock("pg", () => {
  return {
    default: {
      Pool: class MockPool {
        connect() {
          return mockConnect();
        }
      }
    }
  };
});

import {
  executeTransaction,
  getPlayerBalance,
  deductPlayerBalance,
  creditPlayerBalance,
} from "../src/services/postgresService.js";

describe("Postgres Database Transactions & Balances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete a transaction successfully and commit", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await executeTransaction(async (client) => {
      await client.query("SELECT 1");
      return "success";
    });

    expect(result).toBe("success");
    expect(mockQuery).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockQuery).toHaveBeenNthCalledWith(2, "SELECT 1");
    expect(mockQuery).toHaveBeenNthCalledWith(3, "COMMIT");
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("should roll back the transaction if any query throws an error", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
    mockQuery.mockRejectedValueOnce(new Error("Database write error")); // SELECT 1

    await expect(
      executeTransaction(async (client) => {
        await client.query("SELECT 1");
      })
    ).rejects.toThrow("Database write error");

    expect(mockQuery).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mockQuery).toHaveBeenNthCalledWith(2, "SELECT 1");
    expect(mockQuery).toHaveBeenNthCalledWith(3, "ROLLBACK");
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("should get player balance correctly", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: 5000 }] });

    const balance = await getPlayerBalance(mockClient as any, "P0");
    expect(balance).toBe(5000);
    expect(mockQuery).toHaveBeenCalledWith("SELECT balance FROM players WHERE id = $1", ["P0"]);
  });

  it("should deduct player balance if they have sufficient funds", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: 1000 }] }); // balance lookup
    mockQuery.mockResolvedValueOnce({ rows: [] }); // update balance

    await deductPlayerBalance(mockClient as any, "P0", 500);
    expect(mockQuery).toHaveBeenCalledWith("UPDATE players SET balance = balance - $1 WHERE id = $2", [500, "P0"]);
  });

  it("should throw an error and not update balance if funds are insufficient", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ balance: 100 }] }); // balance lookup

    await expect(
      deductPlayerBalance(mockClient as any, "P0", 500)
    ).rejects.toThrow("Insufficient balance in database");

    expect(mockQuery).not.toHaveBeenCalledWith("UPDATE players SET balance = balance - $1 WHERE id = $2", [500, "P0"]);
  });

  it("should credit player balances", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await creditPlayerBalance(mockClient as any, "P0", 1200);
    expect(mockQuery).toHaveBeenCalledWith("UPDATE players SET balance = balance + $1 WHERE id = $2", [1200, "P0"]);
  });
});
