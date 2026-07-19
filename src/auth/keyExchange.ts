/**
 * HTTP client for the DriveThruRPG authentication endpoint.
 *
 * {@link authenticate} exchanges a DriveThruRPG application key for a short-lived JWT
 * access token and a long-lived refresh token. It is the only SDK operation that does
 * not require a pre-existing session.
 */

import type { Config } from "../config.js";
import { DecodeFailedError, HttpError } from "../errors.js";

import type { AuthTokenResponse } from "./session.js";

/** Maximum number of characters logged from a failing auth response body. */
const LOG_PAYLOAD_LIMIT = 2_000;

function truncatedPayload(raw: string): string {
  return raw.length > LOG_PAYLOAD_LIMIT ? `${raw.slice(0, LOG_PAYLOAD_LIMIT)}… (truncated)` : raw;
}

function parseAuthTokenResponse(value: unknown): AuthTokenResponse {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("expected a JSON object");
  }
  const record = value as Record<string, unknown>;
  const { token, refreshToken, refreshTokenTTL } = record;
  if (typeof token !== "string") {
    throw new TypeError('expected "token" to be a string');
  }
  if (typeof refreshToken !== "string") {
    throw new TypeError('expected "refreshToken" to be a string');
  }
  if (typeof refreshTokenTTL !== "number") {
    throw new TypeError('expected "refreshTokenTTL" to be a number');
  }
  return { token, refreshToken, refreshTokenTtl: refreshTokenTTL };
}

/**
 * Exchanges a DriveThruRPG application key for a session token.
 *
 * Posts to `POST /{apiVersion}/auth_key` with `applicationKey` as a query parameter and
 * an empty JSON body (the API declares an `application/json` request body for this
 * endpoint, even though the key is passed as a query parameter). On success, returns the
 * JWT access token, refresh token, and refresh token TTL.
 *
 * @throws {@link HttpError} on transport failure (e.g. the network request itself fails).
 * @throws {@link DecodeFailedError} if the response body cannot be parsed into an
 * {@link AuthTokenResponse}, which includes non-success status responses since this
 * endpoint's body is always decoded against the same success schema.
 *
 * @example
 * ```ts
 * const config = new Config({ applicationKey: "my-app-key" });
 * const response = await authenticate("my-app-key", config);
 * console.log(response.token);
 * ```
 */
export async function authenticate(
  applicationKey: string,
  config: Config,
): Promise<AuthTokenResponse> {
  const url = new URL(`${config.baseUrl}/${config.apiVersion}/auth_key`);
  url.searchParams.set("applicationKey", applicationKey);
  const urlString = url.toString();

  let response: Response;
  try {
    response = await fetch(urlString, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  } catch (cause) {
    throw new HttpError(urlString, undefined, cause);
  }

  const status = response.status;
  const raw = await response.text();

  try {
    return parseAuthTokenResponse(JSON.parse(raw) as unknown);
  } catch (cause) {
    throw new DecodeFailedError(urlString, status, cause, truncatedPayload(raw));
  }
}
