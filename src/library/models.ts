/**
 * Library resource types for the DriveThruRPG SDK.
 *
 * This module provides TypeScript model types that mirror the API-defined schemas for
 * library resources: ordered products, product files, product lists, and associated
 * pagination and metadata structures.
 *
 * The DriveThruRPG API already uses camelCase JSON keys, so these interfaces use the
 * exact wire field names with no renaming — unlike the Rust SDK, which maps camelCase
 * JSON onto Rust's snake_case convention via `#[serde(rename = "...")]`. Response types
 * are paired with hand-written `parseX(value: unknown): X` functions (see
 * "Shared parsing helpers" below) that validate required fields and throw on shape
 * mismatch, mirroring `serde`'s mechanical field mapping without a runtime validation
 * dependency.
 *
 * Query parameter interfaces ({@link LibraryItemsParams}, {@link PageParams}) are plain
 * TypeScript interfaces with no parser; they are consumed by {@link LibraryClient}
 * methods to build URL query strings.
 */

// ── Shared parsing helpers ───────────────────────────────────────────────────────

/** A JSON object with string keys, prior to field-level validation. */
type JsonRecord = Record<string, unknown>;

/**
 * Casts `value` to a {@link JsonRecord}, throwing if it isn't a JSON object.
 *
 * The shared entry point every `parseX` function uses before reading individual
 * fields — this is the camelCase field-mapping helper referenced in the module design:
 * since the API's wire format is already camelCase, no field renaming is needed, only
 * shape validation before treating `value` as a typed record.
 */
function asRecord(value: unknown, context: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`expected ${context} to be a JSON object`);
  }
  return value as JsonRecord;
}

function requireString(record: JsonRecord, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new TypeError(`expected ${context}.${key} to be a string`);
  }
  return value;
}

function requireNumber(record: JsonRecord, key: string, context: string): number {
  const value = record[key];
  if (typeof value !== "number") {
    throw new TypeError(`expected ${context}.${key} to be a number`);
  }
  return value;
}

function optionalString(record: JsonRecord, key: string, context: string): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new TypeError(`expected ${context}.${key} to be a string or null`);
  }
  return value;
}

function optionalNumber(record: JsonRecord, key: string, context: string): number | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number") {
    throw new TypeError(`expected ${context}.${key} to be a number or null`);
  }
  return value;
}

function requireArray<T>(
  record: JsonRecord,
  key: string,
  context: string,
  parseItem: (item: unknown, index: number) => T,
): T[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new TypeError(`expected ${context}.${key} to be an array`);
  }
  return value.map((item, index) => parseItem(item, index));
}

/** Parses an array field, treating a missing or `null` value as an empty array. */
function requireArrayDefault<T>(
  record: JsonRecord,
  key: string,
  context: string,
  parseItem: (item: unknown, index: number) => T,
): T[] {
  const value = record[key];
  if (value === undefined || value === null) {
    return [];
  }
  return requireArray(record, key, context, parseItem);
}

/** Parses an optional array field, preserving `undefined` for a missing or `null` value. */
function optionalArray<T>(
  record: JsonRecord,
  key: string,
  context: string,
  parseItem: (item: unknown, index: number) => T,
): T[] | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireArray(record, key, context, parseItem);
}

function optionalObject<T>(
  record: JsonRecord,
  key: string,
  context: string,
  parseObject: (value: unknown) => T,
): T | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return parseObject(value);
}

// ── Pagination ────────────────────────────────────────────────────────────────

/** Pagination links included in all paginated API responses. */
export interface PaginationLinks {
  /** The canonical URL for the current page of results. */
  self: string;
  /** URL for the first page of results, if available. */
  first?: string;
  /** URL for the last page of results, if available. */
  last?: string;
  /** URL for the previous page of results, if available. */
  prev?: string;
  /** URL for the next page of results, if available. */
  next?: string;
}

function parsePaginationLinks(value: unknown): PaginationLinks {
  const record = asRecord(value, "PaginationLinks");
  return {
    self: requireString(record, "self", "PaginationLinks"),
    first: optionalString(record, "first", "PaginationLinks"),
    last: optionalString(record, "last", "PaginationLinks"),
    prev: optionalString(record, "prev", "PaginationLinks"),
    next: optionalString(record, "next", "PaginationLinks"),
  };
}

