import { getDishEnhancementPrompt, promptsToLogSnapshot } from "./prompts";
import { logLlmCallWithTiming } from "./llm-log";
import fs from "fs/promises";
import path from "path";

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
  provider: ImageProvider
): Promise<Buffer> {
  const { buffer, mime, base64 } = await readImageAsBase64(imageUrl);
  const dishPrompt = await getDishEnhancementPrompt();
  const promptLog = promptsToLogSnapshot({ dishEnhancement: dishPrompt });

  if (provider === "openai") {
    return enhanceWithOpenAI(buffer, mime, imageUrl, dishPrompt.text, promptLog);
  }
  return enhanceWithGemini(base64, mime, imageUrl, dishPrompt.text, promptLog);
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

  const model = "gpt-image-1";
  const startedAt = Date.now();
  const logInput = {
    endpoint: "images/edits",
    model,
    size: "1024x1024",
    sourceImage: imageUrl,
    imageBytes: imageBuffer.length,
    mime,
  };

  const form = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mime });
  form.append("image", blob, "dish.jpg");
  form.append("prompt", promptText);
  form.append("model", model);
  form.append("n", "1");
  form.append("size", "1024x1024");

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
          apiMetadata: data,
        },
        costUsd: 0.04,
        costNote:
          "estimate ~$0.04/image (gpt-image-1 edit, verify on OpenAI pricing)",
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
                { text: promptText },
                { inline_data: { mime_type: mime, data: base64 } },
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