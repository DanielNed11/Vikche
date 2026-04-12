import assert from "node:assert/strict";
import test from "node:test";

import { resolveGenericProductHtml } from "@/lib/generic/parser";

test("resolveGenericProductHtml extracts a generic product from JSON-LD", () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Nike Air Force 1 '07",
            "sku": "AF1-001",
            "image": "https://example.com/images/af1.jpg",
            "offers": {
              "@type": "Offer",
              "priceCurrency": "EUR",
              "price": "119.99",
              "availability": "https://schema.org/InStock"
            }
          }
        </script>
      </head>
      <body></body>
    </html>
  `;

  const resolved = resolveGenericProductHtml(
    html,
    "https://shop.example.com/products/air-force-1",
  );

  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.retailer, "shop.example.com");
  assert.equal(resolved.title, "Nike Air Force 1 '07");
  assert.equal(resolved.productCode, "AF1-001");
  assert.equal(resolved.price, 119.99);
  assert.equal(resolved.inStock, true);
  assert.equal(resolved.imageUrl, "https://example.com/images/af1.jpg");
});

test("resolveGenericProductHtml falls back to page metadata and visible EUR price", () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Generic Product Title" />
        <meta property="og:image" content="/media/product.jpg" />
      </head>
      <body>
        <h1>Generic Product Title</h1>
        <div class="price">54,20 €</div>
        <div>В наличност</div>
      </body>
    </html>
  `;

  const resolved = resolveGenericProductHtml(
    html,
    "https://shop.example.com/products/generic-product",
  );

  assert.equal(resolved.title, "Generic Product Title");
  assert.equal(resolved.price, 54.2);
  assert.equal(resolved.inStock, true);
  assert.equal(
    resolved.imageUrl,
    "https://shop.example.com/media/product.jpg",
  );
  assert.equal(
    resolved.productCode,
    "shop.example.com/products/generic-product",
  );
});

test("resolveGenericProductHtml keeps stock unknown when the page does not say", () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Quiet Product" />
      </head>
      <body>
        <h1>Quiet Product</h1>
        <div class="price">89,00 €</div>
      </body>
    </html>
  `;

  const resolved = resolveGenericProductHtml(
    html,
    "https://shop.example.com/products/quiet-product",
  );

  assert.equal(resolved.title, "Quiet Product");
  assert.equal(resolved.price, 89);
  assert.equal(resolved.inStock, null);
});