/** Pagination metadata included in all paginated API responses. */
export interface PaginationMeta {
  /** The number of items returned per page. */
  itemsPerPage: number;
  /** The current page number (1-based). */
  currentPage: number;
}

function parsePaginationMeta(value: unknown): PaginationMeta {
  const record = asRecord(value, "PaginationMeta");
  return {
    itemsPerPage: requireNumber(record, "itemsPerPage", "PaginationMeta"),
    currentPage: requireNumber(record, "currentPage", "PaginationMeta"),
  };
}

// ── File / Checksum ───────────────────────────────────────────────────────────

/** Checksum information for a single downloadable product file. */
export interface FileChecksum {
  /** The checksum hash string for the file. */
  checksum: string;
  /** The date when the checksum was generated (ISO 8601 string). */
  checksumDate: string;
}

function parseFileChecksum(value: unknown): FileChecksum {
  const record = asRecord(value, "FileChecksum");
  return {
    checksum: requireString(record, "checksum", "FileChecksum"),
    checksumDate: requireString(record, "checksumDate", "FileChecksum"),
  };
}

/** A downloadable file associated with an ordered product. */
export interface OrderProductFile {
  /** The index of this file within the ordered product's file list. */
  index: number;
  /** The unique identifier for this specific download record. */
  orderProductDownloadId: number;
  /** The display title of the file. */
  title: string;
  /** The filename as it will appear when downloaded. */
  filename: string;
  /** The file size in bytes. */
  size: number;
  /** The file size expressed in megabytes as a formatted string. */
  sizeMB: string;
  /**
   * Checksums available for verifying the integrity of the downloaded file.
   *
   * The API may return `null` for products without checksum data; treated as empty.
   */
  checksums: FileChecksum[];
}

function parseOrderProductFile(value: unknown): OrderProductFile {
  const record = asRecord(value, "OrderProductFile");
  return {
    index: requireNumber(record, "index", "OrderProductFile"),
    orderProductDownloadId: requireNumber(record, "orderProductDownloadId", "OrderProductFile"),
    title: requireString(record, "title", "OrderProductFile"),
    filename: requireString(record, "filename", "OrderProductFile"),
    size: requireNumber(record, "size", "OrderProductFile"),
    sizeMB: requireString(record, "sizeMB", "OrderProductFile"),
    checksums: requireArrayDefault(record, "checksums", "OrderProductFile", parseFileChecksum),
  };
}

// ── Filters / History / Attributes ───────────────────────────────────────────

/**
 * A filter category associated with an ordered product.
 *
 * Populated when `getFilters=1` is included in the request.
 */
export interface OrderProductFilter {
  /** The unique identifier of this filter category. */
  filterId: number;
  /** The unique identifier of this filter's parent category. */
  parentFilterId: number;
  /** The display name of this filter category. */
  name: string;
  /** The display name of this filter's parent category. */
  parentName: string;
}

function parseOrderProductFilter(value: unknown): OrderProductFilter {
  const record = asRecord(value, "OrderProductFilter");
  return {
    filterId: requireNumber(record, "filterId", "OrderProductFilter"),
    parentFilterId: requireNumber(record, "parentFilterId", "OrderProductFilter"),
    name: requireString(record, "name", "OrderProductFilter"),
    parentName: requireString(record, "parentName", "OrderProductFilter"),
  };
}

/** A single history entry recording a change made to an ordered product. */
export interface OrderProductHistoryEntry {
  /** The date and time when the change occurred (ISO 8601 string). */
  changed: string;
  /** A human-readable description of what changed. */
  changes: string;
}

function parseOrderProductHistoryEntry(value: unknown): OrderProductHistoryEntry {
  const record = asRecord(value, "OrderProductHistoryEntry");
  return {
    changed: requireString(record, "changed", "OrderProductHistoryEntry"),
    changes: requireString(record, "changes", "OrderProductHistoryEntry"),
  };
}

/**
 * An individual attribute option associated with an ordered product.
 *
 * Attributes describe purchase options such as format or edition.
 */
