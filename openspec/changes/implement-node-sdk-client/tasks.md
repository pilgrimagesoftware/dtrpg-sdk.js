## 1. Setup

- [ ] 1.1 Add the `dtrpg-api` submodule under `API/` (`git submodule add git@github.com:pilgrimagesoftware/dtrpg-api.git API`)
- [ ] 1.2 Add `msw` as a dev dependency for mock-server tests
- [ ] 1.3 Create the `src/{auth,library}/` directory structure with `index.ts` barrel files

## 2. Configuration

- [ ] 2.1 Implement `Config` in `config.ts`: `applicationKey`, `baseUrl` (default `https://api.drivethrurpg.com/api`), `apiVersion` (default `vBeta`), readonly class/interface, no env-var fallback
- [ ] 2.2 Unit tests: default values, custom `baseUrl`, no environment fallback

## 3. Errors

- [ ] 3.1 Implement `SdkError` base + `UnconfiguredError`, `UnauthenticatedError` in `errors.ts`
- [ ] 3.2 Implement `ClientError` base + `HttpError`, `InvalidCredentialsError`, `ApplicationKeyRequestFailedError`, `DecodeFailedError`, `ApiError` (with `retryAfter?: number`) in `errors.ts`
- [ ] 3.3 Implement `AuthSessionError` (`errorCode`, `message`, `authState`) and `AuthState` union type (`"unauthenticated" | "token_invalid" | "token_expired" | "refresh_expired" | "unauthorized"`) in `auth/session.ts`

## 4. Auth / session lifecycle

- [ ] 4.1 Implement `AuthTokenResponse` (token, refreshToken, refreshTokenTtl) in `auth/session.ts`
- [ ] 4.2 Implement `AuthSession` (`fromApiResponse`, `token`, `refreshToken`, `refreshTokenTtl`, `refreshTokenExpiredAt`, `invalidate` → `SessionTransition`) in `auth/session.ts`
- [ ] 4.3 Implement `keyExchange.authenticate(applicationKey, config): Promise<AuthTokenResponse>` (`POST {baseUrl}/{apiVersion}/auth_key?applicationKey=...`, empty JSON body, against the API host) in `auth/keyExchange.ts`
- [ ] 4.4 Implement `credentialLogin.loginWithCredentials(email, password, config): Promise<string>` (two-step website-host exchange: `validate_login_credentials.php` then `create_account_app.php`, throwing `InvalidCredentialsError`/`ApplicationKeyRequestFailedError` as appropriate) in `auth/credentialLogin.ts`
- [ ] 4.5 Implement `DriveThruRpgSdk` in `sdk.ts`: constructor, `withConfig`, `configure`, `config`, `session`, `requireConfig`, `requireSession`, `applyAuthResponse`, `clearSession`, `invalidateSession`, `libraryClient`
- [ ] 4.6 Unit tests: session state transitions (unconfigured → configured → authenticated → cleared/invalidated), `invalidateSession` with and without an active session
- [ ] 4.7 `msw`-backed integration tests for `authenticate` and `loginWithCredentials`, covering success and each documented failure path

## 5. Library client — models

- [ ] 5.1 Implement pagination types: `PaginationLinks`, `PaginationMeta`, `PageParams`, `LibraryItemsParams`
- [ ] 5.2 Implement order-product model types: `FileChecksum`, `OrderProductFile`, `OrderProductAttributes`, `OrderProductItem`, `OrderProductRelationships`, `RelationshipRef`, `RelationshipData`, `OrderProductOrder`, `OrderProductPublisher`, `OrderProductFilter`, `OrderProductHistoryEntry`, `OrderProductAttribute`, `OrderProductDescription`
- [ ] 5.3 Implement sideloaded `included` handling: `PublisherAttributes`, `PublisherItem`, `IncludedItem` with `asPublisher()`/`asProduct()` helper functions
- [ ] 5.4 Implement response types + parsers: `OrderProductListResponse`, `OrderProductItemResponse`
- [ ] 5.5 Implement product-list types + parsers: `ProductListAttributes`, `ProductListItem`, `ProductListCollectionResponse`, `ProductListItemsResponse`, `ProductListItemCreateRequest`, `ProductListItemCreateResponse` (with envelope-unwrapping `parseX`)
- [ ] 5.6 Write a shared camelCase field-mapping helper for wire-format parsing

## 6. Library client — HTTP behavior

- [ ] 6.1 Implement `LibraryClient` constructor `(config, token)` in `library/client.ts`
- [ ] 6.2 Implement `endpoint(path)` URL builder and `authHeader()` (raw token, no `Bearer ` prefix)
- [ ] 6.3 Implement the central `decodeResponse` chokepoint: read status + `Retry-After` (delay-seconds only) before consuming the body; on non-success, extract an error message (top-level `message`, `error.message`, or field-keyed validation object) and throw `ApiError` without attempting success-schema decode; on success, decode into the target type or throw `DecodeFailedError`
- [ ] 6.4 Implement `listOrderProducts(params): Promise<OrderProductListResponse>`
- [ ] 6.5 Implement `getOrderProduct(orderProductId): Promise<OrderProductItemResponse>`
- [ ] 6.6 Implement `prepareDownload(orderProductId, index): Promise<unknown>` — `index` required, no default
- [ ] 6.7 Implement `listProductLists(params): Promise<ProductListCollectionResponse>`
- [ ] 6.8 Implement `listProductListItems(productListId, params): Promise<ProductListItemsResponse>`
- [ ] 6.9 Implement `createProductList(name): Promise<ProductListItem>` (envelope-unwrapping decode)
- [ ] 6.10 Implement `deleteProductList(id): Promise<void>` (status-check shortcut, no body parsing)
- [ ] 6.11 Implement `addProductListItem(productListId, productId): Promise<ProductListItemCreateResponse>`
- [ ] 6.12 Implement `deleteProductListItem(productListItemId): Promise<void>` (status-check shortcut)

## 7. Library client — tests

- [ ] 7.1 `msw`-backed tests for every `LibraryClient` method: success path, non-success status → `ApiError` (no success-schema decode attempted), `DecodeFailedError` on malformed success body
- [ ] 7.2 Tests for `Retry-After`: present (delay-seconds), absent, HTTP-date form (must not throw, `retryAfter === undefined`)
- [ ] 7.3 Test the `Authorization` header carries the raw token with no `Bearer ` prefix
- [ ] 7.4 Test `prepareDownload` requires `index` (a compile-time check via a `// @ts-expect-error` test case, plus a runtime test if the value can arrive as `undefined` from untyped call sites)
- [ ] 7.5 Test JSON:API envelope unwrapping for `createProductList` and `addProductListItem` against realistic fixture payloads

## 8. Documentation

- [ ] 8.1 Update `README.md`: remove the "Status: in development" note, add a Quick Start example mirroring the Rust README's shape (`Config`, `authenticate`, `applyAuthResponse`, `libraryClient`, `listOrderProducts`)
- [ ] 8.2 Ensure every exported function/class/type has a TSDoc comment per `docs/typescript.md`'s convention

## 9. Verification

- [ ] 9.1 `npm run lint` passes
- [ ] 9.2 `npm run typecheck` passes
- [ ] 9.3 `npm test` passes with no skipped tests
- [ ] 9.4 `npm run build` passes
- [ ] 9.5 `npm audit --audit-level=high` reports no new vulnerabilities
- [ ] 9.6 CI (lint, typecheck, test, build, audit) passes on the PR
