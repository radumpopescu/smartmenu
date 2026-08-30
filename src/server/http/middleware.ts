import type { MiddlewareHandler } from "hono";
import type { Env } from "@/server/http/app";
import { AppError } from "@/server/errors";
import { hasScope, type Scope } from "@/server/actor";
import { validationFailed } from "@/server/errors";
import type { ZodType } from "zod";

/**
 * Route-level guards.
 *
 * Defense in depth and a clean 403 envelope — never the only enforcement.
 * The in-process path does not run these, so the authoritative check lives
 * in the service method (see `src/server/services/guard.ts`).
 */

export const requireAuth: MiddlewareHandler<Env> = async (c, next) => {
  if (c.get("ctx").var.actor.kind !== "user") throw AppError.unauthorized();
  await next();
};

export function requireScopeMw(scope: Scope): MiddlewareHandler<Env> {
  return async (c, next) => {
    const actor = c.get("ctx").var.actor;
    if (actor.kind !== "user") throw AppError.unauthorized();
    if (!hasScope(actor, scope)) {
      throw AppError.forbidden(`Missing required scope: ${scope}`);
    }
    await next();
  };
}

/** Parse a JSON body against a shared schema, or throw the standard envelope. */
export async function parseJson<T>(
  c: { req: { json: () => Promise<unknown> } },
  schema: ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw AppError.invalid("Request body must be valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw validationFailed(parsed.error);
  return parsed.data;
}
