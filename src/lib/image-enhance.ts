import {
  getDishEnhancementPrompt,
  promptsToLogSnapshot,
  renderPrompt,
  type PromptVars,
} from "./prompts";
import { logLlmCallWithTiming } from "./llm-log";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  IMAGE_MODEL,
  IMAGE_QUALITY,
  IMAGE_SIZE,
  INPUT_FIDELITY,
  INPUT_MAX_PX,
  estimateImageCostUsd,
} from "./image-config";

export type ImageProvider = "nano-banana" | "openai";

async function readImageAsBase64(imagePath: string) {
  const absolute = imagePath.startsWith("/")
    ? path.join(process.cwd(), "public", imagePath)
    : imagePath;
  const buffer = await fs.readFile(absolute);
  const ext = path.extname(absolute).toLowerCase();
  const mime =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";
  return { buffer, mime, base64: buffer.toString("base64") };
}

export async function enhanceDishImage(
  imageUrl: string,
  provider: ImageProvider,
  /** Fills `{{name}}` / `{{description}}` — same template the admin copies. */
  vars: PromptVars = {}
): Promise<Buffer> {
  const { buffer, mime, base64 } = await readImageAsBase64(imageUrl);
  const loaded = await getDishEnhancementPrompt();
  const dishPrompt = {
    ...loaded,
    text: renderPrompt(loaded.text, vars),
  };
  const promptLog = promptsToLogSnapshot({ dishEnhancement: dishPrompt });

  if (provider === "openai") {
    return enhanceWithOpenAI(buffer, mime, imageUrl, dishPrompt.text, promptLog);
  }
  return enhanceWithGemini(base64, mime, imageUrl, dishPrompt.text, promptLog);
}

/**
 * Shrink the upload to `INPUT_MAX_PX` on its longest edge.
 *
 * Input images are billed by dimension, so posting a 2000px photo to get a
 * 1024px render pays for pixels the model discards. Only ever downscales —
 * `withoutEnlargement` keeps a small photo at its own size rather than
 * upsampling it into a blurrier, more expensive one.
 */
async function shrinkForUpload(
  buffer: Buffer,
  mime: string
): Promise<{ buffer: Buffer; mime: string; width?: number; height?: number }> {
  try {
    const img = sharp(buffer).rotate(); // honour EXIF orientation
    const meta = await img.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);

    if (longest && longest <= INPUT_MAX_PX) {
      return { buffer, mime, width: meta.width, height: meta.height };
    }

    /*
     * Keep a photograph a JPEG. Re-encoding one as PNG inflates it — a 622KB
     * 1554px JPEG came back as a 2.1MB PNG, larger than the original it was
     * meant to shrink. PNG is only worth it when there is alpha to preserve.
     */
    const resized = img.resize({
      width: INPUT_MAX_PX,
      height: INPUT_MAX_PX,
      fit: "inside",
      withoutEnlargement: true,
    });

    const out = await (meta.hasAlpha
      ? resized.png({ compressionLevel: 9 })
      : resized.jpeg({ quality: 90, mozjpeg: true })
    ).toBuffer({ resolveWithObject: true });

    return {
      buffer: out.data,
      mime: meta.hasAlpha ? "image/png" : "image/jpeg",
      width: out.info.width,
      height: out.info.height,
    };
  } catch {
    // A resize failure must not block the enhancement — send the original.
    return { buffer, mime };
  }
}

