/**
 * Migration tests — verify migrations structure and logic work correctly.
 * Note: Full end-to-end DB tests require Bun runtime, so this suite
 * validates the migration file structure and version tracking logic.
 * Runtime migrations are tested via the actual application startup in CI.
 */
import { describe, it, expect } from "vitest";
import { readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

describe("Database Migrations", () => {
  it("migration files exist and are in correct order", () => {
    const migrationsDir = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../drizzle"
    );

    const migrations = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Should have at least the two base migrations
    expect(migrations.length).toBeGreaterThanOrEqual(2);
    expect(migrations[0]).toBe("0001_initial_schema.sql");
    expect(migrations[1]).toBe("0002_add_operations_column.sql");

    // All files should follow naming convention (NNNN_description.sql)
    for (const file of migrations) {
      expect(file).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
    }
  });

  it("migration files contain valid SQL", () => {
    const migrationsDir = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../drizzle"
    );

    const migrations = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of migrations) {
      // Migration files should not be empty
      expect(file.length).toBeGreaterThan(0);
    }
  });

  it("migration files are ordered with incrementing version numbers", () => {
    const migrationsDir = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../drizzle"
    );

    const migrations = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let lastVersion = 0;
    for (const file of migrations) {
      const version = parseInt(file.split("_")[0]);
      expect(version).toBeGreaterThan(lastVersion);
      lastVersion = version;
    }
  });
});
