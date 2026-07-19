/**
 * SDK for the DriveThruRPG API.
 *
 * This package provides types and structures for authenticating with, configuring, and
 * making requests to the DriveThruRPG API. It covers:
 *
 * - **Configuration** — supplying your application key, API base URL, and API version
 *   via {@link Config}.
 * - **Authentication** — representing token responses, active sessions, and session
 *   state via {@link AuthTokenResponse}, {@link AuthSession}, and {@link AuthState}.
 * - **Error handling** — a typed exception hierarchy for SDK-level, session-level, and
 *   HTTP failures via {@link SdkError}, {@link AuthSessionError}, and
 *   {@link ClientError}.
 * - **SDK entry point** — {@link DriveThruRpgSdk} ties configuration and session
 *   lifecycle together and vends a {@link LibraryClient} once authenticated.
 * - **Library access** — {@link LibraryClient} provides an HTTP client for all library
 *   endpoints (ordered products, product lists, download preparation).
 *
 * @example
 * ```ts
 * import { Config, DriveThruRpgSdk, authenticate } from "dtrpg-sdk";
 *
 * const sdk = DriveThruRpgSdk.withConfig(new Config({ applicationKey: "my-app-key" }));
 *
 * const response = await authenticate("my-app-key", sdk.requireConfig());
 * sdk.applyAuthResponse(response);
 *
 * const client = sdk.libraryClient();
 * const library = await client.listOrderProducts({ page: 1, pageSize: 25 });
 * ```
 */

export const VERSION = "0.1.0";

export {
  loginWithCredentials,
  authenticate,
  AuthSession,
  AuthSessionError,
  type AuthState,
  type AuthTokenResponse,
  type SessionTransition,
} from "./auth/index.js";
export { Config, type ConfigOptions, DEFAULT_API_VERSION, DEFAULT_BASE_URL } from "./config.js";
export {
  ApiError,
  ApplicationKeyRequestFailedError,
  ClientError,
  DecodeFailedError,
  HttpError,
  InvalidCredentialsError,
  SdkError,
  UnauthenticatedError,
  UnconfiguredError,
} from "./errors.js";
export {
  asProduct,
  asPublisher,
  type FileChecksum,
  type IncludedItem,
  LibraryClient,
  type LibraryItemsParams,
  type OrderProductAttribute,
  type OrderProductAttributes,
  type OrderProductDescription,
  type OrderProductFile,
  type OrderProductFilter,
  type OrderProductHistoryEntry,
  type OrderProductInfo,
  type OrderProductItem,
  type OrderProductItemResponse,
  type OrderProductListResponse,
  type OrderProductOrder,
  type OrderProductPublisher,
  type OrderProductRelationships,
  type PageParams,
  type PaginationLinks,
  type PaginationMeta,
  type ProductListAttributes,
  type ProductListCollectionResponse,
  type ProductListItem,
  type ProductListItemCreateRequest,
  type ProductListItemCreateResponse,
  type ProductListItemsResponse,
  type PublisherAttributes,
  type PublisherItem,
  type RelationshipData,
  type RelationshipRef,
} from "./library/index.js";
export { DriveThruRpgSdk } from "./sdk.js";
