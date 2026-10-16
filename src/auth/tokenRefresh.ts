/**
 * HTTP client for the DriveThruRPG token refresh endpoint.
 *
 * {@link refresh} exchanges a refresh token for a new access token, so a session can be
 * extended without repeating the application-key exchange.
 *
 * The refresh endpoint is not described by the bundled OpenAPI document. Its shape is
 * inferred from the `Set-Cookie` header on the `auth_key` response, which scopes the
 * `refreshToken` cookie to `/api/vBeta/auth/refresh`: the token is sent back as that
 * cookie, and the response is assumed to carry the same payload as `auth_key`.
 */

import type { Config } from "../config.js";
import { HttpError } from "../errors.js";

import { decodeTokenResponse } from "./keyExchange.js";
import type { AuthTokenResponse } from "./session.js";

/**
 * Exchanges a refresh token for a new access token.
 *
 * Posts to `POST /{apiVersion}/auth/refresh` with the token in a `refreshToken` cookie.
 * On success, returns a new access token together with the refresh token and expiry the
 * API now considers current; callers should store all three, because the API may rotate
 * the refresh token.
 *
 * Sending a `Cookie` header works in Node, but browsers forbid setting it from script, so
 * this call is for server-side use.
 *
 * @throws {@link HttpError} on transport failure.
 * @throws {@link DecodeFailedError} if the response body cannot be parsed, which includes
 * an error response such as `401` for an expired or revoked refresh token.
 *
 * @example
 * ```ts
 * const config = new Config({ applicationKey: "my-app-key" });
 * const response = await refresh("my-refresh-token", config);
 * console.log(response.token);
 * ```
 */
export async function refresh(refreshToken: string, config: Config): Promise<AuthTokenResponse> {
  const url = `${config.baseUrl}/${config.apiVersion}/auth/refresh`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${refreshToken}`,
      },
      body: JSON.stringify({}),
    });
  } catch (cause) {
    throw new HttpError(url, undefined, cause);
  }

  return decodeTokenResponse(url, response.status, await response.text());
}
