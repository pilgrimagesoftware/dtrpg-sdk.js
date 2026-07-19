## Context

`dtrpg-sdk.rs` (v1.1.0) is the reference implementation for this API surface. This design ports its architecture to TypeScript, preserving its deliberate design decisions (see Decisions below) rather than re-deriving the API shape from scratch. Rust's module layout — `config.rs`, `sdk.rs`, `error.rs`, `auth/` (two independent flows), `library/` (client + models) — maps directly onto a TypeScript module layout.

Rust's `LibraryClient` is hand-written against the OpenAPI contract, not generated from it; `build.rs` only extracts the server URL and a path/method inventory for a single traceability test, with zero runtime effect on request behavior. TypeScript follows the same approach: hand-written client, `API/openapi.yaml` present as a submodule for traceability, no code generation pipeline.

## Goals / Non-Goals

**Goals:**
- Match the Rust SDK's public API shape (types, method names translated to TypeScript idiom, method signatures, error semantics) closely enough that a developer familiar with one SDK can predict the other's behavior.
- Preserve every deliberate Rust design decision listed below unless there's a TypeScript-specific reason to diverge (and if so, document it here, not silently).
- Ship with the same test rigor: unit tests for pure logic (session state transitions), integration-style tests against a local mock HTTP server for every client method (`msw`, matching the mocking approach already specified in `docs/typescript.md`).

**Non-Goals:**
- A dual sync/callback API. All I/O is `async`/`Promise`-based only — this is the TypeScript idiom, not a divergence requiring justification the way an async/sync split would in Python.
- Token auto-refresh. Rust doesn't implement it either — `refreshToken`/`refreshTokenTtl` are stored and exposed, not acted upon automatically.
- Environment-variable configuration. Matches Rust's explicit-config-only stance (`rust-sdk-configuration` spec: "configuration must be explicit before use").
- Code generation from `openapi.yaml`. The submodule is present for contract traceability, matching Rust; a generated client is out of scope here as it was for Rust.

## Decisions

**Decision: Module layout mirrors Rust's boundaries.**
```
src/
    index.ts            # public re-exports
    config.ts            # Config
    sdk.ts                # DriveThruRpgSdk-equivalent (session lifecycle orchestration)
    errors.ts              # SdkError, AuthSessionError hierarchy
    auth/
        index.ts
        session.ts            # AuthTokenResponse, AuthState, AuthSession, SessionTransition
        keyExchange.ts          # authenticate()
        credentialLogin.ts        # loginWithCredentials()
    library/
        index.ts
        client.ts                 # LibraryClient, ClientError
        models.ts                   # request/response/model types + parsers
```
Alternative considered: a flat `src/index.ts` with everything inlined. Rejected — Rust's separation (session orchestration knows nothing about HTTP; `LibraryClient` knows nothing about session state, just holds a token) is a load-bearing design decision (see Rust design decision #1), not incidental structure, and collapsing it would make an eventual token-refresh feature harder to add cleanly.

**Decision: `LibraryClient` takes `Config` + a bare token string, not a reference to the SDK object.**
Matches Rust exactly. This is what makes `LibraryClient` independently testable and constructible without going through the full session-lifecycle dance. `sdk.libraryClient()` is the only sanctioned way to build one in normal use, but nothing prevents direct construction for tests.

**Decision: Plain TypeScript interfaces/types for models, hand-written `parseX`/`toWireX` functions for (de)serialization — no runtime validation library (zod, etc.) in this initial implementation.**
Alternative considered: `zod` schemas for automatic runtime validation and camelCase/JSON-field mapping. Rejected for this initial implementation — Rust's models are plain structs with `serde` doing purely mechanical field mapping, no validation logic beyond type-correctness; TypeScript's compile-time types already give the same "shape contract" documentation value `zod` would add, and a hand-written `parseOrderProductItem(json: unknown): OrderProductItem` mirrors `serde`'s mechanical-mapping behavior (throwing `ClientError` subclasses on shape mismatch, same as Rust's `DecodeFailed`) without a new dependency. Revisit if the model surface grows enough that hand-written parsers become a maintenance burden or a source of subtle bugs zod would have caught — that's a legitimate reason to add it later, but not a reason to start with it.

