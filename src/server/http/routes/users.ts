import { Hono } from "hono";
import type { Env } from "@/server/http/app";
import { requireScopeMw, parseJson } from "@/server/http/middleware";
import { UserController } from "@/server/controllers/user-controller";
import { userCreateSchema, userStoresSchema } from "@/shared/schemas";

export const userRoutes = new Hono<Env>();

const ctl = (c: { get: (k: "ctx") => Parameters<typeof UserController.make>[0] }) =>
  UserController.make(c.get("ctx"));

userRoutes.use("/users", requireScopeMw("admin.users.write"));
userRoutes.use("/users/*", requireScopeMw("admin.users.write"));

userRoutes.get("/users", async (c) => c.json(await ctl(c).list()));

userRoutes.post("/users", async (c) => {
  const created = await ctl(c).create(await parseJson(c, userCreateSchema));
  return c.json(created, 201);
});

userRoutes.put("/users/:id/stores", async (c) =>
  c.json(
    await ctl(c).setStores(c.req.param("id"), await parseJson(c, userStoresSchema))
  )
);
