/**
 * Structured logger using pino
 */
import pino from "pino";

const level = (process.env["LOG_LEVEL"] ?? "info").toLowerCase();

export const logger = pino({
  level,
  transport:
    process.env["NODE_ENV"] !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  base: { service: "metawrangler-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never log these keys — security guard
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
});
