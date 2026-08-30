import { Hono } from "hono";
import type { Env } from "@/server/http/app";
import { requireScopeMw, parseJson } from "@/server/http/middleware";
import { CategoryController } from "@/server/controllers/category-controller";
import {
  categoryCreateSchema,
  categoryReorderSchema,
  categoryUpdateSchema,
} from "@/shared/schemas";

export const categoryRoutes = new Hono<Env>();

const ctl = (c: { get: (k: "ctx") => Parameters<typeof CategoryController.make>[0] }) =>
  CategoryController.make(c.get("ctx"));

categoryRoutes.use("/categories", requireScopeMw("products.read"));
categoryRoutes.use("/categories/*", requireScopeMw("products.read"));

categoryRoutes.get("/categories", async (c) => c.json(await ctl(c).list()));

categoryRoutes.post("/categories", async (c) =>
  c.json(await ctl(c).create(await parseJson(c, categoryCreateSchema)))
);

categoryRoutes.patch("/categories", async (c) =>
  c.json(await ctl(c).reorder(await parseJson(c, categoryReorderSchema)))
);

categoryRoutes.patch("/categories/:id", async (c) =>
  c.json(
    await ctl(c).rename(c.req.param("id"), await parseJson(c, categoryUpdateSchema))
  )
);

categoryRoutes.delete("/categories/:id", async (c) =>
  c.json(await ctl(c).remove(c.req.param("id")))
);
