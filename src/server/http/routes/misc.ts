import { Hono } from "hono";
import type { Env } from "@/server/http/app";
import { requireAuth } from "@/server/http/middleware";
import { getAllPrompts } from "@/lib/prompts";
import { UserService } from "@/server/services/user-service";
import { environment } from "@/server/context";
import { AppError } from "@/server/errors";

export const miscRoutes = new Hono<Env>();

/**
 * Prompt text for the admin UI.
 *
 * Behind auth: these are the tuned extraction and enhancement prompts, and
 * they used to be readable by anyone who knew the URL.
 */
miscRoutes.get("/prompts", requireAuth, async (c) => {
  const prompts = await getAllPrompts();
  return c.json({
    menuExtractionSystem: prompts.menuSystem.text,
    menuExtractionUser: prompts.menuUser.text,
    dishEnhancement: prompts.dishEnhancement.text,
    files: {
      menuExtractionSystem: prompts.menuSystem.sourceFile,
      menuExtractionUser: prompts.menuUser.sourceFile,
      dishEnhancement: prompts.dishEnhancement.sourceFile,
    },
  });
});

/** Dev-only: populates the quick-login dropdown. */
miscRoutes.get("/dev/users", async (c) => {
  if (environment() !== "development") throw AppError.notFound();
  const users = await UserService.make(c.get("ctx")).listForDevLogin();
  return c.json({ users });
});
