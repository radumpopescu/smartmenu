/**
 * The whole HTTP API mounts here.
 *
 * `force-dynamic` because the app reaches for the session and cookies on
 * every request; there is no request context at build time, so prerendering
 * would abort. Applied uniformly rather than as a per-route judgment call.
 *
 * `/api/auth/*` is served by the more specific NextAuth catch-all route and
 * never reaches this handler.
 */
export const dynamic = "force-dynamic";

/**
 * Codex image generation runs locally through the Codex CLI and can take
 * several minutes. Without this the platform would cut the request off long
 * before the image comes back.
 */
export const maxDuration = 900;

import { createApp } from "@/server/http/app";

const app = createApp();

const handler = (request: Request) => app.fetch(request);

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
