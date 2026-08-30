/**
 * Cost dials for AI image work.
 *
 * gpt-image-1 does not take an arbitrary pixel size — it accepts
 * 1024x1024, 1536x1024, 1024x1536 or auto — so "make it smaller" is really
 * two levers: the `quality` tier, which is what actually drives output
 * tokens, and how big an image we upload in the first place.
 *
 * Rough output-token cost per 1024x1024 render: low ~272, medium ~1056,
 * high ~4160. Low is roughly 15x cheaper and is the default here.
 *
 * Caveat worth knowing before trusting the output: at quality=low the model
 * does not preserve the dish. Verified on a real photo — poached eggs came
 * back as smooth yellow blobs and a rocket-and-sesame salad as a flat green
 * mass. gpt-image-1 is a generative editor, so it redraws; prompt wording
 * does not stop that. Raise quality for more detail, or use a segmentation
 * (matting) model, which computes an alpha mask and cannot redraw at all.
 */

/**
 * Image model.
 *
 * gpt-image-2 by a wide margin. Measured on the same dish, quality=low:
 *   gpt-image-1  $0.0179  redrew the food — poached eggs became smooth
 *                         blobs, the rocket-and-sesame salad a green mass
 *   gpt-image-2  $0.0214  preserved it — salmon texture, paprika on the
 *                         egg, individual leaves with sesame and pumpkin
 *                         seeds, the balsamic drizzle pattern intact
 *
 * Roughly 20% more for output that is actually usable. Note gpt-image-2
 * rejects `input_fidelity`, so that parameter is only sent to gpt-image-1.
 */
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";

export const IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE ?? "1024x1024";

/** "low" | "medium" | "high" | "auto" */
export const IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY ?? "low";

/**
 * gpt-image-1 only — gpt-image-2 returns 400 for this parameter.
 *
 * How faithfully the edit must preserve the *input* image.
 *
 * Measured on a real dish (Oua Benedict, 1554x1460 JPEG), quality=low:
 *   default -> $0.0179, redrew the food but kept the plate
 *   high    -> $0.0595, 3.3x the cost and WORSE — dropped the plate
 *              entirely and mangled the salmon into brown blobs
 *
 * So "high" is not the fix it sounds like, and the default stays. The real
 * lever for detail is `quality` (output tokens): low is 272 tokens, which is
 * simply too few to reconstruct a photograph. See the note on IMAGE_QUALITY.
 */
export const INPUT_FIDELITY = process.env.OPENAI_INPUT_FIDELITY ?? "low";

/**
 * Longest edge we upload. Input images are billed by their dimensions, and
 * sending a 2000px photo to produce a 1024px render is paying twice for
 * pixels the model throws away.
 */
export const INPUT_MAX_PX = Number(process.env.DISH_IMAGE_INPUT_MAX_PX ?? 1024);

/** USD per 1M tokens. Override if the published rates move. */
export const RATES = {
  textInput: Number(process.env.OPENAI_IMAGE_RATE_TEXT_IN ?? 5),
  imageInput: Number(process.env.OPENAI_IMAGE_RATE_IMAGE_IN ?? 10),
  imageOutput: Number(process.env.OPENAI_IMAGE_RATE_IMAGE_OUT ?? 40),
};

export function estimateImageCostUsd(usage: {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
}): number | undefined {
  if (!usage) return undefined;
  const textIn = usage.input_tokens_details?.text_tokens ?? 0;
  const imageIn =
    usage.input_tokens_details?.image_tokens ??
    Math.max(0, (usage.input_tokens ?? 0) - textIn);
  const out = usage.output_tokens ?? 0;
  if (!textIn && !imageIn && !out) return undefined;

  return (
    (textIn / 1_000_000) * RATES.textInput +
    (imageIn / 1_000_000) * RATES.imageInput +
    (out / 1_000_000) * RATES.imageOutput
  );
}

/**
 * Local Codex image server.
 *
 * Speaks the OpenAI image shape but runs generation through the Codex CLI's
 * own ChatGPT login, so it costs no API tokens. It is a local dev tool: it
 * has to be running, and a generation can take minutes rather than seconds.
 */
export const CODEX_BASE_URL =
  process.env.CODEX_IMAGE_URL ?? "http://127.0.0.1:8787";

/** Generations are reported to take minutes; the guide asks for 15+. */
export const CODEX_TIMEOUT_MS = Number(
  process.env.CODEX_IMAGE_TIMEOUT_MS ?? 15 * 60 * 1000
);
