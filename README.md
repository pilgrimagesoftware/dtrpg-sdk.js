# dtrpg-sdk.js

[![CI](https://github.com/pilgrimagesoftware/dtrpg-sdk.js/actions/workflows/ci.yaml/badge.svg)](https://github.com/pilgrimagesoftware/dtrpg-sdk.js/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Node/TypeScript SDK for the [DriveThruRPG API](https://api.drivethrurpg.com).

Requires Node.js 22+.

**Status: in development.** This repository currently provides the package scaffolding
(build, lint, type check, test, and release pipeline). Configuration, authentication/session
lifecycle, and the library client (orders, product lists, download preparation) are not yet
implemented — see [dtrpg-sdk.js#1](https://github.com/pilgrimagesoftware/dtrpg-sdk.js/issues/1)
for progress. For a complete reference implementation of the same API surface, see the
[Go](https://github.com/pilgrimagesoftware/dtrpg-sdk.go), [Rust](https://github.com/pilgrimagesoftware/dtrpg-sdk.rs),
or [Swift](https://github.com/pilgrimagesoftware/dtrpg-sdk.swift) SDKs.

## Installation

Not yet published to npm. Once released:

```bash
npm install dtrpg-sdk
```

## Building from source

This repository will use the `dtrpg-api` repository as a submodule (`API/`) once the
`dtrpg-api` integration lands, matching the pattern used by the Go/Rust/Swift SDKs. Clone
with submodules, or initialize them after cloning:

```bash
git clone --recursive https://github.com/pilgrimagesoftware/dtrpg-sdk.js.git

# or, if already cloned:
git submodule update --init --recursive
```

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
