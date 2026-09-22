/**
 * MetaWrangler backend — entry point
 * Hono + Bun HTTP server
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger as honoLogger } from "hono/logger";
import { runMigrations } from "./db/index.js";
import { checkToolchain } from "./services/scanner.js";
import { authMiddleware } from "./lib/auth.js";
import { logger } from "./lib/logger.js";
import { mountsRouter } from "./routes/mounts.js";
import { scanRouter } from "./routes/scan.js";
import { jobsRouter } from "./routes/jobs.js";
import { auditRouter } from "./routes/audit.js";
import { wsRouter } from "./routes/ws.js";

const PORT = Number(process.env["PORT"] ?? 3001);
const ALLOWED_ORIGIN = process.env["ALLOWED_ORIGIN"] ?? "http://localhost:5173";

// ── Startup checks ────────────────────────────────────────────────────────────

try {
  runMigrations();
} catch (err) {
  logger.fatal({ err }, "Database migration failed — cannot start");
  process.exit(1);
}

try {
  await checkToolchain();
  logger.info("Toolchain check passed (mkvmerge, mkvpropedit, ffprobe)");
} catch (err) {
  logger.fatal({ err }, "Toolchain check failed — cannot start");
  process.exit(1);
}

// ── App setup ─────────────────────────────────────────────────────────────────

const app = new Hono();

// Security headers on all responses
app.use("*", secureHeaders());

// CORS — only allow the configured frontend origin
app.use(
  "/api/*",
  cors({
    origin: ALLOWED_ORIGIN,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

// Request logging (structured, excludes sensitive headers via pino redact)
app.use("*", honoLogger());

// Health check — no auth required (used by Docker healthcheck)
app.get("/health", (c) =>
  c.json({ status: "ok", ts: new Date().toISOString() })
);

// All API routes require valid Authentik headers
app.use("/api/*", authMiddleware);

// WebSocket — Caddy forward-auth validates before upgrade reaches us
app.route("/ws", wsRouter);

// API routes
app.route("/api/mounts", mountsRouter);
app.route("/api/scan", scanRouter);
app.route("/api/jobs", jobsRouter);
app.route("/api/audit", auditRouter);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Global error handler — never expose internal details to the client
app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, "Unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});

// ── Start server ──────────────────────────────────────────────────────────────

serve(
  { fetch: app.fetch, port: PORT, hostname: "127.0.0.1" },
  () => {
    logger.info({ port: PORT }, "MetaWrangler backend started");
  }
);
