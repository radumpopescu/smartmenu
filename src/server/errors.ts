/**
 * One response shape for every failure, everywhere.
 *
 * Codes are machine-readable, SCREAMING_SNAKE_CASE, and never localized —
 * the client maps a code to a string it owns (see `src/lib/api-error.ts`).
 */

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  CONFLICT: "CONFLICT",
  NO_STORE_SELECTED: "NO_STORE_SELECTED",
  UPSTREAM_FAILED: "UPSTREAM_FAILED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  CONFLICT: 409,
  NO_STORE_SELECTED: 400,
  UPSTREAM_FAILED: 502,
  INTERNAL: 500,
};

export type FieldIssue = { path: string; message: string };

export type ErrorEnvelope = {
  error: {
    code: ErrorCode;
    /** Human-readable, English, for logs and as a client fallback. */
    message: string;
    detail?: { issues?: FieldIssue[]; [key: string]: unknown };
  };
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly detail?: ErrorEnvelope["error"]["detail"];

  constructor(
    code: ErrorCode,
    message?: string,
    detail?: ErrorEnvelope["error"]["detail"],
    status?: number
  ) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = status ?? DEFAULT_STATUS[code];
    this.detail = detail;
  }

  toEnvelope(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.detail ? { detail: this.detail } : {}),
      },
    };
  }

  static unauthorized(message = "Sign in required") {
    return new AppError(ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message = "You do not have access to this resource") {
    return new AppError(ErrorCode.FORBIDDEN, message);
  }

  static notFound(message = "Not found") {
    return new AppError(ErrorCode.NOT_FOUND, message);
  }

  static conflict(message: string) {
    return new AppError(ErrorCode.CONFLICT, message);
  }

  /** Validation failures that are not field-shaped (a bad id, a bad combination). */
  static invalid(message: string, issues?: FieldIssue[]) {
    return new AppError(
      ErrorCode.VALIDATION_FAILED,
      message,
      issues ? { issues } : undefined
    );
  }
}

/**
 * The single serializer for validation issues.
 *
 * Every route funnels field errors through here. The moment two routes
 * serialize them differently, the client-side parser that maps issues onto
 * form fields stops working for one of them, with no error to trace.
 */
export function issuesFromZod(
  error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }
): FieldIssue[] {
  return error.issues.map((i) => ({
    path: i.path.map(String).join("."),
    message: i.message,
  }));
}

export function validationFailed(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): AppError {
  const issues = issuesFromZod(error);
  return new AppError(
    ErrorCode.VALIDATION_FAILED,
    issues[0]?.message ?? "Validation failed",
    { issues }
  );
}

/** Normalize anything thrown into an AppError. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const message = e instanceof Error ? e.message : "Something went wrong";
  return new AppError(ErrorCode.INTERNAL, message);
}
