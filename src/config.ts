/**
 * SDK configuration types.
 *
 * {@link Config} holds the application-level settings required to make requests to the
 * DriveThruRPG API: the publisher/application key, the API base URL, and the API version
 * segment used in request URLs.
 */

/** The production DriveThruRPG API base URL used when no custom URL is provided. */
export const DEFAULT_BASE_URL = "https://api.drivethrurpg.com/api";

/** The API version path segment used when no custom version is provided. */
export const DEFAULT_API_VERSION = "vBeta";

/** Constructor options for {@link Config}. */
export interface ConfigOptions {
  /** The application key used to identify this client to the API. */
  applicationKey: string;
  /** The base URL that SDK requests will be sent to. Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** The API version path segment used when constructing endpoint URLs. Defaults to {@link DEFAULT_API_VERSION}. */
  apiVersion?: string;
}

/**
 * Configuration for the DriveThruRPG SDK.
 *
 * A `Config` must be provided to {@link DriveThruRpgSdk} before any authenticated API
 * calls can be made. It binds an application key to an API endpoint, defaulting to
 * the production DriveThruRPG API and the current `"vBeta"` API version.
 *
 * Configuration is explicit-constructor-only: there is no environment-variable or
 * config-file fallback for `applicationKey` or any other field.
 *
 * @example
 * ```ts
 * // Use the production API with your application key.
 * const config = new Config({ applicationKey: "my-app-key" });
 *
 * // Point at a local test server instead.
 * const staging = new Config({
 *   applicationKey: "my-app-key",
 *   baseUrl: "http://localhost:8080/api",
 * });
 * ```
 */
export class Config {
  /** The application key used to identify this client to the API. */
  readonly applicationKey: string;
  /** The base URL that SDK requests will be sent to. */
  readonly baseUrl: string;
  /**
   * The API version path segment used when constructing endpoint URLs.
   *
   * This value is inserted between the base URL and the resource path:
   * `{baseUrl}/{apiVersion}/{resource}`. Defaults to `"vBeta"`.
   */
  readonly apiVersion: string;

  constructor(options: ConfigOptions) {
    this.applicationKey = options.applicationKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
  }
}
