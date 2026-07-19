/**
 * The primary SDK entry point.
 *
 * {@link DriveThruRpgSdk} is the root object that holds SDK configuration and manages the
 * active authentication session. Start here when integrating the DriveThruRPG API into
 * your application.
 */

import { AuthSession, type AuthSessionError, type AuthTokenResponse } from "./auth/session.js";
import type { Config } from "./config.js";
import { UnauthenticatedError, UnconfiguredError } from "./errors.js";
import { LibraryClient } from "./library/client.js";

/**
 * The DriveThruRPG SDK client.
 *
 * `DriveThruRpgSdk` coordinates SDK-level configuration and authentication session
 * lifecycle. It must be configured before any authenticated API calls can succeed.
 *
 * # Lifecycle
 *
 * 1. Create an SDK instance, optionally supplying {@link Config} upfront.
 * 2. After a successful API login, call {@link applyAuthResponse} to store the session.
 * 3. Use {@link requireSession} to obtain the active session before making requests.
 * 4. Call {@link invalidateSession} when the API reports a session error, or
 *    {@link clearSession} to log out.
 *
 * @example
 * ```ts
 * const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "my-app-key" }));
 * const response = { token: "jwt", refreshToken: "refresh", refreshTokenTtl: 9_999_999_999 };
 * const session = sdk.applyAuthResponse(response);
 * console.log(session.token);
 * ```
 */
export class DriveThruRpgSdk {
  private currentConfig?: Config;
  private currentSession?: AuthSession;

  /**
   * Creates an unconfigured SDK instance.
   *
   * Call {@link configure} before making any API calls, or prefer {@link withConfig} if
   * the configuration is available at construction time.
   */
  constructor() {
    this.currentConfig = undefined;
    this.currentSession = undefined;
  }

  /** Creates an SDK instance pre-loaded with the given {@link Config}. */
  static withConfig(config: Config): DriveThruRpgSdk {
    const sdk = new DriveThruRpgSdk();
    sdk.currentConfig = config;
    return sdk;
  }

  /**
   * Sets or replaces the SDK's configuration.
   *
   * This can be called at any time, including after the SDK has been used. Replacing
   * the configuration does not automatically clear an existing session.
   */
  configure(config: Config): void {
    this.currentConfig = config;
  }

  /** Returns the current configuration, or `undefined` if the SDK is unconfigured. */
  get config(): Config | undefined {
    return this.currentConfig;
  }

  /** Returns the current authentication session, or `undefined` if unauthenticated. */
  get session(): AuthSession | undefined {
    return this.currentSession;
  }

  /**
   * Returns the current configuration.
   *
   * Use this in call chains where a missing config should surface as an error.
   *
   * @throws {@link UnconfiguredError} if the SDK has not been configured.
   */
  requireConfig(): Config {
    if (this.currentConfig === undefined) {
      throw new UnconfiguredError();
    }
    return this.currentConfig;
  }

  /**
   * Returns the current session.
   *
   * Use this in call chains where a missing session should surface as an error.
   *
   * @throws {@link UnauthenticatedError} if there is no active session.
   */
  requireSession(): AuthSession {
    if (this.currentSession === undefined) {
      throw new UnauthenticatedError();
    }
    return this.currentSession;
  }

  /**
   * Stores a new authentication session derived from a raw API token response.
   *
   * @throws {@link UnconfiguredError} if the SDK has not been configured yet.
   * @returns The newly stored session.
   */
  applyAuthResponse(response: AuthTokenResponse): AuthSession {
    this.requireConfig();
    this.currentSession = AuthSession.fromApiResponse(response);
    return this.currentSession;
  }

  /**
   * Removes the current authentication session without recording an error.
   *
   * Use this for voluntary log-out flows. For API-reported session failures, prefer
   * {@link invalidateSession}.
   */
  clearSession(): void {
    this.currentSession = undefined;
  }

  /**
   * Removes the current session and records the API-reported error that caused it.
   *
   * @throws {@link UnauthenticatedError} if there is no session to invalidate.
   * @returns The provided `error`, unmodified, so callers can inspect or propagate it.
   */
  invalidateSession(error: AuthSessionError): AuthSessionError {
    this.requireSession();
    this.clearSession();
    return error;
  }

  /**
   * Creates a {@link LibraryClient} from the current configuration and session.
   *
   * @throws {@link UnconfiguredError} if the SDK has not been configured.
   * @throws {@link UnauthenticatedError} if there is no active session.
   */
  libraryClient(): LibraryClient {
    const config = this.requireConfig();
    const token = this.requireSession().token;
    return new LibraryClient(config, token);
  }
}
