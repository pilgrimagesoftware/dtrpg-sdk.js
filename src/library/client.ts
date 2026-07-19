/**
 * HTTP client for DriveThruRPG library endpoints.
 *
 * {@link LibraryClient} provides an authenticated interface to the DriveThruRPG API's
 * library-related endpoints, covering ordered products, download preparation, product
 * lists, and product list items.
 *
 * All methods require a valid bearer token and application key, both of which are
 * captured when the client is constructed. Create a `LibraryClient` via
 * `DriveThruRpgSdk.libraryClient` to ensure the SDK is both configured and
 * authenticated before the client is used.
 */

import type { Config } from "../config.js";
import { ApiError, DecodeFailedError, HttpError } from "../errors.js";

import {
  type LibraryItemsParams,
  type OrderProductItemResponse,
  type OrderProductListResponse,
  type PageParams,
  parseCreateProductListResponse,
  parseOrderProductItemResponse,
  parseOrderProductListResponse,
  parseProductListCollectionResponse,
  parseProductListItemCreateResponse,
  parseProductListItemsResponse,
  type ProductListCollectionResponse,
  type ProductListItem,
  type ProductListItemCreateResponse,
  type ProductListItemsResponse,
} from "./models.js";

/** Maximum number of characters logged from a failing response body. */
const LOG_PAYLOAD_LIMIT = 2_000;

function truncatedPayload(raw: string): string {
  return raw.length > LOG_PAYLOAD_LIMIT ? `${raw.slice(0, LOG_PAYLOAD_LIMIT)}… (truncated)` : raw;
}

/**
 * Parses the `Retry-After` header's delay-seconds form (RFC 9110 §10.2.3) only.
 *
 * Returns `undefined` if the header is absent or in HTTP-date form (or any other
 * non-integer form) rather than throwing — this SDK does not add a date-parsing
 * dependency for a form the API is judged unlikely to send on 429s.
 */
function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get("Retry-After");
  if (header === null) {
    return undefined;
  }
  const trimmed = header.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  return Number.parseInt(trimmed, 10);
}

/**
 * Extracts a human-readable error message from a non-success JSON response body.
 *
 * Recognizes three shapes seen across DriveThruRPG API error responses: a top-level
 * `message` string (e.g. `AuthSessionError`-style payloads); a nested
 * `{"error": {"message": "..."}}` object (e.g. `product_list_items` failures); or a
 * flat object keyed by field name whose values are a validation message string or an
 * array of message strings (e.g. `{"productId": "Requires a valid Product ID. Invalid
 * value 22654728."}`). Returns `undefined` if the body isn't JSON or matches none of
 * these shapes, so the caller falls back to the raw payload.
 */
function extractErrorMessage(raw: string): string | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.message === "string") {
    return obj.message;
  }

  if (typeof obj.error === "object" && obj.error !== null && !Array.isArray(obj.error)) {
    const nestedMessage = (obj.error as Record<string, unknown>).message;
    if (typeof nestedMessage === "string") {
      return nestedMessage;
    }
  }

  const parts: string[] = [];
  for (const [field, detail] of Object.entries(obj)) {
    if (typeof detail === "string") {
      parts.push(`${field}: ${detail}`);
    } else if (Array.isArray(detail)) {
      for (const message of detail) {
        if (typeof message === "string") {
          parts.push(`${field}: ${message}`);
        }
      }
    }
  }

  return parts.length > 0 ? parts.join("; ") : undefined;
}

/**
 * An authenticated HTTP client for DriveThruRPG library endpoints.
 *
 * `LibraryClient` combines SDK configuration and an active bearer token to authenticate
 * all outgoing requests. Every method maps to a specific API endpoint and returns a
 * fully deserialized response.
 *
 * Prefer `DriveThruRpgSdk.libraryClient()` over calling this constructor directly, as
 * that method validates both configuration and session state before constructing the
 * client.
 *
 * @example
 * ```ts
 * const client = sdk.libraryClient();
 * const products = await client.listOrderProducts({ page: 1, pageSize: 25 });
 * ```
 */
export class LibraryClient {
  private readonly config: Config;
  private readonly token: string;

  /**
   * Creates a new `LibraryClient` from the given configuration and bearer token.
   *
   * Prefer `DriveThruRpgSdk.libraryClient()` over calling this constructor directly.
   */
  constructor(config: Config, token: string) {
    this.config = config;
    this.token = token;
  }

  /**
   * Builds the full URL for a versioned API path segment.
   *
   * Combines the configured base URL, API version, and the given resource path into a
   * single URL string: `{baseUrl}/{apiVersion}/{path}`.
   */
  private endpoint(path: string): string {
    return `${this.config.baseUrl}/${this.config.apiVersion}/${path}`;
  }

  /**
   * Returns the `Authorization` header value for the active session.
   *
   * The DTRPG API expects the raw JWT token without a `Bearer ` prefix.
   */
  private authHeader(): string {
    return this.token;
  }