**Decision: native `fetch` (Node 22+ built-in), not axios/node-fetch.**
Matches `docs/typescript.md`'s stack decision already recorded for this SDK. `Retry-After` header access: `response.headers.get("Retry-After")`.

**Decision: Two-tier session invalidation (`clearSession` vs `invalidateSession`) ported as-is.**
`clearSession()` — silent logout. `invalidateSession(error: AuthSessionError): AuthSessionError` — throws an `SdkError` subclass if no session exists, otherwise clears and returns the same error it was given (does not classify it). No TypeScript-specific reason to collapse this to one method; preserves parity with Rust's documented three-way distinction (silent clear / structured invalidate / reserved `AuthSession.invalidate` transition primitive for future token-refresh-in-place).

**Decision: `prepareDownload(orderProductId, index)` — `index` is a required parameter, no default.**
Directly ports Rust's documented decision (`dtrpg-sdk.rs`'s `2026-07-10-prepare-download-file-index` design doc): a default of `0` is unsafe for multi-file bundles and was explicitly rejected there. Same reasoning applies here — do not add `index: number = 0`.

**Decision: Errors as a typed exception hierarchy (`class ... extends Error`), matching `docs/typescript.md`'s existing convention.**
`SdkError` base class with subclasses `UnconfiguredError`, `UnauthenticatedError`; `ClientError` base class with subclasses `HttpError`, `InvalidCredentialsError`, `ApplicationKeyRequestFailedError`, `DecodeFailedError`, `ApiError` (carrying a `retryAfter?: number` field, seconds). Callers `instanceof`-check or switch on a `code` discriminant field, per `docs/typescript.md`'s "typed error hierarchy" rule.

**Decision: Bearer token sent without a `Bearer ` prefix.**
Ported verbatim from Rust — documented API-specific quirk (`Authorization: <raw JWT>`), not a bug to "fix" in the port.

**Decision: `Retry-After` — delay-seconds form only, matching Rust's explicit scope decision.**
No date-parsing dependency added for a form the API is judged unlikely to send on 429s. If this proves wrong in practice, broaden explicitly (update this doc), don't silently patch around it.

**Decision: JSON:API envelope handling stays per-endpoint, not a generic `Envelope<T>`.**
Matches Rust's documented experience (`create_product_list` needed its own envelope after a live-payload failure that a generic wrapper would have masked). Each response type that needs envelope-unwrapping gets its own `parseX` handling that decision explicitly, verified against the same fixtures/mocks Rust uses where available.

## Risks / Trade-offs

- [Risk] Hand-written parsers mean a `dtrpg-api` contract change requires a manual TypeScript-side update, with no schema-validation library catching a shape mismatch at parse time the way `serde` would in Rust. → Mitigation: TypeScript's structural typing catches call-site misuse of the parsed result; the `msw`-backed test suite exercises every model against realistic fixture payloads, same as Rust's `wiremock` tests.
- [Risk] No runtime validation means a malformed API response could produce a TypeScript object that type-checks but has the wrong runtime shape (e.g. a field silently `undefined` where a string was expected), since hand-written parsers can have gaps a schema validator wouldn't. → Mitigation: parsers explicitly check required fields and throw `DecodeFailedError` on absence, rather than trusting `as` casts; this is exactly the discipline `serde`'s missing-field errors enforce automatically in Rust, applied by hand here.

## Migration Plan

Not applicable — net-new capability in a package that previously had none. No existing consumers to migrate.

## Open Questions

- Whether to add `zod` once the model surface grows: revisit if hand-written parsers become unwieldy or a source of bugs; not a blocker now.
