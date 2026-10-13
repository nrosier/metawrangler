/**
 * Build/version info. APP_VERSION, GIT_SHA and BUILD_TIME are baked in at image build time
 * (see backend/Dockerfile); "unknown" when running outside Docker.
 */
import pkg from "../../package.json" with { type: "json" };

export const VERSION_INFO = {
  version: process.env["APP_VERSION"] || pkg.version,
  commit: (process.env["GIT_SHA"] ?? "unknown").slice(0, 7),
  buildTime: process.env["BUILD_TIME"] ?? "unknown",
} as const;
