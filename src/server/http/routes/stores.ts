import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { Env } from "@/server/http/app";
import { requireAuth, requireScopeMw, parseJson } from "@/server/http/middleware";
import { StoreController } from "@/server/controllers/store-controller";
import { ACTIVE_STORE_COOKIE } from "@/lib/store-cookie";
import {
  activeStoreSchema,
  storeCreateSchema,
  storeUpdateSchema,
} from "@/shared/schemas";

export const storeRoutes = new Hono<Env>();

const ctl = (c: { get: (k: "ctx") => Parameters<typeof StoreController.make>[0] }) =>
  StoreController.make(c.get("ctx"));

storeRoutes.use("/store", requireScopeMw("store.read"));
storeRoutes.use("/stores", requireAuth);
storeRoutes.use("/session/*", requireAuth);

storeRoutes.get("/store", async (c) => c.json(await ctl(c).active()));

storeRoutes.patch("/store", async (c) =>
  c.json(await ctl(c).updateActive(await parseJson(c, storeUpdateSchema)))
);

storeRoutes.get("/stores", async (c) => c.json(await ctl(c).listAll()));

storeRoutes.post("/stores", async (c) => {
  const store = await ctl(c).create(await parseJson(c, storeCreateSchema));
  return c.json(store, 201);
});

storeRoutes.post("/session/store", async (c) => {
  const input = await parseJson(c, activeStoreSchema);
  const result = await ctl(c).assertSwitchable(input.storeId);

  setCookie(c, ACTIVE_STORE_COOKIE, input.storeId, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return c.json(result);
});
