import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Config } from "../config.js";
import { ApiError, DecodeFailedError, HttpError } from "../errors.js";

import { LibraryClient } from "./client.js";
import { asPublisher } from "./models.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function clientFor(): LibraryClient {
  const config = new Config({ applicationKey: "test-app-key", baseUrl: "http://mock-api" });
  return new LibraryClient(config, "test-token");
}

describe("LibraryClient authorization header", () => {
  it("sends the raw token with no Bearer prefix", async () => {
    let authHeader: string | null = null;
    server.use(
      http.get("http://mock-api/vBeta/order_products", ({ request }) => {
        authHeader = request.headers.get("Authorization");
        return HttpResponse.json({
          links: { self: "http://mock-api/vBeta/order_products" },
          meta: { itemsPerPage: 25, currentPage: 1 },
          data: [],
        });
      }),
    );

    await clientFor().listOrderProducts();

    expect(authHeader).toBe("test-token");
  });
});

describe("listOrderProducts", () => {
  it("returns a deserialized OrderProductListResponse on success", async () => {
    server.use(
      http.get("http://mock-api/vBeta/order_products", () =>
        HttpResponse.json({
          links: { self: "http://mock-api/vBeta/order_products" },
          meta: { itemsPerPage: 25, currentPage: 1 },
          data: [
            {
              id: "/api/vBeta/order_products/22654728",
              type: "order_product",
              attributes: {
                orderId: 7_332_333,
                productId: 144_239,
                royaltyPublisherId: 117,
                name: "Common Places - Free Map #1",
                finalPrice: 0,
                quantity: 1,
                bundleId: 0,
                archived: 0,
                orderProductId: 22_654_728,
                customerId: 399_144,
                files: [],
              },
            },
          ],
        }),
      ),
    );

    const result = await clientFor().listOrderProducts({ page: 1, pageSize: 25 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.attributes.name).toBe("Common Places - Free Map #1");
  });

  it("includes all defined query parameters", async () => {
    let queryString = "";
    server.use(
      http.get("http://mock-api/vBeta/order_products", ({ request }) => {
        queryString = new URL(request.url).search;
        return HttpResponse.json({
          links: { self: "x" },
          meta: { itemsPerPage: 25, currentPage: 1 },
          data: [],
        });
      }),
    );

    await clientFor().listOrderProducts({
      page: 2,
      pageSize: 50,
      getChecksum: true,
      getFilters: true,
      library: true,
      archived: false,
      updatedDateAfter: "2026-01-01",
    });

    expect(queryString).toContain("page=2");
    expect(queryString).toContain("pageSize=50");
    expect(queryString).toContain("getChecksum=1");
    expect(queryString).toContain("getFilters=1");
    expect(queryString).toContain("library=true");
    expect(queryString).toContain("archived=0");
    expect(queryString).toContain("updatedDate%5Bafter%5D=2026-01-01");
  });

  it("throws ApiError without attempting a success-schema decode on a non-success status", async () => {
    server.use(
      http.get("http://mock-api/vBeta/order_products", () =>
        HttpResponse.json({ message: "unauthorized" }, { status: 401 }),
      ),
    );

    const error = await clientFor()
      .listOrderProducts()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).apiMessage).toBe("unauthorized");
  });

  it("throws DecodeFailedError when the success body is malformed", async () => {
    server.use(
      http.get("http://mock-api/vBeta/order_products", () =>
        HttpResponse.json({ not: "the expected shape" }),
      ),
    );

    await expect(clientFor().listOrderProducts()).rejects.toBeInstanceOf(DecodeFailedError);
  });
});

