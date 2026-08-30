import type { Ctx } from "@/server/context";
import { resolveActiveStoreId } from "@/server/active-store";
import { MenuImportService } from "@/server/services/menu-import-service";
import { AppError } from "@/server/errors";
import type { z } from "zod";
import type { importApplySchema } from "@/shared/schemas";

export class MenuImportController {
  private constructor(private ctx: Ctx, private importer: MenuImportService) {}

  static make(ctx: Ctx) {
    return new MenuImportController(ctx, MenuImportService.make(ctx));
  }

  private get actor() {
    return this.ctx.var.actor;
  }

  async extract(file: File | null) {
    if (!file) throw AppError.invalid("A menu image is required");
    const storeId = await resolveActiveStoreId(this.actor);
    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    return { extracted: await this.importer.extract(this.actor, storeId, buffer, mime) };
  }

  async apply(input: z.infer<typeof importApplySchema>) {
    const storeId = await resolveActiveStoreId(this.actor);
    return { created: await this.importer.apply(this.actor, storeId, input) };
  }
}