async function enhanceWithOpenAI(
  imageBuffer: Buffer,
  mime: string,
  imageUrl: string,
  promptText: string,
  promptLog: ReturnType<typeof promptsToLogSnapshot>
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = IMAGE_MODEL;
  const startedAt = Date.now();

  const upload = await shrinkForUpload(imageBuffer, mime);

  const logInput = {
    endpoint: "images/edits",
    model,
    size: IMAGE_SIZE,
    quality: IMAGE_QUALITY,
    inputFidelity: model.startsWith("gpt-image-1") ? INPUT_FIDELITY : null,
    background: "transparent",
    sourceImage: imageUrl,
    originalBytes: imageBuffer.length,
    uploadedBytes: upload.buffer.length,
    uploadedDimensions:
      upload.width && upload.height ? `${upload.width}x${upload.height}` : null,
    mime: upload.mime,
  };

  const form = new FormData();
  const blob = new Blob([new Uint8Array(upload.buffer)], { type: upload.mime });
  form.append("image", blob, upload.mime === "image/png" ? "dish.png" : "dish.jpg");
  form.append("prompt", promptText);
  form.append("model", model);
  form.append("n", "1");
  form.append("size", IMAGE_SIZE);
  form.append("quality", IMAGE_QUALITY);
  /*
   * The whole point of the exercise: without background=transparent the API
   * returns an opaque render and the menu collage has nothing to composite.
   * Transparency requires a png (or webp) output format.
   */
  form.append("background", "transparent");
  form.append("output_format", "png");
  /*
   * input_fidelity is a gpt-image-1 parameter. gpt-image-2 rejects it
   * outright ("does not support the 'input_fidelity' parameter", 400), so
   * only send it to the model family that understands it.
   */
  if (model.startsWith("gpt-image-1")) {
    form.append("input_fidelity", INPUT_FIDELITY);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const rawText = await response.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      await logLlmCallWithTiming(
        {
          provider: "openai",
          model,
          operation: "dish-image-enhance",
          prompts: promptLog,
          input: logInput,
          output: data,
          costUsd: 0,
          costNote: "failed — no charge assumed",
          error: `HTTP ${response.status}`,
        },
        startedAt
      );
      throw new Error(`OpenAI image API error: ${response.status} ${rawText}`);
    }

    const b64 = (data as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
    if (!b64) {
      await logLlmCallWithTiming(
        {
          provider: "openai",
          model,
          operation: "dish-image-enhance",
          prompts: promptLog,
          input: logInput,
          output: data,
          error: "No image returned from OpenAI",
        },
        startedAt
      );
      throw new Error("No image returned from OpenAI");
    }

    const outBuffer = Buffer.from(b64, "base64");

    /*
     * Cost from the usage the API actually reports, rather than a hardcoded
     * guess — the quality tier changes it by more than 10x, so a fixed
     * figure in llm.log would be misleading precisely when it matters.
     */
    const usage = (data as { usage?: Parameters<typeof estimateImageCostUsd>[0] })
      .usage;
    const costUsd = usage ? estimateImageCostUsd(usage) : undefined;

    /** Did the model actually return an alpha channel? */
    let hasAlpha: boolean | null = null;
    try {
      hasAlpha = (await sharp(outBuffer).metadata()).hasAlpha ?? null;
    } catch {
      hasAlpha = null;
    }

    await logLlmCallWithTiming(
      {
        provider: "openai",
        model,
        operation: "dish-image-enhance",
        prompts: promptLog,
        input: logInput,
        output: {
          imageGenerated: true,
          outputBytes: outBuffer.length,
          hasAlpha,
          usage,
          apiMetadata: data,
        },
        ...(costUsd !== undefined
          ? {
              costUsd,
              costNote: `${model} edit, quality=${IMAGE_QUALITY}, size=${IMAGE_SIZE}${model.startsWith("gpt-image-1") ? `, input_fidelity=${INPUT_FIDELITY}` : ""}, from reported usage`,
            }
          : {
              costUsd: 0,
              costNote: "no usage reported by the API — cost unknown",
            }),
      },
      startedAt
    );

    return outBuffer;
  } catch (e) {
    if (e instanceof Error && !e.message.startsWith("OpenAI")) {
      await logLlmCallWithTiming(
        {
          provider: "openai",
          model,
          operation: "dish-image-enhance",
          prompts: promptLog,
          input: logInput,
          error: e.message,
        },
        startedAt
      );
    }
    throw e;
  }
}

async function enhanceWithGemini(
  base64: string,
  mime: string,
  imageUrl: string,
  promptText: string,
  promptLog: ReturnType<typeof promptsToLogSnapshot>
): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }

  const model = "gemini-2.0-flash-exp-image-generation";
  const startedAt = Date.now();
  const logInput = {
    model,
    endpoint: "generateContent",
    sourceImage: imageUrl,
    imageBytes: Buffer.from(base64, "base64").length,
    mime,
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mime, data: base64 } },
                { text: promptText },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    const rawText = await response.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      await logLlmCallWithTiming(
        {
          provider: "google",
          model,
          operation: "dish-image-enhance",
          prompts: promptLog,
          input: logInput,
          output: data,
          error: `HTTP ${response.status}`,
        },
        startedAt
      );
      throw new Error(`Gemini image API error: ${response.status} ${rawText}`);
    }

    const parts = (
      data as {
        candidates?: { content?: { parts?: Record<string, unknown>[] } }[];
      }
    ).candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      const inline = (part.inlineData ?? part.inline_data) as
        | { data?: string }
        | undefined;
      if (inline?.data) {
        const outBuffer = Buffer.from(inline.data, "base64");
        const textParts = parts
          .filter((p) => typeof p.text === "string")
          .map((p) => p.text);

        await logLlmCallWithTiming(
          {
            provider: "google",
            model,
            operation: "dish-image-enhance",
            prompts: promptLog,
            input: logInput,
            output: {
              textParts,
              imageGenerated: true,
              outputBytes: outBuffer.length,
              usageMetadata: (data as { usageMetadata?: unknown }).usageMetadata,
            },
            costUsd: 0.02,
            costNote:
              "estimate ~$0.02/image (verify Google/Gemini image pricing)",
          },
          startedAt
        );

        return outBuffer;
      }
    }

    await logLlmCallWithTiming(
      {
        provider: "google",
        model,
        operation: "dish-image-enhance",
        prompts: promptLog,
        input: logInput,
        output: data,
        error: "No image returned from Gemini",
      },
      startedAt
    );

    throw new Error("No image returned from Gemini (Nano Banana)");
  } catch (e) {
    if (e instanceof Error && !e.message.startsWith("Gemini")) {
      await logLlmCallWithTiming(
        {
          provider: "google",
          model,
          operation: "dish-image-enhance",
          prompts: promptLog,
          input: logInput,
          error: e.message,
        },
        startedAt
      );
    }
    throw e;
  }
}