describe("getOrderProduct", () => {
  it("decodes a sideloaded included array", async () => {
    server.use(
      http.get("http://mock-api/vBeta/order_products/22654728", () =>
        HttpResponse.json({
          data: {
            id: "/api/vBeta/order_products/22654728",
            type: "order_product",
            attributes: {
              orderId: 7_332_333,
              productId: 144_239,
              royaltyPublisherId: 117,
              name: "Common Places - Free Map #1",
              finalPrice: 0,
              quantity: 1,
              bundleId: 0,
              archived: 0,
              orderProductId: 22_654_728,
              customerId: 399_144,
              files: [],
            },
            relationships: {
              publisher: { data: { type: "Publisher", id: "/api/vBeta/publishers/117" } },
            },
          },
          included: [
            {
              id: "/api/vBeta/publishers/117",
              type: "Publisher",
              attributes: {
                name: "The Forge Studios",
                publisherId: 117,
                slug: "the-forge-studios",
              },
            },
          ],
        }),
      ),
    );

    const result = await clientFor().getOrderProduct(22_654_728);

    expect(result.included).toHaveLength(1);
    const publisher = result.included?.[0] ? asPublisher(result.included[0]) : undefined;
    expect(publisher?.name).toBe("The Forge Studios");
  });

  it("throws ApiError on a non-success status", async () => {
    server.use(
      http.get("http://mock-api/vBeta/order_products/1", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );

    await expect(clientFor().getOrderProduct(1)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("prepareDownload", () => {
  it("sends the index and returns the raw response on success", async () => {
    let queryIndex: string | null = null;
    server.use(
      http.get("http://mock-api/vBeta/order_products/515276/prepare", ({ request }) => {
        queryIndex = new URL(request.url).searchParams.get("index");
        return HttpResponse.json({ downloadUrl: "https://example.com/file.pdf" });
      }),
    );

    const result = await clientFor().prepareDownload(515_276, 0);

    expect(queryIndex).toBe("0");
    expect(result).toEqual({ downloadUrl: "https://example.com/file.pdf" });
  });

  it("requires index at compile time — no overload or default omits it", () => {
    const client = clientFor();
    // @ts-expect-error index is a required parameter, there is no default
    void client.prepareDownload(515_276).catch(() => undefined);
  });

  it("throws ApiError on a non-success status", async () => {
    server.use(
      http.get("http://mock-api/vBeta/order_products/1/prepare", () =>
        HttpResponse.json({ message: "index out of range" }, { status: 400 }),
      ),
    );

    await expect(clientFor().prepareDownload(1, 99)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("listProductLists", () => {
  it("returns a deserialized ProductListCollectionResponse on success", async () => {
    server.use(
      http.get("http://mock-api/vBeta/product_lists", () =>
        HttpResponse.json({
          links: { self: "x" },
          meta: { itemsPerPage: 25, currentPage: 1 },
          data: [
            {
              id: "/api/vBeta/product_lists/86267",
              type: "ProductList",
              attributes: {
                customerId: 399_144,
                name: "Testing",
                dateCreated: "2026-07-09T00:42:39-05:00",
                productListId: 86_267,
                slug: "testing",
                itemCount: 0,
              },
            },
          ],
        }),
      ),
    );

    const result = await clientFor().listProductLists({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.attributes.productListId).toBe(86_267);
  });

  it("throws ApiError on a non-success status", async () => {
    server.use(
      http.get("http://mock-api/vBeta/product_lists", () => HttpResponse.json({}, { status: 500 })),
    );

    await expect(clientFor().listProductLists({})).rejects.toBeInstanceOf(ApiError);
  });
});

describe("listProductListItems", () => {
  it("returns a deserialized ProductListItemsResponse on success", async () => {
    server.use(
      http.get("http://mock-api/vBeta/product_list_items", ({ request }) => {
        expect(new URL(request.url).searchParams.get("productListId")).toBe("86151");
        return HttpResponse.json({
          links: { self: "x" },
          meta: { itemsPerPage: 25, currentPage: 1 },
          data: [{ any: "shape" }],
        });
      }),
    );

    const result = await clientFor().listProductListItems(86_151, {});

    expect(result.data).toHaveLength(1);
  });

  it("throws DecodeFailedError on a malformed success body", async () => {
    server.use(
      http.get("http://mock-api/vBeta/product_list_items", () =>
        HttpResponse.json({ links: { self: "x" }, meta: { itemsPerPage: 25, currentPage: 1 } }),
      ),
    );

    await expect(clientFor().listProductListItems(1, {})).rejects.toBeInstanceOf(DecodeFailedError);
  });
});

describe("createProductList", () => {
  it("decodes the JSON:API envelope on success", async () => {
    server.use(
      http.post("http://mock-api/vBeta/product_lists", () =>
        HttpResponse.json(
          {
            data: {
              id: "/api/vBeta/product_lists/86267",
              type: "ProductList",
              attributes: {
                customerId: 399_144,
                name: "Testing",
                dateCreated: "2026-07-09T00:42:39-05:00",
                productListId: 86_267,
                slug: "testing",
                itemCount: 0,
              },
            },
          },
          { status: 201 },
        ),
      ),
    );

    const result = await clientFor().createProductList("Testing");

    expect(result.id).toBe("/api/vBeta/product_lists/86267");
    expect(result.attributes.productListId).toBe(86_267);
    expect(result.attributes.name).toBe("Testing");
  });

  it("throws ApiError on a non-success status", async () => {
    server.use(
      http.post("http://mock-api/vBeta/product_lists", () =>
        HttpResponse.json({ message: "name is required" }, { status: 422 }),
      ),
    );

    const error = await clientFor()
      .createProductList("")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).apiMessage).toBe("name is required");
  });
});

describe("deleteProductList", () => {
  it("succeeds on a 204 with no body parsing", async () => {
    server.use(
      http.delete(
        "http://mock-api/vBeta/product_lists/86151",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(clientFor().deleteProductList(86_151)).resolves.toBeUndefined();
  });

  it("throws HttpError on a non-success status", async () => {
    server.use(
      http.delete(
        "http://mock-api/vBeta/product_lists/86151",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    await expect(clientFor().deleteProductList(86_151)).rejects.toBeInstanceOf(HttpError);
  });
});

describe("addProductListItem", () => {
  it("returns the created item, decoding the JSON:API envelope", async () => {
    server.use(
      http.post("http://mock-api/vBeta/product_list_items", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({ productId: 515_276, productListId: 86_151 });
        return HttpResponse.json(
          {
            data: {
              id: "/api/vBeta/product_list_items/2629321",
              type: "ProductListItem",
              attributes: {
                productId: 515_276,
                productListId: 86_151,
                productListItemId: 2_629_321,
              },
            },
          },
          { status: 201 },
        );
      }),
    );

    const result = await clientFor().addProductListItem(86_151, 515_276);

    expect(result.productId).toBe(515_276);
    expect(result.productListId).toBe(86_151);
    expect(result.productListItemId).toBe(2_629_321);
  });

  it("throws ApiError on a non-success status", async () => {
    server.use(
      http.post("http://mock-api/vBeta/product_list_items", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );

    const error = await clientFor()
      .addProductListItem(86_151, 515_276)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });

  it("extracts a nested error.message on a validation conflict", async () => {
    server.use(
      http.post("http://mock-api/vBeta/product_list_items", () =>
        HttpResponse.json(
          {
            error: {
              id: "6a4ee5880bfda",
              message: "productId: Requires a valid Product ID. Invalid value 22654728.",
              code: 409,
              status: 409,
            },
          },
          { status: 409 },
        ),
      ),
    );

    const error = await clientFor()
      .addProductListItem(86_151, 22_654_728)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).apiMessage).toBe(
      "productId: Requires a valid Product ID. Invalid value 22654728.",
    );
  });

  it("does not surface a Retry-After when the header is absent", async () => {
    server.use(
      http.post("http://mock-api/vBeta/product_list_items", () =>
        HttpResponse.json({}, { status: 404 }),
      ),
    );

    const error = await clientFor()
      .addProductListItem(86_151, 515_276)
      .catch((caught: unknown) => caught);

    expect((error as ApiError).retryAfter).toBeUndefined();
  });

  it("surfaces retryAfter as a number when Retry-After is delay-seconds", async () => {
    server.use(
      http.post(
        "http://mock-api/vBeta/product_list_items",
        () => new HttpResponse(null, { status: 429, headers: { "Retry-After": "30" } }),
      ),
    );

    const error = await clientFor()
      .addProductListItem(86_151, 515_276)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).retryAfter).toBe(30);
  });

  it("leaves retryAfter undefined for an HTTP-date Retry-After value", async () => {
    server.use(
      http.post(
        "http://mock-api/vBeta/product_list_items",
        () =>
          new HttpResponse(null, {
            status: 429,
            headers: { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" },
          }),
      ),
    );

    const error = await clientFor()
      .addProductListItem(86_151, 515_276)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).retryAfter).toBeUndefined();
  });
});

describe("deleteProductListItem", () => {
  it("succeeds on a 204", async () => {
    server.use(
      http.delete(
        "http://mock-api/vBeta/product_list_items/2629321",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(clientFor().deleteProductListItem(2_629_321)).resolves.toBeUndefined();
  });

  it("throws HttpError on a non-success status", async () => {
    server.use(
      http.delete(
        "http://mock-api/vBeta/product_list_items/2629321",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    await expect(clientFor().deleteProductListItem(2_629_321)).rejects.toBeInstanceOf(HttpError);
  });
});
