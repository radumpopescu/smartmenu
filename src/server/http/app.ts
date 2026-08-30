import { Hono } from "hono";
import type { Ctx } from "@/server/context";
import { createContext, resolveActor } from "@/server/context";
import { db } from "@/db";
import { AppError, ErrorCode, toAppError } from "@/server/errors";
import { productRoutes } from "@/server/http/routes/products";
import { categoryRoutes } from "@/server/http/routes/categories";
import { storeRoutes } from "@/server/http/routes/stores";
import { userRoutes } from "@/server/http/routes/users";
import { menuRoutes } from "@/server/http/routes/menu";
import { miscRoutes } from "@/server/http/routes/misc";

export type Env = { Variables: { ctx: Ctx } };

export function createApp() {
  const app = new Hono<Env>().basePath("/api");

  /**
   * Request-scoped context: db client + resolved actor.
   *
   * This mirrors what `withServices()` builds for the in-process path, so
   * both entry points hand the service layer the same thing.
   */
  app.use("*", async (c, next) => {
    const actor = await resolveActor(db);
    c.set("ctx", createContext(actor, db));
    await next();
  });

  /**
   * One error shape for every failure. Routes and services throw; nothing
   * hand-rolls a response body.
   */
  app.onError((err, c) => {
    const appError = toAppError(err);
    if (appError.code === ErrorCode.INTERNAL) {
      console.error("[api] unhandled", err);
    }
    return c.json(appError.toEnvelope(), appError.status as 400);
  });

  app.notFound((c) =>
    c.json(new AppError(ErrorCode.NOT_FOUND, "No such endpoint").toEnvelope(), 404)
  );

  app.route("/", productRoutes);
  app.route("/", categoryRoutes);
  app.route("/", storeRoutes);
  app.route("/", userRoutes);
  app.route("/", menuRoutes);
  app.route("/", miscRoutes);

  return app;
}
