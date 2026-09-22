/**
 * Tests for the auth middleware.
 * Uses Hono's test utilities to construct fake request contexts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../auth.js";

// Silence logger output during tests
vi.mock("../logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function buildApp() {
  const app = new Hono();
  app.use("*", authMiddleware);
  app.get("/test", (c) => {
    const user = c.get("user");
    return c.json({ uid: user.uid, email: user.email });
  });
  return app;
}

async function request(
  app: Hono,
  headers: Record<string, string> = {}
): Promise<Response> {
  return app.request("/test", { headers });
}

describe("authMiddleware", () => {
  let app: Hono;

  beforeEach(() => {
    app = buildApp();
  });

  it("returns 401 when both auth headers are missing", async () => {
    const res = await request(app);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when only uid header is present", async () => {
    const res = await request(app, { "x-authentik-uid": "user-123" });
    expect(res.status).toBe(401);
  });

  it("returns 401 when only email header is present", async () => {
    const res = await request(app, { "x-authentik-email": "user@example.com" });
    expect(res.status).toBe(401);
  });

  it("passes through and sets user when both headers are present", async () => {
    const res = await request(app, {
      "x-authentik-uid": "user-123",
      "x-authentik-email": "user@example.com",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { uid: string; email: string };
    expect(body.uid).toBe("user-123");
    expect(body.email).toBe("user@example.com");
  });

  it("does not expose error details beyond 'Unauthorized'", async () => {
    const res = await request(app);
    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["error"]);
    expect(body["error"]).toBe("Unauthorized");
  });

  it("sets Content-Type: application/json on 401 response", async () => {
    const res = await request(app);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("accepts headers with mixed case (header lookup is case-insensitive)", async () => {
    // HTTP headers are case-insensitive per spec; Hono normalises them
    const res = await request(app, {
      "X-Authentik-UID": "user-456",
      "X-Authentik-Email": "other@example.com",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { uid: string; email: string };
    expect(body.uid).toBe("user-456");
  });
});
