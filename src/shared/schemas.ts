/**
 * Shared validation schemas — the contract both sides use.
 *
 * CLIENT-SAFE: this module must import nothing but `zod`. It is imported by
 * browser components and by the API, so one schema validates the form and
 * the request, and contract drift stops being a category of bug.
 *
 * Normalization happens here, on the server's terms: a form's empty string
 * means "clear this field", so it becomes null once, not in each client.
 */
import { z } from "zod";

/** "" -> null, so web, mobile and hand-written requests behave identically. */
const emptyToNull = z
  .string()
  .transform((s) => (s.trim() === "" ? null : s))
  .nullable();

export const productCreateSchema = z.object({
  name: z.string().min(1, "NAME_REQUIRED"),
  description: emptyToNull.optional(),
  categoryId: emptyToNull.optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  priceLabel: emptyToNull.optional(),
  tags: z.array(z.string()).optional(),
});

export const productUpdateSchema = z.object({
  name: z.string().min(1, "NAME_REQUIRED").optional(),
  description: emptyToNull.optional(),
  categoryId: emptyToNull.optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  priceLabel: emptyToNull.optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  hidden: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  displayImageId: z.string().nullable().optional(),
});

export const productReorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      categoryId: z.string().nullable(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "NAME_REQUIRED").max(120, "NAME_TOO_LONG"),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1, "NAME_REQUIRED").max(120, "NAME_TOO_LONG").optional(),
});

export const categoryReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

export const storeUpdateSchema = z.object({
  name: z.string().min(1, "NAME_REQUIRED").optional(),
  slug: z.string().min(1, "SLUG_REQUIRED").optional(),
  tagline: emptyToNull.optional(),
  description: emptyToNull.optional(),
  accentColor: z.string().optional(),
  currency: z.string().length(3, "INVALID_CURRENCY").optional(),
  published: z.boolean().optional(),
});

export const storeCreateSchema = z.object({
  name: z.string().min(1, "NAME_REQUIRED"),
  slug: z.string().min(1).optional(),
  tagline: emptyToNull.optional(),
  description: emptyToNull.optional(),
  currency: z.string().length(3, "INVALID_CURRENCY").optional(),
});

export const userCreateSchema = z.object({
  email: z.string().email("INVALID_EMAIL"),
  password: z.string().min(6, "PASSWORD_TOO_SHORT"),
  name: emptyToNull.optional(),
  role: z.enum(["superadmin", "operator"]).default("operator"),
  storeIds: z.array(z.string()).optional(),
});

export const userStoresSchema = z.object({
  storeIds: z.array(z.string()),
});

export const activeStoreSchema = z.object({
  storeId: z.string().min(1),
});

export const enhanceSchema = z.object({
  provider: z.enum(["nano-banana", "openai", "codex"]),
  sourceImageId: z.string().optional(),
});

export const extractedMenuSchema = z.object({
  restaurantName: z.string().nullable().optional(),
  categories: z.array(
    z.object({
      name: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          description: z.string().nullable().optional(),
          priceCents: z.number().nullable().optional(),
          priceLabel: z.string().nullable().optional(),
          tags: z.array(z.string()).optional(),
        })
      ),
    })
  ),
});

export const importApplySchema = z.object({
  extracted: extractedMenuSchema,
  replaceExisting: z.boolean().optional(),
});