export interface OrderProductAttribute {
  /** The unique identifier of the order this attribute belongs to. */
  orderId: number;
  /** The name of the option (e.g., `"Format"`). */
  optionName: string;
  /** The display name of the selected option value (e.g., `"PDF"`). */
  optionValueName: string;
  /** The price associated with this option, as a formatted string. */
  price: string;
  /** A prefix to display before the price (e.g., `"$"`). */
  pricePrefix: string;
  /** The unique identifier for the selected option value. */
  optionValueId: number;
  /** The type classification of this option. */
  optionType: string;
}

function parseOrderProductAttribute(value: unknown): OrderProductAttribute {
  const record = asRecord(value, "OrderProductAttribute");
  return {
    orderId: requireNumber(record, "orderId", "OrderProductAttribute"),
    optionName: requireString(record, "optionName", "OrderProductAttribute"),
    optionValueName: requireString(record, "optionValueName", "OrderProductAttribute"),
    price: requireString(record, "price", "OrderProductAttribute"),
    pricePrefix: requireString(record, "pricePrefix", "OrderProductAttribute"),
    optionValueId: requireNumber(record, "optionValueId", "OrderProductAttribute"),
    optionType: requireString(record, "optionType", "OrderProductAttribute"),
  };
}

// ── OrderProduct ──────────────────────────────────────────────────────────────

/** Publisher metadata embedded directly on an ordered product's attributes. */
export interface OrderProductPublisher {
  /** The display name of the publisher. */
  name: string;
  /** The unique identifier of the publisher. */
  publisherId: number;
  /** The URL slug for the publisher's storefront page. */
  slug: string;
}

function parseOrderProductPublisher(value: unknown): OrderProductPublisher {
  const record = asRecord(value, "OrderProductPublisher");
  return {
    name: requireString(record, "name", "OrderProductPublisher"),
    publisherId: requireNumber(record, "publisherId", "OrderProductPublisher"),
    slug: requireString(record, "slug", "OrderProductPublisher"),
  };
}

/** Descriptive text for a product, embedded within {@link OrderProductInfo}. */
export interface OrderProductDescription {
  /** The display name of the product. */
  name: string;
  /** HTML purchase note shown to the customer, if any. */
  purchaseNote?: string;
  /** The URL slug for the product's storefront page. */
  slug: string;
  /** A short marketing description of the product. */
  shortDescription?: string;
}

function parseOrderProductDescription(value: unknown): OrderProductDescription {
  const record = asRecord(value, "OrderProductDescription");
  return {
    name: requireString(record, "name", "OrderProductDescription"),
    purchaseNote: optionalString(record, "purchaseNote", "OrderProductDescription"),
    slug: requireString(record, "slug", "OrderProductDescription"),
    shortDescription: optionalString(record, "shortDescription", "OrderProductDescription"),
  };
}

/**
 * Product catalog metadata embedded directly on an ordered product's attributes,
 * including relative paths to cover images.
 *
 * Image paths (`image`, `webImage`, `thumbnail`, `thumbnail100`) are relative to the
 * DriveThruRPG images base URL (`https://api.drivethrurpg.com/images/`).
 */
export interface OrderProductInfo {
  /** Relative path to the full-size cover image, if available. */
  image?: string;
  /** Relative path to the web-optimized (WebP) cover image, if available. */
  webImage?: string;
  /** Relative path to the 140px cover thumbnail image, if available. */
  thumbnail?: string;
  /** Relative path to the 100px cover thumbnail image, if available. */
  thumbnail100?: string;
  /** Bundle ID if this product is part of a bundle, otherwise 0. */
  bundleId: number;
  /** Date and time when the product was added to the DTRPG catalog, if known. */
  dateCreated?: string;
  /** Unique identifier for the product in the DTRPG catalog. */
  productId: number;
  /** Descriptive text for the product, if requested. */
  description?: OrderProductDescription;
  /** Total file size in megabytes, if known. */
  filesize?: number;
}

