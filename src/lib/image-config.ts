/**
 * Cost dials for AI image work.
 *
 * gpt-image-1 does not take an arbitrary pixel size — it accepts
 * 1024x1024, 1536x1024, 1024x1536 or auto — so "make it smaller" is really
 * two levers: the `quality` tier, which is what actually drives output
 * tokens, and how big an image we upload in the first place.
 *
 * Rough output-token cost per 1024x1024 render: low ~272, medium ~1056,
 * high ~4160. Low is roughly 15x cheaper than high, which is why it is the
 * default here. Override per environment if a dish needs more detail.
 */

export const IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE ?? "1024x1024";

/** "low" | "medium" | "high" | "auto" */
export const IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY ?? "low";

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
