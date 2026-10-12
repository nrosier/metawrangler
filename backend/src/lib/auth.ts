/**
 * Auth middleware — reads Authentik forward-auth headers injected by the
 * reverse proxy. If the headers are absent the request was not proxied
 * through Authentik; reject it.
 *
 * NOTE on trust boundary (SEC-03): this still only checks header *presence*,
 * not that the headers were actually set by Authentik rather than forged by
 * whatever sent the request. That holds as long as nothing but the trusted
 * proxy can reach this service — true for the documented deployment (backend
 * is only on the `internal` Docker network, and Traefik's `authentik@file`
 * middleware overwrites these headers before forwarding), but it degrades to
 * no protection at all against another container on that same internal
 * network, or any proxy misconfiguration upstream. Fully closing that gap
 * means a backend-verifiable assertion (e.g. authentik's signed
 * `X-authentik-jwt`, verified against its outpost JWKS) rather than
 * presence-only headers — tracked separately as follow-up infra work, since
 * it depends on the operator's specific Authentik proxy-provider setup.
 *
 * What this module *does* enforce now: an admin/role concept gating
 * mutating mount routes, so that — independent of the header-forgery
 * question above — any authenticated-but-non-admin user can no longer
 * change mounts that affect every other user's edit boundary.
 */
import type { Context, MiddlewareHandler, Next } from "hono";
import { logger } from "./logger.js";

const HEADER_UID =
  (process.env["AUTHENTIK_HEADER_UID"] ?? "x-authentik-uid").toLowerCase();
const HEADER_EMAIL =
  (process.env["AUTHENTIK_HEADER_EMAIL"] ?? "x-authentik-email").toLowerCase();
const HEADER_GROUPS =
  (process.env["AUTHENTIK_HEADER_GROUPS"] ?? "x-authentik-groups").toLowerCase();

// The group whose members are treated as admins (allowed to add/edit/remove
// mounts). Deliberately has no default: a missing/empty value here must fail
// startup (see assertAdminGroupConfigured below) rather than silently fall
// back to "nobody is admin" (locks out every operator) or "everyone is admin"
// (exactly the vulnerability this is meant to close).
const ADMIN_GROUP = process.env["AUTHENTIK_ADMIN_GROUP"];

export interface AuthUser {
  uid: string;
  email: string;
  isAdmin: boolean;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

/**
 * Call during startup (before accepting requests) to fail fast if the admin
 * group isn't configured, instead of discovering it mid-incident. Mirrors
 * the other fail-on-missing-prerequisite checks in index.ts (migrations,
 * toolchain).
 */
export function assertAdminGroupConfigured(): void {
  if (!ADMIN_GROUP || ADMIN_GROUP.trim() === "") {
    throw new Error(
      "AUTHENTIK_ADMIN_GROUP is not set — refusing to start. Mount " +
        "administration must be gated behind an explicit admin group; set " +
        "AUTHENTIK_ADMIN_GROUP to the Authentik group name whose members " +
        "may manage mounts."
    );
  }
}

// Authentik's forward-auth group header format has varied across versions
// (pipe- and comma-delimited lists have both been observed in the wild) —
// split on either rather than assume one, and trim whitespace either way
// introduces.
function parseGroups(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[|,]/)
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
}

export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const uid = c.req.header(HEADER_UID);
  const email = c.req.header(HEADER_EMAIL);

  if (!uid || !email) {
    logger.warn(
      { path: c.req.path, method: c.req.method },
      "Request missing Authentik headers — rejecting"
    );
    c.res = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
    return;
  }

  const groups = parseGroups(c.req.header(HEADER_GROUPS));
  const isAdmin = ADMIN_GROUP !== undefined && groups.includes(ADMIN_GROUP);

  c.set("user", { uid, email, isAdmin });
  await next();
}

/** Gate a route to admin-only. Must run after authMiddleware has set `user`. */
// Typed as `MiddlewareHandler` (rather than a plain `(c: Context, next: Next)`
// function) so Hono can still infer path params (e.g. `:id`) in the route
// handlers that follow it — a bare `Context`-typed middleware in the chain
// otherwise widens those to `string | undefined` for every handler after it.
export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = c.get("user");
  if (!user.isAdmin) {
    logger.warn(
      { path: c.req.path, method: c.req.method, user: user.uid },
      "Non-admin user attempted an admin-only action — rejecting"
    );
    c.res = new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
    return;
  }
  await next();
};
