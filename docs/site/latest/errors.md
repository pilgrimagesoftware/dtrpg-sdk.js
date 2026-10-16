---
title: Errors
version: latest
slug: errors
---

# Errors

The SDK throws typed errors across two hierarchies. Use `instanceof` to
distinguish failure kinds.

## SDK lifecycle errors (`SdkError`)

Thrown by SDK methods that depend on configuration or an active session.

- `UnconfiguredError` - the SDK has no `Config` yet. Call `configure` or
  construct with `DriveThruRpgSdk.withConfig`.
- `UnauthenticatedError` - the SDK has no active session. Call
  `applyAuthResponse` with a successful token response first.

## Session errors (`AuthSessionError`)

Thrown or returned when the API explicitly reports an auth-related
failure. Carries `errorCode`, `message`, and an `authState` classification:
`"unauthenticated"`, `"token_invalid"`, `"token_expired"`,
`"refresh_expired"`, or `"unauthorized"`.

## HTTP/transport errors (`ClientError`)

Thrown by HTTP-transport-facing operations: `authenticate`,
`loginWithCredentials`, and every `LibraryClient` method.

- `HttpError` - a network-level failure, or a non-success status from a
  status-check-only endpoint (e.g. a `DELETE`) that doesn't attempt to parse
  a structured error body. Carries `url`, an optional `status`, and an
  optional `cause`.
- `DecodeFailedError` - the response had a success status but its body
  couldn't be parsed into the expected type. Carries `url`, `status`,
  `cause`, and a truncated `payload` for diagnosis.
- `ApiError` - the API returned a non-success status with a parseable body.
  Carries `url`, `status`, an optional `apiMessage` extracted from the body,
  a truncated `payload`, and an optional `retryAfter` (seconds, parsed from
  a `Retry-After` header in delay-seconds form).
- `InvalidCredentialsError` - `loginWithCredentials` only: the provided
  email/password was rejected.
- `ApplicationKeyRequestFailedError` - `loginWithCredentials` only:
  credentials passed validation but the application-key request itself
  failed. Carries the API's returned `status` string.

## Example

```ts
import {
  ApiError,
  DecodeFailedError,
  HttpError,
  UnauthenticatedError,
  UnconfiguredError,
} from "@pilgrimagesoftware/dtrpg-sdk";

try {
  const client = sdk.libraryClient();
  await client.listOrderProducts();
} catch (error) {
  if (error instanceof UnconfiguredError || error instanceof UnauthenticatedError) {
    // SDK lifecycle issue - configure or re-authenticate.
  } else if (error instanceof ApiError) {
    console.error(`API error ${error.status}: ${error.apiMessage ?? error.payload}`);
  } else if (error instanceof DecodeFailedError) {
    console.error(`unexpected response shape: ${error.payload}`);
  } else if (error instanceof HttpError) {
    console.error(`request failed: ${error.cause}`);
  } else {
    throw error;
  }
}
```