function parseOrderProductInfo(value: unknown): OrderProductInfo {
  const record = asRecord(value, "OrderProductInfo");
  return {
    image: optionalString(record, "image", "OrderProductInfo"),
    webImage: optionalString(record, "webImage", "OrderProductInfo"),
    thumbnail: optionalString(record, "thumbnail", "OrderProductInfo"),
    thumbnail100: optionalString(record, "thumbnail100", "OrderProductInfo"),
    bundleId: requireNumber(record, "bundleId", "OrderProductInfo"),
    dateCreated: optionalString(record, "dateCreated", "OrderProductInfo"),
    productId: requireNumber(record, "productId", "OrderProductInfo"),
    description: optionalObject(
      record,
      "description",
      "OrderProductInfo",
      parseOrderProductDescription,
    ),
    filesize: optionalNumber(record, "filesize", "OrderProductInfo"),
  };
}

/** Order summary metadata embedded on an ordered product's attributes. */
export interface OrderProductOrder {
  /** Date and time when the order was created, if known. */
  dateCreated?: string;
  /** The unique identifier of the order. */
  orderId: number;
}

function parseOrderProductOrder(value: unknown): OrderProductOrder {
  const record = asRecord(value, "OrderProductOrder");
  return {
    dateCreated: optionalString(record, "dateCreated", "OrderProductOrder"),
    orderId: requireNumber(record, "orderId", "OrderProductOrder"),
  };
}

/**
 * The full attribute set for an ordered product.
 *
 * This is the primary payload within an {@link OrderProductItem}. It includes required
 * fields present on every ordered product as well as optional collections (filters,
 * history, attributes) that are populated only when specifically requested.
 */
export interface OrderProductAttributes {
  /** The unique identifier of the order this product belongs to. */
  orderId: number;
  /** The unique identifier of the product. */
  productId: number;
  /** The publisher identifier used for royalty tracking. */
  royaltyPublisherId: number;
  /** The ISBN of the product, if applicable. */
  isbn?: string;
  /** The display name of the product. */
  name: string;
  /** The date the product was purchased (ISO 8601 string), if available. */
  datePurchased?: string;
  /** The total file size in bytes, if available. */
  filesize?: number;
  /** The final price paid for the product. */
  finalPrice: number;
  /** The quantity of this product in the order. */
  quantity: number;
  /** The bundle identifier, if the product was purchased as part of a bundle. */
  bundleId: number;
  /** Indicates whether the product has been archived (`1`) or not (`0`). */
  archived: number;
  /** Additional add-on information associated with this product, if any. */
  addOnInfo?: string;
  /** The unique identifier for this order-product record. */
  orderProductId: number;
  /** The unique identifier of the customer who owns this order. */
  customerId: number;
  /** The date the product files were last modified (ISO 8601 string), if known. */
  fileLastModified?: string;
  /** The date the product files were last downloaded (ISO 8601 string), if known. */
  fileLastDownloaded?: string;
  /** The list of downloadable files associated with this ordered product. */
  files: OrderProductFile[];
  /** Filter categories for this product. Populated when `getFilters=1` is requested. */
  filters?: OrderProductFilter[];
  /** The change history for this ordered product, if requested. */
  history?: OrderProductHistoryEntry[];
  /** Optional attributes describing purchase options (format, edition, etc.). */
  attributes?: OrderProductAttribute[];
  /**
   * Publisher metadata embedded directly on this ordered product's attributes, when the
   * API includes it inline (in addition to, or instead of, sideloaded `included`
   * publisher resources).
   */
  publisher?: OrderProductPublisher;
  /** Product catalog metadata (cover images, description) embedded on this ordered product. */
  product?: OrderProductInfo;
  /** Order summary metadata embedded on this ordered product. */
  order?: OrderProductOrder;
}

