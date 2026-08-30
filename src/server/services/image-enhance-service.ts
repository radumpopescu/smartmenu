import type { Database } from "@/server/db";
import type { Actor } from "@/server/actor";
import { AppError, ErrorCode } from "@/server/errors";
import { ProductService } from "@/server/services/product-service";
import { enhanceDishImage, type ImageProvider } from "@/lib/image-enhance";
import type { ProductDTO } from "@/server/dto";

export class ImageEnhanceService {
  private constructor(private products: ProductService) {}

  static make(ctx: Parameters<typeof ProductService.make>[0]) {
    return new ImageEnhanceService(ProductService.make(ctx));
  }

  /**
   * Enhance in the request path.
   *
   * This is the one call that genuinely belongs on a queue — it is a
   * multi-second model round trip. It stays synchronous for now because
   * there is no queue in the local runtime; when one exists, this method is
   * the seam: enqueue, return the job, and let a consumer write the image.
   */
  async enhance(
    actor: Actor,
    storeId: string,
    itemId: string,
    provider: ImageProvider,
    sourceImageId?: string
  ): Promise<ProductDTO> {
    const sourceUrl = await this.products.resolveEnhanceSource(
      actor,
      storeId,
      itemId,
      sourceImageId
    );

    let buffer: Buffer;
    try {
      buffer = await enhanceDishImage(sourceUrl, provider);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Enhancement failed";
      throw new AppError(ErrorCode.UPSTREAM_FAILED, message);
    }

    return this.products.addImageFromBuffer(actor, storeId, itemId, buffer);
  }
}

export type { Database };
