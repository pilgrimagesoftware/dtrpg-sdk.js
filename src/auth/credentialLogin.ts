/**
 * Website credential exchange for DriveThruRPG.
 *
 * This module targets `www.drivethrurpg.com` — **not** `api.drivethrurpg.com`. It wraps
 * the two website login endpoints that DriveThruRPG's own login page uses to turn an
 * email/password pair into an application key.
 *
 * This is distinct from `keyExchange`, which exchanges an application key for a
 * short-lived JWT against `api.drivethrurpg.com`. {@link loginWithCredentials} produces
 * the application key that `keyExchange.authenticate` then exchanges for a session
 * token; the two modules are complementary, not overlapping.
 */

import type { Config } from "../config.js";
import {
  ApplicationKeyRequestFailedError,
  DecodeFailedError,
  HttpError,
  InvalidCredentialsError,
} from "../errors.js";

/** Base URL for the DriveThruRPG website login endpoints. */
const WEBSITE_BASE_URL = "https://www.drivethrurpg.com";

/** Maximum number of characters preserved in a decode-failure log payload. */
const LOG_PAYLOAD_LIMIT = 2_000;

/**
 * Typed response from `POST /validate_login_credentials.php`.
 *
 * The endpoint returns a bare JSON array (not an object). Field order per
 * `dtrpg-api/LOGIN.md`: `[fieldName, ok, message, locked]`.
 *
 * Example: `["password", true, "Locked", true]`
 */
interface ValidateLoginResponse {
  /** The field that was validated (e.g. `"password"`). */
  fieldName: string;
  /** Whether the credentials are valid. */
  ok: boolean;
  /** Status message from the server (e.g. `"Locked"`). */
  message: string;
  /** Whether the account is locked. */
  locked: boolean;
}

function parseValidateLoginResponse(value: unknown): ValidateLoginResponse {
  if (!Array.isArray(value) || value.length < 4) {
    throw new TypeError("expected a 4-element JSON array [fieldName, ok, message, locked]");
  }
  const [fieldName, ok, message, locked] = value as unknown[];
  if (typeof fieldName !== "string") {
    throw new TypeError("expected element 0 (fieldName) to be a string");
  }
  if (typeof ok !== "boolean") {
    throw new TypeError("expected element 1 (ok) to be a boolean");
  }
  if (typeof message !== "string") {
    throw new TypeError("expected element 2 (message) to be a string");
  }
  if (typeof locked !== "boolean") {
    throw new TypeError("expected element 3 (locked) to be a boolean");
  }
  return { fieldName, ok, message, locked };
}

/** Typed response from `POST /create_account_app.php`. */
interface CreateAccountAppResponse {
  status: string;
  key: string;
}

function parseCreateAccountAppResponse(value: unknown): CreateAccountAppResponse {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("expected a JSON object");
  }
  const { status, message } = value as Record<string, unknown>;
  if (typeof status !== "string") {
    throw new TypeError('expected "status" to be a string');
  }
  if (typeof message !== "object" || message === null) {
    throw new TypeError('expected "message" to be an object');
  }
  const { key } = message as Record<string, unknown>;
  if (typeof key !== "string") {
    throw new TypeError('expected "message.key" to be a string');
  }
  return { status, key };
}

function truncatedPayload(raw: string): string {
  return raw.length > LOG_PAYLOAD_LIMIT ? `${raw.slice(0, LOG_PAYLOAD_LIMIT)}… (truncated)` : raw;
}

/**
 * Exchanges an email/password pair for a DriveThruRPG application key.
 *
 * Calls `POST /validate_login_credentials.php` on `www.drivethrurpg.com`. If credentials
 * are valid, calls `POST /create_account_app.php` and returns the application key from
 * `message.key`. Both requests use `multipart/form-data` with `email_address` and
 * `password` fields, per `dtrpg-api/LOGIN.md`.
 *
 * `config` is currently unused: this function always targets `www.drivethrurpg.com`,
 * since the website login endpoints live on a separate origin from the
 * `api.drivethrurpg.com` endpoint that {@link Config} describes. It is kept in the
 * signature for symmetry with `keyExchange.authenticate` and to leave room for a
 * configurable website origin later without a breaking API change.
 *
 * @throws {@link HttpError} on any transport failure.
 * @throws {@link InvalidCredentialsError} if `validate_login_credentials.php` indicates
 * the credentials are invalid — `create_account_app.php` is never called in this case.
 * @throws {@link ApplicationKeyRequestFailedError} if credentials pass validation but
 * `create_account_app.php` returns a non-success status.
 * @throws {@link DecodeFailedError} if a response body cannot be parsed.
 *
 * @example
 * ```ts
 * const config = new Config({ applicationKey: "placeholder" });
 * const applicationKey = await loginWithCredentials("user@example.com", "secret", config);
 * ```
 */
export async function loginWithCredentials(
  email: string,
  password: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: Config,
): Promise<string> {
  return doLogin(email, password, WEBSITE_BASE_URL);
}

/** @internal Exported for testing against a local mock server base URL. */
export async function doLogin(email: string, password: string, baseUrl: string): Promise<string> {
  const validateUrl = `${baseUrl}/validate_login_credentials.php`;
  const validateForm = new FormData();
  validateForm.set("email_address", email);
  validateForm.set("password", password);

  let validateResponse: Response;
  try {
    validateResponse = await fetch(validateUrl, { method: "POST", body: validateForm });
  } catch (cause) {
    throw new HttpError(validateUrl, undefined, cause);
  }
  const validateStatus = validateResponse.status;
  const validateRaw = await validateResponse.text();

  let validated: ValidateLoginResponse;
  try {
    validated = parseValidateLoginResponse(JSON.parse(validateRaw) as unknown);
  } catch (cause) {
    throw new DecodeFailedError(validateUrl, validateStatus, cause, truncatedPayload(validateRaw));
  }

  if (!validated.ok) {
    throw new InvalidCredentialsError();
  }

  const keyUrl = `${baseUrl}/create_account_app.php`;
  const keyForm = new FormData();
  keyForm.set("email_address", email);
  keyForm.set("password", password);

  let keyResponse: Response;
  try {
    keyResponse = await fetch(keyUrl, { method: "POST", body: keyForm });
  } catch (cause) {
    throw new HttpError(keyUrl, undefined, cause);
  }
  const keyStatus = keyResponse.status;
  const keyRaw = await keyResponse.text();

  let keyResult: CreateAccountAppResponse;
  try {
    keyResult = parseCreateAccountAppResponse(JSON.parse(keyRaw) as unknown);
  } catch (cause) {
    throw new DecodeFailedError(keyUrl, keyStatus, cause, truncatedPayload(keyRaw));
  }

  if (keyResult.status !== "success") {
    throw new ApplicationKeyRequestFailedError(keyResult.status);
  }

  return keyResult.key;
}
