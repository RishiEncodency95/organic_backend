import { ApiError } from "../../utils/ApiError";

/** Machine-readable analyzer error codes (API_CONTRACTS.md). */
export type AnalyzerErrorCode =
  | "INVALID_URL"
  | "BLOCKED_TARGET"
  | "DUPLICATE_DOMAIN"
  | "OWN_DOMAIN_AS_COMPETITOR"
  | "TOO_MANY_COMPETITORS"
  | "STUDY_NOT_FOUND"
  | "RUN_NOT_FOUND"
  | "STUDY_ARCHIVED"
  | "REVISION_CONFLICT"
  | "RUN_ACTIVE"
  | "RERUN_COOLDOWN"
  | "STUDY_LIMIT"
  | "AI_UNAVAILABLE"
  | "AI_BUDGET_EXCEEDED"
  | "PROVIDER_UNAVAILABLE"
  | "ANALYZER_DISABLED"
  | "NOT_CANCELLABLE"
  | "ACTION_NOT_FOUND";

export class AnalyzerError extends ApiError {
  code: AnalyzerErrorCode;
  constructor(status: number, code: AnalyzerErrorCode, message: string) {
    super(status, message, [code]);
    this.code = code;
  }
}

/** Raised by URL / network-safety checks. Not an HTTP error by itself: the caller decides how to report it. */
export class FetchBlockedError extends Error {
  code: "INVALID_URL" | "BLOCKED_TARGET";
  constructor(code: "INVALID_URL" | "BLOCKED_TARGET", message: string) {
    super(message);
    this.code = code;
    this.name = "FetchBlockedError";
  }
}