function parseOrderProductAttributes(value: unknown): OrderProductAttributes {
  const record = asRecord(value, "OrderProductAttributes");
  const context = "OrderProductAttributes";
  return {
    orderId: requireNumber(record, "orderId", context),
    productId: requireNumber(record, "productId", context),
    royaltyPublisherId: requireNumber(record, "royaltyPublisherId", context),
    isbn: optionalString(record, "isbn", context),
    name: requireString(record, "name", context),
    datePurchased: optionalString(record, "datePurchased", context),
    filesize: optionalNumber(record, "filesize", context),
    finalPrice: requireNumber(record, "finalPrice", context),
    quantity: requireNumber(record, "quantity", context),
    bundleId: requireNumber(record, "bundleId", context),
    archived: requireNumber(record, "archived", context),
    addOnInfo: optionalString(record, "addOnInfo", context),
    orderProductId: requireNumber(record, "orderProductId", context),
    customerId: requireNumber(record, "customerId", context),
    fileLastModified: optionalString(record, "fileLastModified", context),
    fileLastDownloaded: optionalString(record, "fileLastDownloaded", context),
    files: requireArray(record, "files", context, parseOrderProductFile),
    filters: optionalArray(record, "filters", context, parseOrderProductFilter),
    history: optionalArray(record, "history", context, parseOrderProductHistoryEntry),
    attributes: optionalArray(record, "attributes", context, parseOrderProductAttribute),
    publisher: optionalObject(record, "publisher", context, parseOrderProductPublisher),
    product: optionalObject(record, "product", context, parseOrderProductInfo),
    order: optionalObject(record, "order", context, parseOrderProductOrder),
  };
}

/** The `type`/`id` pair identifying a JSON:API resource referenced by a relationship. */
export interface RelationshipData {
  /** The referenced resource's type string (e.g., `"Product"`). */
  type: string;
  /** The referenced resource's id, matching an entry's `id` in the `included` array. */
  id: string;
}

function parseRelationshipData(value: unknown): RelationshipData {
  const record = asRecord(value, "RelationshipData");
  return {
    type: requireString(record, "type", "RelationshipData"),
    id: requireString(record, "id", "RelationshipData"),
  };
}

/** A single JSON:API relationship reference, wrapping the `data` resource identifier. */
export interface RelationshipRef {
  /** The referenced resource's type and id, if the relationship is populated. */
  data?: RelationshipData;
}

function parseRelationshipRef(value: unknown): RelationshipRef {
  const record = asRecord(value, "RelationshipRef");
  return {
    data: optionalObject(record, "data", "RelationshipRef", parseRelationshipData),
  };
}

/** JSON:API relationship references carried on an {@link OrderProductItem}. */
export interface OrderProductRelationships {
  /** Reference to the sideloaded `Publisher` resource, if present. */
  publisher?: RelationshipRef;
  /** Reference to the sideloaded `Product` resource, if present. */
  product?: RelationshipRef;
  /** Reference to the sideloaded `Order` resource, if present. */
  order?: RelationshipRef;
}

function parseOrderProductRelationships(value: unknown): OrderProductRelationships {
  const record = asRecord(value, "OrderProductRelationships");
  const context = "OrderProductRelationships";
  return {
    publisher: optionalObject(record, "publisher", context, parseRelationshipRef),
    product: optionalObject(record, "product", context, parseRelationshipRef),
    order: optionalObject(record, "order", context, parseRelationshipRef),
  };
}

/**
 * A single item in an ordered products collection response.
 *
 * Follows the JSON:API resource object structure with `id`, `type`, and `attributes`.
 *
 * The live API does *not* embed `publisher`/`product`/`order` metadata directly on
 * `attributes` for this endpoint (despite what earlier documentation examples showed) —
 * it references them via `relationships`, resolved against the response's top-level
 * `included` array. See {@link OrderProductRelationships} and {@link IncludedItem}.
 */
export interface OrderProductItem {
  /** The JSON:API resource identifier. */
  id: string;
  /** The JSON:API resource type string (e.g., `"order_product"`). */
  type: string;
  /** The full attribute set for this ordered product. */
  attributes: OrderProductAttributes;
  /**
   * JSON:API relationship references to sideloaded `Publisher`/`Product`/`Order`
   * resources, resolved by matching `id` against the response's `included` array.
   */
  relationships?: OrderProductRelationships;
}

function parseOrderProductItem(value: unknown): OrderProductItem {
  const record = asRecord(value, "OrderProductItem");
  const context = "OrderProductItem";
  return {
    id: requireString(record, "id", context),
    type: requireString(record, "type", context),
    attributes: parseOrderProductAttributes(record.attributes),
    relationships: optionalObject(record, "relationships", context, parseOrderProductRelationships),
  };
}

