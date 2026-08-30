import { Hono } from "hono";
import type { Env } from "@/server/http/app";
import { requireScopeMw, parseJson } from "@/server/http/middleware";
import { MenuImportController } from "@/server/controllers/menu-import-controller";
import { importApplySchema } from "@/shared/schemas";

export const menuRoutes = new Hono<Env>();

const ctl = (c: { get: (k: "ctx") => Parameters<typeof MenuImportController.make>[0] }) =>
  MenuImportController.make(c.get("ctx"));

menuRoutes.use("/menu/*", requireScopeMw("menu.import"));

menuRoutes.post("/menu/import", async (c) => {
  const form = await c.req.formData();
  const image = form.get("image");
  const file = image instanceof File && image.size > 0 ? image : null;
  return c.json(await ctl(c).extract(file));
});

menuRoutes.post("/menu/import/apply", async (c) =>
  c.json(await ctl(c).apply(await parseJson(c, importApplySchema)))
);
