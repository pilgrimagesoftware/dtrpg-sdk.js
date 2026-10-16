---
title: Installation
version: latest
slug: install
---

# Installation

```bash
npm install @pilgrimagesoftware/dtrpg-sdk
```

Requires Node.js 22+.

## Building from source

This repository uses the `dtrpg-api` repository as a submodule (`API/`),
matching the pattern used by the Go/Rust/Swift SDKs. Clone with submodules,
or initialize them after cloning:

```bash
git clone --recursive https://github.com/pilgrimagesoftware/dtrpg-sdk.js.git

# or, if already cloned:
git submodule update --init --recursive
```

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

See the [repository README](https://github.com/pilgrimagesoftware/dtrpg-sdk.js)
for the full set of development conventions this project follows.