// ── Sideloaded resources (`included`) ────────────────────────────────────────

/** Attributes for a publisher resource included alongside ordered product responses. */
export interface PublisherAttributes {
  /** The display name of the publisher. */
  name: string;
  /** The unique identifier of the publisher. */
  publisherId: number;
  /** The URL slug for the publisher's storefront page. */
  slug: string;
}

function parsePublisherAttributes(value: unknown): PublisherAttributes {
  const record = asRecord(value, "PublisherAttributes");
  return {
    name: optionalString(record, "name", "PublisherAttributes") ?? "",
    publisherId: optionalNumber(record, "publisherId", "PublisherAttributes") ?? 0,
    slug: optionalString(record, "slug", "PublisherAttributes") ?? "",
  };
}

/**
 * A publisher resource item included in ordered product responses when requested.
 *
 * Follows the JSON:API resource object structure.
 */
export interface PublisherItem {
  /** The JSON:API resource identifier. */
  id: string;
  /** The JSON:API resource type string (e.g., `"publisher"`). */
  type: string;
  /** The publisher attributes. */
  attributes: PublisherAttributes;
}

/**
 * A single sideloaded resource entity from the `included` array of an ordered-products
 * response.
 *
 * The `included` array mixes multiple JSON:API resource types (`Publisher`, `Product`,
 * `Order`) in a single flat list; `type` disambiguates which, and `attributes` is kept
 * as an untyped value since its shape depends on `type`. Decode it via
 * {@link asPublisher} or {@link asProduct}.
 */
export interface IncludedItem {
  /** The JSON:API resource identifier. Matches a {@link RelationshipData.id} referencing it. */
  id: string;
  /** The JSON:API resource type string (e.g., `"Publisher"`, `"Product"`, `"Order"`). */
  type: string;
  /** The resource's untyped attribute payload; shape depends on `type`. */
  attributes: unknown;
}

function parseIncludedItem(value: unknown): IncludedItem {
  const record = asRecord(value, "IncludedItem");
  const context = "IncludedItem";
  if (!("attributes" in record)) {
    throw new TypeError(`expected ${context}.attributes to be present`);
  }
  return {
    id: requireString(record, "id", context),
    type: requireString(record, "type", context),
    attributes: record.attributes,
  };
}

/**
 * Decodes `item.attributes` as {@link PublisherAttributes} if `item.type === "Publisher"`.
 *
 * Returns `undefined` for any other resource type or if decoding fails.
 */
export function asPublisher(item: IncludedItem): PublisherAttributes | undefined {
  if (item.type !== "Publisher") {
    return undefined;
  }
  try {
    return parsePublisherAttributes(item.attributes);
  } catch {
    return undefined;
  }
}

/**
 * Decodes `item.attributes` as {@link OrderProductInfo} if `item.type === "Product"`.
 *
 * Returns `undefined` for any other resource type or if decoding fails.
 */
export function asProduct(item: IncludedItem): OrderProductInfo | undefined {
  if (item.type !== "Product") {
    return undefined;
  }
  try {
    return parseOrderProductInfo(item.attributes);
  } catch {
    return undefined;
  }
}

// ── Response wrappers ─────────────────────────────────────────────────────────

/**
 * A paginated collection of ordered products.
 *
 * Returned by `GET /{apiVersion}/order_products`.
 */
export interface OrderProductListResponse {
  /** Pagination links for navigating the result set. */
  links: PaginationLinks;
  /** Pagination metadata describing the current page. */
  meta: PaginationMeta;
  /** The ordered product items on this page. */
  data: OrderProductItem[];
  /** Publisher/Product/Order resources sideloaded alongside the ordered products. */
  included?: IncludedItem[];
}

/** Parses a raw JSON value into an {@link OrderProductListResponse}. */
export function parseOrderProductListResponse(value: unknown): OrderProductListResponse {
  const record = asRecord(value, "OrderProductListResponse");
  const context = "OrderProductListResponse";
  return {
    links: parsePaginationLinks(record.links),
    meta: parsePaginationMeta(record.meta),
    data: requireArray(record, "data", context, parseOrderProductItem),
    included: optionalArray(record, "included", context, parseIncludedItem),
  };
}

