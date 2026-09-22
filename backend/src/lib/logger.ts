/**
 * Structured logger using pino
 */
import pino from "pino";

const level = (process.env["LOG_LEVEL"] ?? "info").toLowerCase();

const transport =
  process.env["NODE_ENV"] !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined;

export const logger = pino({
  level,
  ...(transport !== undefined ? { transport } : {}),
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
