---
title: Authentication
version: latest
slug: authentication
---

# Authentication

The SDK supports two ways to obtain a session, and a lifecycle for managing
it once established.

## Application key exchange

If you already have a DriveThruRPG application key, exchange it for a
session token with `authenticate`:

```ts
import { authenticate, Config } from "@pilgrimagesoftware/dtrpg-sdk";

const config = new Config({ applicationKey: "my-app-key" });
const response = await authenticate("my-app-key", config);
// response: { token, refreshToken, refreshTokenTtl }
```

This posts to `POST /{apiVersion}/auth_key` against `api.drivethrurpg.com`
and returns a short-lived JWT access token alongside a long-lived refresh
token.

## Credential login

If you only have a DriveThruRPG email/password pair, exchange it for an
application key first with `loginWithCredentials`:

```ts
import { Config, loginWithCredentials } from "@pilgrimagesoftware/dtrpg-sdk";

const config = new Config({ applicationKey: "placeholder" });
const applicationKey = await loginWithCredentials("user@example.com", "secret", config);
```

This targets `www.drivethrurpg.com` (not the API host) and wraps the two
website login endpoints DriveThruRPG's own login page uses. The resulting
application key feeds into `authenticate` above.

## Session lifecycle

`DriveThruRpgSdk` owns the active session once established:

```ts
import { Config, DriveThruRpgSdk } from "@pilgrimagesoftware/dtrpg-sdk";

const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "my-app-key" }));
const session = sdk.applyAuthResponse(response);

// Use the session elsewhere:
const token = sdk.requireSession().token;

// Voluntary log-out:
sdk.clearSession();

// API reported a session error (expired/invalid token):
sdk.invalidateSession(sessionError);
```

- `applyAuthResponse` stores a new session from a raw token response and
  requires the SDK to already be configured.
- `requireSession` returns the active session or throws `UnauthenticatedError`.
- `clearSession` removes the session without recording a cause - use it for
  voluntary log-out.
- `invalidateSession` removes the session and records the API-reported error
  that caused it - use it when the API responds with a session failure.

`AuthSession.refreshTokenExpiredAt(unixTimestamp)` checks whether the
session's refresh token is still usable, given the current wall-clock time.

## Refreshing a session

An access token is short-lived. To renew it without repeating the application-key
exchange, call `sdk.refreshSession()`. It sends the session's refresh token to the API and
replaces the stored session with the response, including the new refresh token and expiry.

```ts
try {
  await sdk.refreshSession();
} catch (error) {
  if (error instanceof DecodeFailedError) {
    // The refresh token was rejected; fall back to authenticate() with the
    // application key. The existing session is left in place.
  }
}

// Clients created before the refresh still hold the old token.
const client = sdk.libraryClient();
```

`refresh(refreshToken, config)` makes the same call without an SDK instance. It sends a
`Cookie` header, which Node allows but browsers do not, so use it server-side.
