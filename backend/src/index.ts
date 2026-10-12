/**
 * MetaWrangler backend — entry point
 * Hono + Bun native HTTP server
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger as honoLogger } from "hono/logger";
import { runMigrations } from "./db/index.js";
import { checkToolchain } from "./services/scanner.js";
import { reconcileInterruptedJobs } from "./services/jobRunner.js";
import { authMiddleware, assertAdminGroupConfigured } from "./lib/auth.js";
import { logger } from "./lib/logger.js";
import { mountsRouter } from "./routes/mounts.js";
import { scanRouter } from "./routes/scan.js";
import { jobsRouter } from "./routes/jobs.js";
import { auditRouter } from "./routes/audit.js";
import { adminRouter } from "./routes/admin.js";
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

// Mount administration must be gated behind an explicit admin group (SEC-03)
// — refuse to start rather than silently running with no admin concept.
try {
  assertAdminGroupConfigured();
} catch (err) {
  logger.fatal({ err }, "Admin group not configured — cannot start");
  process.exit(1);
}

// Jobs run as fire-and-forget in-process promises with no worker/lease model
// (see jobRunner.ts), so any job still "pending"/"running" from before this
// process last stopped has nothing left that will ever finish it. Fail them
// explicitly now rather than leaving them stuck forever with an unknown
// on-disk file state and a frontend polling indefinitely.
try {
  reconcileInterruptedJobs();
} catch (err) {
  logger.error({ err }, "Startup job reconciliation failed — continuing anyway");
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

// WebSocket upgrades also require valid Authentik headers — the proxy forwards
// the same headers on the upgrade request, but we must not rely on that alone
// (comments claiming the proxy "already handles this" are not enforcement).
app.use("/ws/*", authMiddleware);
app.route("/ws", wsRouter);

// API routes
app.route("/api/mounts", mountsRouter);
app.route("/api/scan", scanRouter);
app.route("/api/jobs", jobsRouter);
app.route("/api/audit", auditRouter);
app.route("/api/admin", adminRouter);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Global error handler — never expose internal details to the client
app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, "Unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});

// ── Start server ──────────────────────────────────────────────────────────────

// Bind to 0.0.0.0 so other containers on the Docker internal network can reach
// this service. External exposure is prevented by the compose network config —
// the backend is on the internal network only, never on the proxy network.
Bun.serve({
  fetch: app.fetch,
  port: PORT,
  hostname: "0.0.0.0",
  websocket: {
    // Bun requires a websocket handler at the top-level server for upgradeWebSocket to work.
    // The actual handlers are registered per-route in ws.ts via hono/bun upgradeWebSocket.
    message() {},
  },
});

logger.info({ port: PORT }, "MetaWrangler backend started");
