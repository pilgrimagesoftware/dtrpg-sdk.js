# dtrpg-sdk.js

[![CI](https://github.com/pilgrimagesoftware/dtrpg-sdk.js/actions/workflows/ci.yaml/badge.svg)](https://github.com/pilgrimagesoftware/dtrpg-sdk.js/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Node/TypeScript SDK for the [DriveThruRPG API](https://api.drivethrurpg.com).

Provides configuration, authentication/session lifecycle, and an async library client for
listing orders, product lists, and preparing downloads.

Requires Node.js 22+.

## Installation

```bash
npm install @pilgrimagesoftware/dtrpg-sdk
```

## Building from source

This repository uses the `dtrpg-api` repository as a submodule (`API/`), matching the
pattern used by the Go/Rust/Swift SDKs. Clone with submodules, or initialize them after
cloning:

```bash
git clone --recursive https://github.com/pilgrimagesoftware/dtrpg-sdk.js.git

# or, if already cloned:
git submodule update --init --recursive
```

## Quick Start

```ts
import { Config, DriveThruRpgSdk, authenticate } from "@pilgrimagesoftware/dtrpg-sdk";

const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "my-app-key" }));

// Exchange your application key for a session token, then store it on the SDK.
const response = await authenticate("my-app-key", sdk.requireConfig());
const session = sdk.applyAuthResponse(response);
console.log(session.token);

// Create an authenticated library client:
const client = sdk.libraryClient();
const library = await client.listOrderProducts({ page: 1, pageSize: 25 });
```

See the package's TSDoc comments (published alongside the type declarations) for the full
API reference, including `Config`, `AuthSession`/`AuthState`, `LibraryClient`, and the
library model types (`OrderProductItem`, `ProductListItem`, etc.).

## Development

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

See [docs/typescript.md](https://github.com/pilgrimagesoftware/dtrpg/blob/master/docs/typescript.md)
in the umbrella repo for the full set of conventions this project follows.

## Release Process

See [RELEASE.md](RELEASE.md).

## License

MIT — see [LICENSE](LICENSE).
