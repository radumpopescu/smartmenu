import {
  getMenuExtractionSystemPrompt,
  getMenuExtractionUserPrompt,
  promptsToLogSnapshot,
} from "./prompts";
import {
  estimateTokenCostUsd,
  logLlmCallWithTiming,
  usageFromXaiResponse,
} from "./llm-log";

export type ExtractedMenu = {
  restaurantName: string | null;
  categories: {
    name: string;
    items: {
      name: string;
      description: string | null;
      priceCents: number | null;
      priceLabel: string | null;
      tags: string[];
    }[];
  }[];
};

function fileToDataUrl(buffer: Buffer, mime: string) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function extractMenuFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractedMenu> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not configured");
  }

  const model = process.env.XAI_MODEL ?? "grok-4.3";
  const startedAt = Date.now();

  const [systemPrompt, userPrompt] = await Promise.all([
    getMenuExtractionSystemPrompt(),
    getMenuExtractionUserPrompt(),
  ]);

  const promptLog = promptsToLogSnapshot({
    system: systemPrompt,
    user: userPrompt,
  });

  const requestBody = {
    model,
    messages: [
      { role: "system", content: systemPrompt.text },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt.text },
          {
            type: "image_url",
            image_url: {
              url: fileToDataUrl(imageBuffer, mimeType),
              detail: "high",
            },
          },
        ],
      },
    ],
    temperature: 0.1,
  };

  const logInput = {
    ...requestBody,
    messages: [
      requestBody.messages[0],
      {
        role: "user",
        content: [
          requestBody.messages[1].content[0],
          {
            type: "image_url",
            image_url: {
              detail: "high",
              imageBytes: imageBuffer.length,
              mimeType,
            },
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
          provider: "xai",
          model,
          operation: "menu-extract",
          prompts: promptLog,
          input: logInput,
          output: data,
          error: `HTTP ${response.status}`,
        },
        startedAt
      );
      throw new Error(`Grok API error: ${response.status} ${rawText}`);
    }

    const usage = usageFromXaiResponse(
      data as { usage?: Parameters<typeof usageFromXaiResponse>[0]["usage"] }
    );
    const cost = usage ? estimateTokenCostUsd(model, usage) : null;

    const content = (
      data as { choices?: { message?: { content?: string } }[] }
    ).choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      await logLlmCallWithTiming(
        {
          provider: "xai",
          model,
          operation: "menu-extract",
          prompts: promptLog,
          input: logInput,
          output: data,
          usage,
          costUsd: cost?.costUsd,
          costNote: cost?.note,
          error: "No content in Grok response",
        },
        startedAt
      );
      throw new Error("No content in Grok response");
    }

    const jsonStr = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed: ExtractedMenu;
    try {
      parsed = JSON.parse(jsonStr) as ExtractedMenu;
    } catch (parseErr) {
      await logLlmCallWithTiming(
        {
          provider: "xai",
          model,
          operation: "menu-extract",
          prompts: promptLog,
          input: logInput,
          output: { rawContent: content, apiResponse: data },
          usage,
          costUsd: cost?.costUsd,
          costNote: cost?.note,
          error:
            parseErr instanceof Error
              ? `JSON parse: ${parseErr.message}`
              : "JSON parse failed",
        },
        startedAt
      );
      throw parseErr;
    }

    await logLlmCallWithTiming(
      {
        provider: "xai",
        model,
        operation: "menu-extract",
        prompts: promptLog,
        input: logInput,
        output: { extracted: parsed, rawContent: content },
        usage,
        costUsd: cost?.costUsd,
        costNote: cost?.note,
        meta: {
          categories: parsed.categories.length,
          items: parsed.categories.reduce((n, c) => n + c.items.length, 0),
        },
      },
      startedAt
    );

    return parsed;
  } catch (e) {
    if (e instanceof Error && !e.message.startsWith("Grok API")) {
      await logLlmCallWithTiming(
        {
          provider: "xai",
          model,
          operation: "menu-extract",
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