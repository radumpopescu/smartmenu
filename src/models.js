export const FEATURES = ['assistant', 'import', 'photo', 'voice'];
export const TRANSCRIBE_MODEL = 'gpt-transcribe';
export const SECRETS = { xai: 'XAI_API_KEY', openai: 'OPENAI_API_KEY' };

const text = (input, cached, output) => ({ input, cached, output });
const realtime = (textIn, cachedTextIn, textOut, audioIn, cachedAudioIn, audioOut, imageIn, cachedImageIn) =>
  ({ textIn, cachedTextIn, textOut, audioIn, cachedAudioIn, audioOut, imageIn, cachedImageIn });

// Prices are US dollars per million tokens, which is also millionths of a dollar per token.
export const MODELS = [
  { provider: 'xai', model: 'grok-4.20-non-reasoning', label: 'Grok 4.20 (non-reasoning)', features: ['assistant'], prices: text(1.25, 0.2, 2.5), longContext: 200000 },
  { provider: 'xai', model: 'grok-4.3', label: 'Grok 4.3', features: ['assistant', 'import'], prices: text(1.25, 0.2, 2.5), longContext: 200000 },
  { provider: 'openai', model: 'gpt-6-luna', label: 'GPT-6 Luna', features: ['assistant', 'import'], prices: text(0.1, 0.01, 0.5) },
  { provider: 'openai', model: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', features: ['assistant', 'import'], prices: text(1, 0.05, 5) },
  { provider: 'openai', model: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', features: ['assistant', 'import'], prices: text(2, 0.1, 10) },
  { provider: 'openai', model: 'gpt-6-astra', label: 'GPT-6 Astra', features: ['import'], prices: text(10, 1, 50) },
  { provider: 'openai', model: 'gpt-realtime-2.1', label: 'GPT Realtime 2.1', features: ['voice'], prices: realtime(4, 0.4, 24, 32, 0.4, 64, 5, 0.5) },
  { provider: 'openai', model: 'gpt-realtime-2.1-mini', label: 'GPT Realtime 2.1 mini', features: ['voice'], prices: realtime(0.6, 0.06, 2.4, 10, 0.3, 20, 0.8, 0.08) },
  { provider: 'openai', model: 'gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst', features: ['photo'], prices: { textIn: 5, imageIn: 8, imageOut: 30 } },
  { provider: 'xai', model: 'grok-imagine-image-2.0', label: 'Grok Imagine Image 2.0', features: ['photo'], prices: { perImage: 0.04 } },
  { provider: 'openai', model: TRANSCRIBE_MODEL, label: 'GPT Transcribe', features: [], prices: { perMinute: 0.0045 } }
];

// The first entry whose key is present is the default; with no key, the first entry names the missing secret.
export const DEFAULTS = {
  assistant: [['xai', 'grok-4.20-non-reasoning'], ['openai', 'gpt-6-luna']],
  import: [['xai', 'grok-4.3'], ['openai', 'gpt-6-luna']],
  photo: [['openai', 'gpt-image-2.5-sunburst'], ['xai', 'grok-imagine-image-2.0']],
  voice: [['openai', 'gpt-realtime-2.1-mini']]
};

export const modelOf = (provider, model) => MODELS.find((entry) => entry.provider === provider && entry.model === model) ?? null;
export const serves = (feature, provider, model) => Boolean(modelOf(provider, model)?.features.includes(feature));

const count = (value) => Number.isInteger(value) && value >= 0 ? value : null;
const part = (value) => count(value) ?? 0;
const micros = (value) => Math.round(value);

function tokenCost(prices, usage, longContext) {
  const input = count(usage.input_tokens ?? usage.prompt_tokens);
  const output = count(usage.output_tokens ?? usage.completion_tokens);
  if (input === null || output === null) return null;
  const cached = Math.min(input, part((usage.input_tokens_details ?? usage.prompt_tokens_details)?.cached_tokens));
  const rate = longContext && input >= longContext ? 2 : 1;
  return micros(rate * ((input - cached) * prices.input + cached * (prices.cached ?? prices.input) + output * prices.output));
}

function realtimeCost(prices, usage) {
  const input = usage.input_token_details;
  const output = usage.output_token_details;
  if (!input && !output) return null;
  const textIn = part(input?.text_tokens);
  const audioIn = part(input?.audio_tokens);
  const imageIn = part(input?.image_tokens);
  const cachedTotal = part(input?.cached_tokens);
  const details = input?.cached_tokens_details;
  const cachedText = Math.min(textIn, details ? part(details.text_tokens) : cachedTotal);
  const cachedAudio = Math.min(audioIn, details ? part(details.audio_tokens) : cachedTotal - cachedText);
  const cachedImage = Math.min(imageIn, details ? part(details.image_tokens) : 0);
  return micros((textIn - cachedText) * prices.textIn + cachedText * prices.cachedTextIn +
    (audioIn - cachedAudio) * prices.audioIn + cachedAudio * prices.cachedAudioIn +
    (imageIn - cachedImage) * prices.imageIn + cachedImage * prices.cachedImageIn +
    part(output?.text_tokens) * prices.textOut + part(output?.audio_tokens) * prices.audioOut);
}

function imageCost(prices, usage) {
  const input = count(usage.input_tokens);
  const output = count(usage.output_tokens);
  if (input === null || output === null) return null;
  const details = usage.input_tokens_details;
  const images = Math.min(input, part(details?.image_tokens));
  const texts = details?.text_tokens !== undefined ? Math.min(input - images, part(details.text_tokens)) : input - images;
  return micros(texts * prices.textIn + images * prices.imageIn + output * prices.imageOut);
}

export function costMicros(provider, model, usage) {
  const entry = modelOf(provider, model);
  if (!entry || !usage || typeof usage !== 'object') return null;
  const { prices } = entry;
  if (prices.perImage !== undefined) {
    const images = count(usage.images);
    return images === null ? null : micros(images * prices.perImage * 1e6);
  }
  if (prices.perMinute !== undefined) {
    const seconds = usage.type === 'duration' && Number.isFinite(usage.seconds) && usage.seconds >= 0 ? usage.seconds : null;
    return seconds === null ? null : micros(seconds / 60 * prices.perMinute * 1e6);
  }
  if (prices.audioIn !== undefined) return realtimeCost(prices, usage);
  if (prices.imageOut !== undefined) return imageCost(prices, usage);
  return tokenCost(prices, usage, entry.longContext);
}
