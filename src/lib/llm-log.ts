import fs from "fs/promises";
import path from "path";

const LOG_PATH =
  process.env.LLM_LOG_PATH ?? path.join(process.cwd(), "llm.log");

/** USD per 1M tokens (xAI grok-4.3, Feb 2026 docs) */
const PRICING_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  "grok-4.3": { input: 1.25, output: 2.5 },
  "grok-4.20-0309-reasoning": { input: 1.25, output: 2.5 },
  "grok-4.20-0309-non-reasoning": { input: 1.25, output: 2.5 },
};

export type LlmUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type PromptLogEntry = {
  text: string;
  sourceFile?: string;
};

export type LlmLogEntry = {
  provider: string;
  model: string;
  operation: string;
  /** Full prompt text used for this call (edit files under prompts/) */
  prompts?: Record<string, PromptLogEntry>;
  input: unknown;
  output?: unknown;
  usage?: LlmUsage;
  costUsd?: number;
  costNote?: string;
  error?: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
};

export function estimateTokenCostUsd(
  model: string,
  usage: LlmUsage
): { costUsd: number; note: string } | null {
  const rates = PRICING_PER_MILLION[model] ?? PRICING_PER_MILLION["grok-4.3"];
  const inTok = usage.promptTokens ?? 0;
  const outTok = usage.completionTokens ?? 0;
  if (inTok === 0 && outTok === 0) return null;

  const costUsd =
    (inTok / 1_000_000) * rates.input + (outTok / 1_000_000) * rates.output;
  return {
    costUsd,
    note: `${inTok} in @ $${rates.input}/M + ${outTok} out @ $${rates.output}/M`,
  };
}

export function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[max depth]";
  if (value == null) return value;

  if (typeof value === "string") {
    if (value.startsWith("data:image/")) {
      const comma = value.indexOf(",");
      const header = comma > 0 ? value.slice(0, comma) : "data:image/...";
      const b64Len = comma > 0 ? value.length - comma - 1 : value.length;
      return `${header},[base64 ${b64Len} chars omitted]`;
    }
    if (value.length > 8000) {
      return `${value.slice(0, 4000)}\n… [truncated ${value.length} chars] …\n${value.slice(-500)}`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForLog(v, depth + 1));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "data" && typeof v === "string" && v.length > 200) {
        out[k] = `[base64 ${v.length} chars omitted]`;
        continue;
      }
      if (k === "inline_data" || k === "inlineData") {
        const inline = v as Record<string, unknown>;
        out[k] = {
          ...inline,
          data:
            typeof inline.data === "string"
              ? `[base64 ${inline.data.length} chars omitted]`
              : inline.data,
        };
        continue;
      }
      out[k] = sanitizeForLog(v, depth + 1);
    }
    return out;
  }

  return value;
}

function formatBlock(title: string, data: unknown): string {
  return `${title}:\n${JSON.stringify(sanitizeForLog(data), null, 2)}\n`;
}

function formatPromptsBlock(
  prompts: Record<string, PromptLogEntry>
): string {
  const lines = ["prompts:"];
  for (const [name, p] of Object.entries(prompts)) {
    const src = p.sourceFile ? ` (${p.sourceFile})` : "";
    lines.push(`--- ${name}${src} ---`);
    lines.push(p.text);
    lines.push("");
  }
  return lines.join("\n");
}

export async function logLlmCall(entry: LlmLogEntry): Promise<void> {
  const ts = new Date().toISOString();
  const lines: string[] = [
    "",
    "=".repeat(72),
    `${ts} | ${entry.provider} | ${entry.model} | ${entry.operation}`,
    "=".repeat(72),
  ];

  if (entry.durationMs != null) {
    lines.push(`duration_ms: ${entry.durationMs}`);
  }

  if (entry.usage) {
    const u = entry.usage;
    lines.push(
      `usage: prompt=${u.promptTokens ?? "?"} completion=${u.completionTokens ?? "?"} total=${u.totalTokens ?? "?"}`
    );
  }

  if (entry.costUsd != null) {
    lines.push(
      `cost_usd: $${entry.costUsd.toFixed(6)}${entry.costNote ? ` (${entry.costNote})` : ""}`
    );
  } else if (entry.costNote) {
    lines.push(`cost_note: ${entry.costNote}`);
  }

  if (entry.meta && Object.keys(entry.meta).length > 0) {
    lines.push(formatBlock("meta", entry.meta));
  }

  if (entry.prompts && Object.keys(entry.prompts).length > 0) {
    lines.push(formatPromptsBlock(entry.prompts));
  }

  lines.push(formatBlock("input", entry.input));

  if (entry.error) {
    lines.push(`error:\n${entry.error}\n`);
  }

  if (entry.output !== undefined) {
    lines.push(formatBlock("output", entry.output));
  }

  lines.push("-".repeat(72));

  try {
    await fs.appendFile(LOG_PATH, lines.join("\n") + "\n", "utf8");
  } catch (e) {
    console.error("[llm-log] Failed to write", LOG_PATH, e);
  }
}

export function usageFromXaiResponse(data: {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}): LlmUsage | undefined {
  const u = data.usage;
  if (!u) return undefined;
  return {
    promptTokens: u.prompt_tokens,
    completionTokens: u.completion_tokens,
    totalTokens: u.total_tokens,
  };
}

export async function logLlmCallWithTiming(
  entry: Omit<LlmLogEntry, "durationMs">,
  startedAt: number
): Promise<void> {
  await logLlmCall({ ...entry, durationMs: Date.now() - startedAt });
}