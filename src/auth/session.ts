/**
 * Authentication types for the DriveThruRPG SDK.
 *
 * This module provides the core types for representing and managing the authentication
 * lifecycle with the DriveThruRPG API:
 *
 * - {@link AuthTokenResponse} — the raw token payload received from the API after a
 *   successful login.
 * - {@link AuthState} — a union of authentication failure states reported by the API.
 * - {@link AuthSessionError} — a structured error carrying the API's error code, message,
 *   and {@link AuthState} classification.
 * - {@link AuthSession} — an active, validated session derived from an
 *   {@link AuthTokenResponse}.
 * - {@link SessionTransition} — the result of invalidating a session, carrying the error
 *   that caused the transition and an optional replacement session.
 */

/**
 * The raw authentication token payload returned by the DriveThruRPG API.
 *
 * This is a direct representation of the API response fields. Callers should convert
 * it into an {@link AuthSession} via {@link AuthSession.fromApiResponse} before treating
 * the session as active.
 */
export interface AuthTokenResponse {
  /** The short-lived JWT access token used to authenticate API requests. */
  token: string;
  /** The long-lived refresh token used to obtain a new access token. */
  refreshToken: string;
  /** Unix timestamp (seconds) at which the refresh token expires. */
  refreshTokenTtl: number;
}

/**
 * The authentication failure state reported by the DriveThruRPG API.
 *
 * Each value matches the corresponding string sent by the API protocol. Use this to
 * understand *why* a session was invalidated and decide how to recover.
 */
export type AuthState =
  /** No authentication credentials are present. */
  | "unauthenticated"
  /** The provided access token is structurally invalid or unrecognized. */
  | "token_invalid"
  /** The access token has passed its expiry time and must be refreshed. */
  | "token_expired"
  /** The refresh token has passed its expiry time; the user must re-authenticate. */
  | "refresh_expired"
  /** The credentials are valid but the caller lacks permission for the requested resource. */
  | "unauthorized";

/**
 * A structured authentication error returned by the DriveThruRPG API.
 *
 * This type carries the machine-readable `errorCode`, a human-readable `message`, and
 * an {@link AuthState} that classifies the failure. It is used when the API explicitly
 * rejects an operation due to an auth-related condition.
 */
export class AuthSessionError extends Error {
  /** The machine-readable error code from the API (e.g. `"token_expired"`). */
  readonly errorCode: string;
  /** The {@link AuthState} classification for this error. */
  readonly authState: AuthState;

  constructor(errorCode: string, message: string, authState: AuthState) {
    super(`${message} (${errorCode}) [${authState}]`);
    this.name = "AuthSessionError";
    this.errorCode = errorCode;
    this.authState = authState;
  }
}

/**
 * An active authentication session with the DriveThruRPG API.
 *
 * `AuthSession` is the validated, runtime representation of an authenticated user. It
 * is obtained by calling `DriveThruRpgSdk.applyAuthResponse` with a token response from
 * the API.
 */
export class AuthSession {
  /** The short-lived JWT access token for this session. */
  readonly token: string;
  /** The long-lived refresh token for this session. */
  readonly refreshToken: string;
  /** The Unix timestamp (seconds) at which the refresh token expires. */
  readonly refreshTokenTtl: number;

  private constructor(token: string, refreshToken: string, refreshTokenTtl: number) {
    this.token = token;
    this.refreshToken = refreshToken;
    this.refreshTokenTtl = refreshTokenTtl;
  }

  /** Creates an `AuthSession` from a raw {@link AuthTokenResponse}. */
  static fromApiResponse(response: AuthTokenResponse): AuthSession {
    return new AuthSession(response.token, response.refreshToken, response.refreshTokenTtl);
  }

  /**
   * Returns `true` if `unixTimestamp` is at or past the refresh token's expiry.
   *
   * Use the current wall-clock time (as a Unix timestamp, seconds) to determine whether
   * the session's refresh token is still usable.
   */
  refreshTokenExpiredAt(unixTimestamp: number): boolean {
    return unixTimestamp >= this.refreshTokenTtl;
  }

  /**
   * Produces a {@link SessionTransition} representing this session's invalidation.
   *
   * The resulting transition has no replacement session (`nextSession` is `undefined`)
   * and carries the provided `error` describing why the session was invalidated.
   *
   * This is a lower-level primitive for code working with an owned {@link AuthSession}
   * directly. `DriveThruRpgSdk.invalidateSession` is the higher-level equivalent for
   * callers going through the SDK: it does not build a {@link SessionTransition}, and
   * unconditionally clears the stored session rather than leaving room for a
   * `nextSession` replacement.
   */
  invalidate(error: AuthSessionError): SessionTransition {
    return { nextSession: undefined, error };
  }
}

/**
 * The outcome of invalidating an {@link AuthSession}.
 *
 * A `SessionTransition` is returned when a session ends due to an error. It records the
 * error that caused the invalidation and an optional replacement session (for cases
 * where token refresh succeeds mid-invalidation).
 */
export interface SessionTransition {
  /**
   * The replacement session, if one was established as part of this transition.
   *
   * This is `undefined` when the session was simply terminated without a refresh.
   */
  nextSession?: AuthSession;
  /** The error that caused this session transition. */
  error: AuthSessionError;
}