/**
 * A single ordered product resource response.
 *
 * Returned by `GET /{apiVersion}/order_products/{id}`.
 */
export interface OrderProductItemResponse {
  /** The ordered product item. */
  data: OrderProductItem;
  /**
   * Publisher/Product/Order resources sideloaded alongside the ordered product,
   * resolved by matching `relationships.*.data.id` against each entry's `id` (mirrors
   * {@link OrderProductListResponse.included}).
   */
  included?: IncludedItem[];
}

/** Parses a raw JSON value into an {@link OrderProductItemResponse}. */
export function parseOrderProductItemResponse(value: unknown): OrderProductItemResponse {
  const record = asRecord(value, "OrderProductItemResponse");
  const context = "OrderProductItemResponse";
  return {
    data: parseOrderProductItem(record.data),
    included: optionalArray(record, "included", context, parseIncludedItem),
  };
}

// ── Product Lists ─────────────────────────────────────────────────────────────

/** Attributes for a product list resource. */
export interface ProductListAttributes {
  /** The identifier of the customer who owns this list. */
  customerId: number;
  /** The display name of the product list. */
  name: string;
  /** The date the list was created (ISO 8601 string). */
  dateCreated: string;
  /** The unique identifier for this product list. */
  productListId: number;
  /** The URL slug for this product list. */
  slug: string;
  /** The number of items currently in this product list. */
  itemCount: number;
}

function parseProductListAttributes(value: unknown): ProductListAttributes {
  const record = asRecord(value, "ProductListAttributes");
  const context = "ProductListAttributes";
  return {
    customerId: requireNumber(record, "customerId", context),
    name: requireString(record, "name", context),
    dateCreated: requireString(record, "dateCreated", context),
    productListId: requireNumber(record, "productListId", context),
    slug: requireString(record, "slug", context),
    itemCount: requireNumber(record, "itemCount", context),
  };
}

/**
 * A single product list resource item.
 *
 * Follows the JSON:API resource object structure.
 */
export interface ProductListItem {
  /** The JSON:API resource identifier. */
  id: string;
  /** The JSON:API resource type string (e.g., `"product_list"`). */
  type: string;
  /** The product list attributes. */
  attributes: ProductListAttributes;
}

function parseProductListItem(value: unknown): ProductListItem {
  const record = asRecord(value, "ProductListItem");
  const context = "ProductListItem";
  return {
    id: requireString(record, "id", context),
    type: requireString(record, "type", context),
    attributes: parseProductListAttributes(record.attributes),
  };
}

/**
 * A paginated collection of product lists belonging to the authenticated customer.
 *
 * Returned by `GET /{apiVersion}/product_lists`.
 */
export interface ProductListCollectionResponse {
  /** Pagination links for navigating the result set. */
  links: PaginationLinks;
  /** Pagination metadata describing the current page. */
  meta: PaginationMeta;
  /** The product list items on this page. */
  data: ProductListItem[];
}

/** Parses a raw JSON value into a {@link ProductListCollectionResponse}. */
export function parseProductListCollectionResponse(value: unknown): ProductListCollectionResponse {
  const record = asRecord(value, "ProductListCollectionResponse");
  const context = "ProductListCollectionResponse";
  return {
    links: parsePaginationLinks(record.links),
    meta: parsePaginationMeta(record.meta),
    data: requireArray(record, "data", context, parseProductListItem),
  };
}

/**
 * A paginated collection of items within a specific product list.
 *
 * Returned by `GET /{apiVersion}/product_list_items`. Individual item schemas are not
 * yet formally defined by the API contract, so items are represented as raw `unknown`
 * values until the schema matures.
 */
export interface ProductListItemsResponse {
  /** Pagination links for navigating the result set. */
  links: PaginationLinks;
  /** Pagination metadata describing the current page. */
  meta: PaginationMeta;
  /** The raw product list item data on this page. */
  data: unknown[];
}