  /**
   * Sends a request and reads its response through the central decode chokepoint.
   *
   * A non-success status is treated as a request failure rather than a decode attempt:
   * the body is never parsed as the success type in that case (`parse` describes the
   * success schema, so trying to run it against an error body would produce a
   * confusing shape-mismatch error instead of the API's actual message). Instead a
   * human-readable message is extracted from the body via {@link extractErrorMessage}
   * and thrown via {@link ApiError}.
   *
   * On a success status whose body still fails to parse, an {@link DecodeFailedError} is
   * thrown with both the parse cause and the offending payload for diagnosis.
   */
  private async decodeResponse<T>(
    url: string,
    response: Response,
    parse: (value: unknown) => T,
  ): Promise<T> {
    const status = response.status;
    const retryAfter = parseRetryAfter(response);
    const raw = await response.text();

    if (!response.ok) {
      const message = extractErrorMessage(raw);
      throw new ApiError(url, status, message, truncatedPayload(raw), retryAfter);
    }

    try {
      return parse(JSON.parse(raw) as unknown);
    } catch (cause) {
      throw new DecodeFailedError(url, status, cause, truncatedPayload(raw));
    }
  }

  /**
   * Sends a request and throws on a non-success status without attempting to parse a
   * body ("status-check shortcut" for endpoints with no useful response body, e.g.
   * `DELETE`).
   */
  private async checkStatus(url: string, response: Response): Promise<void> {
    if (!response.ok) {
      throw new HttpError(url, response.status);
    }
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (cause) {
      throw new HttpError(url, undefined, cause);
    }
  }

  // ── Ordered Products ──────────────────────────────────────────────────────

  /**
   * Fetches a paginated list of ordered products from the authenticated user's library.
   *
   * Maps to `GET /{apiVersion}/order_products`.
   *
   * Authentication is supplied via the `Authorization` header containing the raw JWT
   * token. All defined fields of `params` are included as query parameters.
   *
   * @throws {@link ApiError} on a non-success response.
   * @throws {@link DecodeFailedError} if the response body cannot be parsed.
   * @throws {@link HttpError} on transport failure.
   *
   * @example
   * ```ts
   * const products = await client.listOrderProducts({ page: 1, pageSize: 25 });
   * ```
   */
  async listOrderProducts(params: LibraryItemsParams = {}): Promise<OrderProductListResponse> {
    const url = new URL(this.endpoint("order_products"));

    if (params.page !== undefined) {
      url.searchParams.set("page", String(params.page));
    }
    if (params.pageSize !== undefined) {
      url.searchParams.set("pageSize", String(params.pageSize));
    }
    if (params.getChecksum === true) {
      url.searchParams.set("getChecksum", "1");
    }
    if (params.getFilters === true) {
      url.searchParams.set("getFilters", "1");
    }
    if (params.library === true) {
      url.searchParams.set("library", "true");
    }
    if (params.archived !== undefined) {
      url.searchParams.set("archived", params.archived ? "1" : "0");
    }
    if (params.updatedDateAfter !== undefined) {
      url.searchParams.set("updatedDate[after]", params.updatedDateAfter);
    }

    const urlString = url.toString();
    const response = await this.send(urlString, {
      method: "GET",
      headers: { Authorization: this.authHeader() },
    });
    return this.decodeResponse(urlString, response, parseOrderProductListResponse);
  }

  /**
   * Fetches the details of a single ordered product by its identifier.
   *
   * Maps to `GET /{apiVersion}/order_products/{orderProductId}`.
   *
   * @throws {@link ApiError} on a non-success response.
   * @throws {@link DecodeFailedError} if the response body cannot be parsed.
   * @throws {@link HttpError} on transport failure.
   *
   * @example
   * ```ts
   * const product = await client.getOrderProduct(515_276);
   * ```
   */
  async getOrderProduct(orderProductId: number): Promise<OrderProductItemResponse> {
    const url = this.endpoint(`order_products/${orderProductId}`);
    const response = await this.send(url, {
      method: "GET",
      headers: { Authorization: this.authHeader() },
    });
    return this.decodeResponse(url, response, parseOrderProductItemResponse);
  }

  /**
   * Prepares a download for the given ordered product's file and returns the raw API
   * response.
   *
   * Maps to `GET /{apiVersion}/order_products/{orderProductId}/prepare?index={index}`.
   * `index` identifies which file within the ordered product to prepare — it matches
   * {@link OrderProductFile.index} — and is a required parameter with no default: the
   * API rejects the request with an error if it is omitted, and a default of `0` would
   * be unsafe for multi-file bundles.
   *
   * The response is returned as `unknown` because the response schema for this endpoint
   * has not yet been formally defined by the API contract. The type will be tightened in
   * a future change once the API contract matures.
   *
   * @throws {@link ApiError} on a non-success response.
   * @throws {@link DecodeFailedError} if the response body cannot be parsed.
   * @throws {@link HttpError} on transport failure.
   *
   * @example
   * ```ts
   * const download = await client.prepareDownload(515_276, 0);
   * ```
   */
  async prepareDownload(orderProductId: number, index: number): Promise<unknown> {
    const url = new URL(this.endpoint(`order_products/${orderProductId}/prepare`));
    url.searchParams.set("index", String(index));
    const urlString = url.toString();

    const response = await this.send(urlString, {
      method: "GET",
      headers: { Authorization: this.authHeader() },
    });
    return this.decodeResponse(urlString, response, (value) => value);
  }

