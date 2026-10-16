---
title: Library client
version: latest
slug: library-client
---

# Library client

`LibraryClient` is an authenticated HTTP client for DriveThruRPG library
endpoints. Create one from a configured, authenticated SDK instance:

```ts
const client = sdk.libraryClient();
```

This throws `UnconfiguredError` or `UnauthenticatedError` if the SDK isn't
ready, so you don't need to check `sdk.config`/`sdk.session` yourself first.

## Ordered products

```ts
// List a page of the authenticated user's library.
const products = await client.listOrderProducts({ page: 1, pageSize: 25 });

// Fetch a single ordered product by id.
const product = await client.getOrderProduct(515_276);

// Prepare a download for a specific file within an ordered product.
// `index` matches `OrderProductFile.index` and has no default - it must be
// supplied explicitly.
const download = await client.prepareDownload(515_276, 0);
```

`listOrderProducts` accepts optional query parameters via `LibraryItemsParams`:
`page`, `pageSize`, `getChecksum`, `getFilters`, `library`, `archived`, and
`updatedDateAfter`.

## Product lists

```ts
// List the authenticated user's product lists.
const lists = await client.listProductLists({});

// Create a new product list.
const list = await client.createProductList("Wishlist");

// Add a product to a list.
const item = await client.addProductListItem(list.attributes.productListId, 515_276);

// List items within a product list.
const items = await client.listProductListItems(list.attributes.productListId, {});

// Remove an item from a list (by the item's own id, not the product's id).
await client.deleteProductListItem(item.productListItemId);

// Delete the list itself.
await client.deleteProductList(list.attributes.productListId);
```

## Sideloaded resources

`listOrderProducts` and `getOrderProduct` responses may include an
`included` array of sideloaded `Publisher`/`Product`/`Order` resources,
referenced from an item's `relationships`. Resolve them with `asPublisher`
and `asProduct`:

```ts
import { asProduct, asPublisher } from "@pilgrimagesoftware/dtrpg-sdk";

for (const item of products.included ?? []) {
  const publisher = asPublisher(item);
  const product = asProduct(item);
}
```

Both helpers return `undefined` for a resource of the wrong type or a shape
that fails to decode, rather than throwing.
