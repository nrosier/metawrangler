/**
 * Auth middleware — reads Authentik forward-auth headers injected by Caddy.
 * If the headers are absent the request was not proxied through Authentik; reject it.
 */
import type { Context, Next } from "hono";
import { logger } from "./logger.js";

const HEADER_UID =
  (process.env["AUTHENTIK_HEADER_UID"] ?? "x-authentik-uid").toLowerCase();
const HEADER_EMAIL =
  (process.env["AUTHENTIK_HEADER_EMAIL"] ?? "x-authentik-email").toLowerCase();

export interface AuthUser {
  uid: string;
  email: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
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

  c.set("user", { uid, email });
  await next();
}
