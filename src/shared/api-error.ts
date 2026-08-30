/**
 * Client-side half of the error envelope.
 *
 * CLIENT-SAFE: no server imports. The API returns machine-readable codes and
 * never localized text; this module owns the mapping from a code (or a field
 * issue) to something a person can read.
 */

export type FieldIssue = { path: string; message: string };

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    detail?: { issues?: FieldIssue[] };
  };
};

/**
 * Codes whose server message must NOT be shown.
 *
 * These carry internal detail ("Missing required scope: admin.users.write",
 * a stack-derived message) that is noise to an operator. Every other code
 * gets the server's message, which is written for a human and is usually far
 * more specific than anything a lookup table can say — "Category is not
 * empty. Move or delete its products first." beats "That already exists."
 */
const OVERRIDE: Record<string, string> = {
  UNAUTHORIZED: "Your session expired. Sign in again.",
  FORBIDDEN: "You do not have permission to do that.",
  INTERNAL: "Something went wrong. Try again.",
};

const FIELD_MESSAGES: Record<string, string> = {
  NAME_REQUIRED: "Name is required.",
  NAME_TOO_LONG: "Name is too long.",
  SLUG_REQUIRED: "Slug is required.",
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_CURRENCY: "Currency must be a 3-letter code.",
  PASSWORD_TOO_SHORT: "Password must be at least 6 characters.",
};

/**
 * Turn any error response into a string safe to render.
 *
 * Never returns an object, so a `{error: {...}}` envelope can't reach JSX and
 * blow up as "objects are not valid as a React child".
 */
export function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const err = (body as ApiErrorBody).error;
  if (!err) return fallback;

  // A field issue is the most specific thing we can say.
  const first = err.detail?.issues?.[0];
  if (first) {
    const mapped = FIELD_MESSAGES[first.message];
    if (mapped) return mapped;
    if (first.path) return `${first.path}: ${first.message}`;
    return first.message;
  }

  if (err.code && OVERRIDE[err.code]) return OVERRIDE[err.code];
  if (typeof err.message === "string" && err.message) return err.message;
  return fallback;
}

/** Field-keyed issues, for forms that highlight individual inputs. */
export function fieldErrors(body: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!body || typeof body !== "object") return out;
  for (const issue of (body as ApiErrorBody).error?.detail?.issues ?? []) {
    if (!(issue.path in out)) {
      out[issue.path] = FIELD_MESSAGES[issue.message] ?? issue.message;
    }
  }
  return out;
}

/** Read a failed response once and produce a renderable message. */
export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    return errorMessage(await res.json(), fallback);
  } catch {
    return fallback;
  }
}
