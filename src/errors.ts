/**
 * Error types for the DriveThruRPG SDK.
 *
 * This module defines two error hierarchies:
 *
 * - {@link SdkError} — top-level errors covering SDK lifecycle states such as missing
 *   configuration or an unauthenticated session.
 * - {@link ClientError} — errors returned by HTTP-transport-facing SDK operations
 *   (authentication requests, library requests).
 *
 * `AuthSessionError` and `AuthState` — the structured, API-reported session error type
 * and its classification enum — live in `auth/session.ts`.
 */

/**
 * Base class for top-level errors returned by SDK lifecycle operations.
 *
 * Most SDK methods that depend on configuration or an active session throw a subclass
 * of `SdkError`. Use `instanceof` to distinguish a configuration issue from an
 * authentication issue.
 */
export abstract class SdkError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Thrown when the SDK has not been configured with a {@link Config} yet.
 *
 * Call `DriveThruRpgSdk.configure` or construct the SDK with `DriveThruRpgSdk.withConfig`
 * before making API calls.
 */
export class UnconfiguredError extends SdkError {
  constructor() {
    super("SDK is not configured");
  }
}

/**
 * Thrown when the SDK has no active authentication session.
 *
 * Obtain a session by calling `DriveThruRpgSdk.applyAuthResponse` with a successful
 * token response from the API.
 */
export class UnauthenticatedError extends SdkError {
  constructor() {
    super("SDK does not have an authenticated session");
  }
}

/**
 * Base class for errors returned by HTTP-transport-facing SDK operations, such as
 * authentication requests and {@link LibraryClient} calls.
 */
export abstract class ClientError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * An HTTP transport or server error occurred.
 *
 * Thrown for network-level failures (e.g. `fetch` rejecting) and for status-check
 * shortcut operations (delete endpoints) where the response indicated a non-success
 * status but the SDK does not attempt to extract a structured error message.
 */
export class HttpError extends ClientError {
  /** The URL that was requested. */
  readonly url: string;
  /** The HTTP status code of the response, if a response was received. */
  readonly status?: number;
  /** The underlying cause, if this error wraps a lower-level failure (e.g. a network error). */
  override readonly cause?: unknown;

  constructor(url: string, status?: number, cause?: unknown) {
    super(
      status === undefined
        ? `HTTP request failed [${url}]: ${String(cause)}`
        : `HTTP request failed [${url}] (HTTP ${status})`,
    );
    this.url = url;
    this.status = status;
    this.cause = cause;
  }
}

/**
 * The provided email or password was rejected by DriveThruRPG.
 *
 * Thrown by `loginWithCredentials` when `validate_login_credentials.php` indicates the
 * credentials are invalid.
 */
export class InvalidCredentialsError extends ClientError {
  constructor() {
    super("invalid credentials");
  }
}

/**
 * Credentials were accepted but the application key request failed.
 *
 * Thrown by `loginWithCredentials` when credentials pass validation but
 * `create_account_app.php` returns a non-success status.
 */
export class ApplicationKeyRequestFailedError extends ClientError {
  /** The status string returned by `create_account_app.php`. */
  readonly status: string;

  constructor(status: string) {
    super(`application key request failed (status: ${status})`);
    this.status = status;
  }
}

/**
 * The HTTP response indicated a successful status but the body could not be
 * deserialized into the expected type.
 *
 * The raw response body (truncated) is preserved so callers can log the offending
 * payload for diagnosis.
 */
export class DecodeFailedError extends ClientError {
  /** The URL that was requested. */
  readonly url: string;
  /** The HTTP status code of the response. */
  readonly status: number;
  /** The underlying parse/validation error. */
  override readonly cause: unknown;
  /** Raw response body, truncated to a bounded length. */
  readonly payload: string;

  constructor(url: string, status: number, cause: unknown, payload: string) {
    super(`response decode failed [${url}] (HTTP ${status}): ${String(cause)}`);
    this.url = url;
    this.status = status;
    this.cause = cause;
    this.payload = payload;
  }
}

/**
 * The API returned a non-success status.
 *
 * `message`, when present, is a human-readable explanation extracted from the response
 * body (a top-level `message` field, a nested `error.message` field, or field-keyed
 * validation errors, e.g. `{"productId": "Requires a valid Product ID. Invalid value 22654728."}`).
 *
 * The raw response body (truncated) is preserved so callers can log the offending
 * payload when no `message` could be extracted.
 */
export class ApiError extends ClientError {
  /** The URL that was requested. */
  readonly url: string;
  /** The HTTP status code of the response. */
  readonly status: number;
  /**
   * A human-readable message extracted from the response body, if any.
   *
   * Named `apiMessage` rather than `message` because `Error.message` is a required
   * `string`, while the extracted message is optional; `Error.message` still carries a
   * complete human-readable description (see the constructor).
   */
  readonly apiMessage?: string;
  /** Raw response body, truncated to a bounded length. */
  readonly payload: string;
  /**
   * The delay, in seconds, specified by the response's `Retry-After` header, if present
   * and parseable as a delay-seconds value (RFC 9110 §10.2.3). `undefined` when the
   * header is absent or in HTTP-date form.
   */
  readonly retryAfter?: number;

  constructor(
    url: string,
    status: number,
    apiMessage: string | undefined,
    payload: string,
    retryAfter: number | undefined,
  ) {
    super(`API request failed [${url}] (HTTP ${status}): ${apiMessage ?? payload}`);
    this.url = url;
    this.status = status;
    this.apiMessage = apiMessage;
    this.payload = payload;
    this.retryAfter = retryAfter;
  }
}
