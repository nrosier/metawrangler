/**
 * Database connection and migrations bootstrap
 * Uses Bun's built-in SQLite (bun:sqlite) — no native compilation required.
 *
 * Migrations are versioned SQL files in the ./drizzle/ directory.
 * The database tracks applied versions in a schema_migrations table.
 * New migrations are run in order, then marked as applied.
 */
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";
import { mkdirSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { logger } from "../lib/logger.js";
import { fileURLToPath } from "url";

const DATA_DIR = process.env["DATA_DIR"] ?? "/app/data";
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "metawrangler.db");

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");
sqlite.exec("PRAGMA busy_timeout = 5000;");

export const db = drizzle(sqlite, { schema });

// ── Versioned migrations with tracking ────────────────────────────────────
export function runMigrations(): void {
  logger.info({ db: DB_PATH }, "Running database migrations");

  // Create schema_migrations table if it doesn't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get list of applied migrations
  const appliedRows = sqlite
    .query("SELECT version FROM schema_migrations ORDER BY version ASC")
    .all() as Array<{ version: string }>;
  const applied = new Set(appliedRows.map((row) => row.version));

  // Find and run unapplied migrations
  const migrationsDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../drizzle"
  );

  // Ensure migrations directory exists
  if (!readdirSync(migrationsDir, { withFileTypes: true }).length) {
    logger.warn(
      { dir: migrationsDir },
      "No migrations found — assuming fresh setup"
    );
  }

  const migrations = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const filename of migrations) {
    const version = filename.replace(/\.sql$/, "");
    if (applied.has(version)) {
      logger.debug({ version }, "Migration already applied");
      continue;
    }

    const migrationPath = path.join(migrationsDir, filename);
    const sql = readFileSync(migrationPath, "utf8");

    logger.info({ version, file: filename }, "Applying migration");

    try {
      // For migrations with conditional steps (like ALTER TABLE IF NOT EXISTS),
      // split on semicolons and execute each statement individually to handle errors
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        try {
          sqlite.exec(statement);
        } catch (err) {
          // Idempotent migrations may have safe failures (e.g., column already exists)
          // Log but don't fail on "column already exists" or similar
          if (
            err instanceof Error &&
            (err.message.includes("already exists") ||
              err.message.includes("duplicate"))
          ) {
            logger.debug(
              { version, error: err.message },
              "Idempotent operation skipped"
            );
          } else {
            throw err;
          }
        }
      }

      // Mark migration as applied
      sqlite.exec(
        `INSERT INTO schema_migrations (version) VALUES ('${version}')`
      );
      logger.info({ version }, "Migration applied successfully");
    } catch (err) {
      logger.error(
        { version, err, file: filename },
        "Migration failed — cannot start"
      );
      process.exit(1);
    }
  }

  logger.info({ applied: applied.size + migrations.length }, "Migrations complete");
}