  // ── Product Lists ─────────────────────────────────────────────────────────

  /**
   * Fetches a paginated list of product lists belonging to the authenticated user.
   *
   * Maps to `GET /{apiVersion}/product_lists`.
   *
   * @throws {@link ApiError} on a non-success response.
   * @throws {@link DecodeFailedError} if the response body cannot be parsed.
   * @throws {@link HttpError} on transport failure.
   *
   * @example
   * ```ts
   * const lists = await client.listProductLists({});
   * ```
   */
  async listProductLists(params: PageParams = {}): Promise<ProductListCollectionResponse> {
    const url = new URL(this.endpoint("product_lists"));

    if (params.page !== undefined) {
      url.searchParams.set("page", String(params.page));
    }
    if (params.pageSize !== undefined) {
      url.searchParams.set("pageSize", String(params.pageSize));
    }

    const urlString = url.toString();
    const response = await this.send(urlString, {
      method: "GET",
      headers: { Authorization: this.authHeader() },
    });
    return this.decodeResponse(urlString, response, parseProductListCollectionResponse);
  }

  /**
   * Fetches a paginated list of items within a specific product list.
   *
   * Maps to `GET /{apiVersion}/product_list_items?productListId={productListId}`.
   *
   * @throws {@link ApiError} on a non-success response.
   * @throws {@link DecodeFailedError} if the response body cannot be parsed.
   * @throws {@link HttpError} on transport failure.
   *
   * @example
   * ```ts
   * const items = await client.listProductListItems(86_151, {});
   * ```
   */
  async listProductListItems(
    productListId: number,
    params: PageParams = {},
  ): Promise<ProductListItemsResponse> {
    const url = new URL(this.endpoint("product_list_items"));
    url.searchParams.set("productListId", String(productListId));

    if (params.page !== undefined) {
      url.searchParams.set("page", String(params.page));
    }
    if (params.pageSize !== undefined) {
      url.searchParams.set("pageSize", String(params.pageSize));
    }

    const urlString = url.toString();
    const response = await this.send(urlString, {
      method: "GET",
      headers: { Authorization: this.authHeader() },
    });
    return this.decodeResponse(urlString, response, parseProductListItemsResponse);
  }

  /**
   * Creates a new product list with the given name.
   *
   * Maps to `POST /{apiVersion}/product_lists` with a JSON body `{"name": "<name>"}`.
   * Unwraps the JSON:API envelope the API returns on the wire.
   *
   * @throws {@link ApiError} on a non-success response.
   * @throws {@link DecodeFailedError} if the response body cannot be parsed.
   * @throws {@link HttpError} on transport failure.
   *
   * @example
   * ```ts
   * const list = await client.createProductList("Wishlist");
   * ```
   */
  async createProductList(name: string): Promise<ProductListItem> {
    const url = this.endpoint("product_lists");
    const response = await this.send(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    return this.decodeResponse(url, response, parseCreateProductListResponse);
  }

  /**
   * Deletes a product list by id.
   *
   * Maps to `DELETE /{apiVersion}/product_lists/{id}`.
   *
   * @throws {@link HttpError} if the request fails.
   *
   * @example
   * ```ts
   * await client.deleteProductList(86_151);
   * ```
   */
  async deleteProductList(id: number): Promise<void> {
    const url = this.endpoint(`product_lists/${id}`);
    const response = await this.send(url, {
      method: "DELETE",
      headers: { Authorization: this.authHeader() },
    });
    await this.checkStatus(url, response);
  }

  /**
   * Adds a product to a product list as a member.
   *
   * Maps to `POST /{apiVersion}/product_list_items`. Unwraps the JSON:API envelope the
   * API returns on the wire.
   *
   * @throws {@link ApiError} on a non-success response.
   * @throws {@link DecodeFailedError} if the response body cannot be parsed.
   * @throws {@link HttpError} on transport failure.
   *
   * @example
   * ```ts
   * const item = await client.addProductListItem(86_151, 515_276);
   * ```
   */
  async addProductListItem(
    productListId: number,
    productId: number,
  ): Promise<ProductListItemCreateResponse> {
    const url = this.endpoint("product_list_items");
    const response = await this.send(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, productListId }),
    });
    return this.decodeResponse(url, response, parseProductListItemCreateResponse);
  }

  /**
   * Removes a product list item by its own id (not the product's id).
   *
   * Maps to `DELETE /{apiVersion}/product_list_items/{productListItemId}`.
   *
   * @throws {@link HttpError} if the request fails.
   *
   * @example
   * ```ts
   * await client.deleteProductListItem(2_629_321);
   * ```
   */
  async deleteProductListItem(productListItemId: number): Promise<void> {
    const url = this.endpoint(`product_list_items/${productListItemId}`);
    const response = await this.send(url, {
      method: "DELETE",
      headers: { Authorization: this.authHeader() },
    });
    await this.checkStatus(url, response);
  }
}
