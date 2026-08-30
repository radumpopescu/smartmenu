import { Hono } from "hono";
import type { Env } from "@/server/http/app";
import { requireScopeMw, parseJson } from "@/server/http/middleware";
import { ProductController } from "@/server/controllers/product-controller";
import { AppError, validationFailed } from "@/server/errors";
import {
  productCreateSchema,
  productReorderSchema,
  productUpdateSchema,
  enhanceSchema,
} from "@/shared/schemas";
import { PRODUCT_IMAGE_KINDS, type ProductImageKind } from "@/db/schema";

export const productRoutes = new Hono<Env>();

const ctl = (c: { get: (k: "ctx") => Parameters<typeof ProductController.make>[0] }) =>
  ProductController.make(c.get("ctx"));

productRoutes.use("/products/*", requireScopeMw("products.read"));
productRoutes.use("/products", requireScopeMw("products.read"));

productRoutes.get("/products", async (c) => c.json(await ctl(c).board()));

productRoutes.post("/products", async (c) => {
  const contentType = c.req.header("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData();
    const parsed = productCreateSchema.safeParse({
      name: String(form.get("name") ?? ""),
      description: form.get("description") ? String(form.get("description")) : null,
      categoryId: form.get("categoryId") ? String(form.get("categoryId")) : null,
      priceCents: form.get("priceCents") ? Number(form.get("priceCents")) : null,
    });
    if (!parsed.success) throw validationFailed(parsed.error);

    const image = form.get("image");
    const file = image instanceof File && image.size > 0 ? image : null;
    return c.json(await ctl(c).createWithImage(parsed.data, file));
  }

  const input = await parseJson(c, productCreateSchema);
  return c.json(await ctl(c).create(input));
});

/**
 * Declared before `/products/:id` — Hono matches in registration order, and
 * "reorder" would otherwise be read as a product id.
 */
productRoutes.patch("/products/reorder", async (c) => {
  const input = await parseJson(c, productReorderSchema);
  return c.json(await ctl(c).reorder(input));
});

productRoutes.get("/products/:id", async (c) =>
  c.json(await ctl(c).get(c.req.param("id")))
);

productRoutes.patch("/products/:id", async (c) => {
  const input = await parseJson(c, productUpdateSchema);
  return c.json(await ctl(c).update(c.req.param("id"), input));
});

productRoutes.delete("/products/:id", async (c) =>
  c.json(await ctl(c).remove(c.req.param("id")))
);

async function fileFrom(c: { req: { formData: () => Promise<FormData> } }) {
  const form = await c.req.formData();
  const image = form.get("image");
  return {
    file: image instanceof File && image.size > 0 ? image : null,
    kind: String(form.get("kind") ?? "original"),
  };
}

productRoutes.post("/products/:id/upload", async (c) => {
  const { file } = await fileFrom(c);
  return c.json(await ctl(c).addImage(c.req.param("id"), "original", file));
});

productRoutes.post("/products/:id/enhanced", async (c) => {
  const { file } = await fileFrom(c);
  return c.json(await ctl(c).addImage(c.req.param("id"), "enhanced", file));
});

productRoutes.get("/products/:id/images", async (c) =>
  c.json(await ctl(c).get(c.req.param("id")))
);

productRoutes.post("/products/:id/images", async (c) => {
  const { file, kind } = await fileFrom(c);
  if (!PRODUCT_IMAGE_KINDS.includes(kind as ProductImageKind)) {
    throw AppError.invalid("Invalid image kind", [
      { path: "kind", message: "INVALID_KIND" },
    ]);
  }
  return c.json(
    await ctl(c).addImage(c.req.param("id"), kind as ProductImageKind, file)
  );
});

productRoutes.delete("/products/:id/images/:imageId", async (c) =>
  c.json(await ctl(c).removeImage(c.req.param("id"), c.req.param("imageId")))
);

productRoutes.post("/products/:id/enhance", async (c) => {
  const input = await parseJson(c, enhanceSchema);
  return c.json(
    await ctl(c).enhance(c.req.param("id"), input.provider, input.sourceImageId)
  );
});
