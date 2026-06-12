import dotenv from "dotenv";

dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/poker",
  ACTION_TIMEOUT_SECONDS: parseInt(process.env.ACTION_TIMEOUT_SECONDS || "15", 10),
  TIME_BANK_DEFAULT_SECONDS: parseInt(process.env.TIME_BANK_DEFAULT_SECONDS || "30", 10),
  DISCONNECT_GRACE_PAUSE_SECONDS: parseInt(process.env.DISCONNECT_GRACE_PAUSE_SECONDS || "5", 10),
  AUTH_SECRET: process.env.AUTH_SECRET || "poker-server-secret-key-12345",
};
