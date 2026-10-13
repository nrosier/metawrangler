/**
 * Build/version info. GIT_SHA and BUILD_TIME are baked in at image build time
 * (see backend/Dockerfile); "unknown" when running outside Docker.
 */
import pkg from "../../package.json" with { type: "json" };

export const VERSION_INFO = {
  version: pkg.version,
  commit: (process.env["GIT_SHA"] ?? "unknown").slice(0, 7),
  buildTime: process.env["BUILD_TIME"] ?? "unknown",
} as const;
