---
title: Quick start
version: latest
slug: quickstart
---

# Quick start

```ts
import { Config, DriveThruRpgSdk, authenticate } from "@pilgrimagesoftware/dtrpg-sdk";

// 1. Configure the SDK with your application key.
const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "my-app-key" }));

// 2. Exchange the application key for a session token, then store it on the SDK.
const response = await authenticate("my-app-key", sdk.requireConfig());
const session = sdk.applyAuthResponse(response);
console.log(session.token);

// 3. Create an authenticated library client and make a request.
const client = sdk.libraryClient();
const library = await client.listOrderProducts({ page: 1, pageSize: 25 });
console.log(library.data.length, "items");
```

`DriveThruRpgSdk` is the root object: it holds [configuration]({{ '/latest/authentication/' | relative_url }})
and the active session, and vends a [`LibraryClient`]({{ '/latest/library-client/' | relative_url }})
once authenticated.

## Pointing at a different endpoint

Pass `baseUrl` and/or `apiVersion` to `Config` to target a local test server
or a different API version:

```ts
const config = new Config({
  applicationKey: "my-app-key",
  baseUrl: "http://localhost:8080/api",
  apiVersion: "v1",
});
```

## Handling errors

Every SDK call can throw a typed error. See [Errors]({{ '/latest/errors/' | relative_url }})
for the full hierarchy and recommended handling:

```ts
import { ApiError, UnauthenticatedError } from "@pilgrimagesoftware/dtrpg-sdk";

try {
  const client = sdk.libraryClient();
  await client.listOrderProducts();
} catch (error) {
  if (error instanceof UnauthenticatedError) {
    // No active session - re-authenticate.
  } else if (error instanceof ApiError) {
    console.error(`API error ${error.status}: ${error.apiMessage ?? error.payload}`);
  } else {
    throw error;
  }
}
```