/** Parses a raw JSON value into a {@link ProductListItemsResponse}. */
export function parseProductListItemsResponse(value: unknown): ProductListItemsResponse {
  const record = asRecord(value, "ProductListItemsResponse");
  const context = "ProductListItemsResponse";
  const data = record.data;
  if (!Array.isArray(data)) {
    throw new TypeError(`expected ${context}.data to be an array`);
  }
  return {
    links: parsePaginationLinks(record.links),
    meta: parsePaginationMeta(record.meta),
    data,
  };
}

/**
 * Request body for adding a product to a product list.
 *
 * Sent by `POST /{apiVersion}/product_list_items`. The wire format is already
 * camelCase, so this interface is sent as-is via `JSON.stringify` — no `toWireX`
 * transformation function is needed.
 */
export interface ProductListItemCreateRequest {
  /** Unique identifier of the product to add. */
  productId: number;
  /** Unique identifier of the product list to add the product to. */
  productListId: number;
}

/**
 * The created product list item.
 *
 * Returned by `POST /{apiVersion}/product_list_items`. The API wraps this resource in a
 * JSON:API-style envelope on the wire (`{"data": {"id": ..., "type": ..., "attributes":
 * {"productId": ..., "productListId": ..., "productListItemId": ...}}}`);
 * {@link parseProductListItemCreateResponse} unwraps that envelope so callers work with
 * a flat object.
 */
export interface ProductListItemCreateResponse {
  /** Unique identifier of the product added to the list. */
  productId: number;
  /** Unique identifier of the product list the product was added to. */
  productListId: number;
  /**
   * Unique identifier assigned to this product list item. Required to remove the item
   * later via `DELETE /{apiVersion}/product_list_items/{id}`.
   */
  productListItemId: number;
}

/** Parses a raw JSON:API envelope into a flat {@link ProductListItemCreateResponse}. */
export function parseProductListItemCreateResponse(value: unknown): ProductListItemCreateResponse {
  const envelope = asRecord(value, "ProductListItemCreateResponse");
  const context = "ProductListItemCreateResponse";
  const resource = asRecord(envelope.data, `${context}.data`);
  const attributes = asRecord(resource.attributes, `${context}.data.attributes`);
  return {
    productId: requireNumber(attributes, "productId", `${context}.data.attributes`),
    productListId: requireNumber(attributes, "productListId", `${context}.data.attributes`),
    productListItemId: requireNumber(attributes, "productListItemId", `${context}.data.attributes`),
  };
}

/**
 * Parses a raw JSON:API envelope (`{"data": {...}}`) returned by
 * `POST /{apiVersion}/product_lists` into a flat {@link ProductListItem}.
 */
export function parseCreateProductListResponse(value: unknown): ProductListItem {
  const envelope = asRecord(value, "ProductListItem envelope");
  return parseProductListItem(envelope.data);
}

// ── Query parameter interfaces ────────────────────────────────────────────────

/**
 * Query parameters for the `GET /order_products` (library items) endpoint.
 *
 * All fields are optional. Set a field to include the corresponding query parameter in
 * the request.
 *
 * @example
 * ```ts
 * const params: LibraryItemsParams = { page: 2, pageSize: 50, getFilters: true };
 * ```
 */
export interface LibraryItemsParams {
  /** The page number to retrieve (1-based). */
  page?: number;
  /** The number of items to return per page. */
  pageSize?: number;
  /** When `true`, includes checksum data for each product file (`getChecksum=1`). */
  getChecksum?: boolean;
  /** When `true`, includes filter category data for each product (`getFilters=1`). */
  getFilters?: boolean;
  /** When `true`, restricts results to library (non-archived) products (`library=true`). */
  library?: boolean;
  /** When `true`, includes archived products; when `false`, excludes them (`archived=1/0`). */
  archived?: boolean;
  /**
   * ISO 8601 date string. When set, returns only products updated after this date
   * (`updatedDate[after]=...`).
   */
  updatedDateAfter?: string;
}

/**
 * Query parameters for paginated collection endpoints such as `/product_lists`.
 *
 * All fields are optional. Omit both to retrieve the first page with the server's
 * default page size.
 *
 * @example
 * ```ts
 * const params: PageParams = { page: 3, pageSize: 25 };
 * ```
 */
export interface PageParams {
  /** The page number to retrieve (1-based). */
  page?: number;
  /** The number of items to return per page. */
  pageSize?: number;
}
