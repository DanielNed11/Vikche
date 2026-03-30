import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDouglasSnapshot,
  resolveDouglasProductHtml,
} from "@/lib/douglas/parser";
import { normalizeDouglasUrl } from "@/lib/douglas/url";

test("normalizeDouglasUrl canonicalizes Douglas product URLs", () => {
  assert.equal(
    normalizeDouglasUrl(
      "https://www.douglas.bg/opi-infinite-shine-60448?foo=bar#details",
    ),
    "https://douglas.bg/opi-infinite-shine-60448",
  );
});

test("normalizeDouglasUrl strips Douglas mobile app product prefixes", () => {
  assert.equal(
    normalizeDouglasUrl("https://douglas.bg/product/mac-lip-pencil-conf-78140"),
    "https://douglas.bg/mac-lip-pencil-conf-78140",
  );

  assert.equal(
    normalizeDouglasUrl("https://douglas.bg/products/mac-lip-pencil-conf-78140"),
    "https://douglas.bg/mac-lip-pencil-conf-78140",
  );
});

test("resolveDouglasProductHtml extracts a simple EUR-priced product", () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="https://douglas.bg/media/example.jpg" />
        <meta property="og:availability" content="in stock" />
      </head>
      <body>
        <div class="product-view-custom-title">
          <h1 itemprop="name">OPI Infinite Shine Лак за нокти</h1>
        </div>
        <div class="product-info-main">
          <span class="sku-code">060448</span>
          <div id="weight-container">15ML</div>
          <div class="price-box">
            <div class="final-price">
              <span class="price-wrapper">
                <span class="price">15,34 €</span>
                <span class="side-price"> /30,00 лв.</span>
              </span>
            </div>
            <div class="old-price">
              <span class="price-wrapper">
                <span class="price">18,40 €</span>
                <span class="side-price"> /36,00 лв.</span>
              </span>
            </div>
          </div>
          <p class="stock stock-availability">В наличност</p>
        </div>
      </body>
    </html>
  `;

  const resolved = resolveDouglasProductHtml(
    html,
    "https://douglas.bg/opi-infinite-shine-60448",
  );

  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.title, "OPI Infinite Shine Лак за нокти");
  assert.equal(resolved.productCode, "060448");
  assert.equal(resolved.price, 15.34);
  assert.equal(resolved.originalPrice, 18.4);
  assert.equal(resolved.inStock, true);
  assert.equal(resolved.variantText, "15ML");
  assert.equal(resolved.imageUrl, "https://douglas.bg/media/example.jpg");
});

test("resolveDouglasProductHtml detects out-of-stock simple products", () => {
  const html = `
    <html>
      <head>
        <meta property="og:availability" content="out of stock" />
      </head>
      <body>
        <div class="product-view-custom-title">
          <h1 itemprop="name">Douglas Test Product</h1>
        </div>
        <div class="product-info-main">
          <span class="sku-code">123456</span>
          <div class="price-box">
            <div class="final-price">
              <span class="price-wrapper">
                <span class="price">24,99 €</span>
              </span>
            </div>
          </div>
          <p class="stock stock-availability">Няма наличност</p>
        </div>
      </body>
    </html>
  `;

  const resolved = resolveDouglasProductHtml(
    html,
    "https://douglas.bg/test-product-123456",
  );

  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.inStock, false);
  assert.equal(resolved.price, 24.99);
});

test("resolveDouglasProductHtml returns configurable variants and builds exact snapshots", () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="https://douglas.bg/media/master.jpg" />
      </head>
      <body>
        <div class="product-view-custom-title">
          <h1 itemprop="name">DIOR Forever Skin Correct Коректор</h1>
        </div>
        <div class="product-info-main">
          <span class="sku-code">conf-70639</span>
          <div id="weight-container">11ML</div>
        </div>
        <script>
          window.component = {
            utag_data: {
              "currency": "EUR",
              "primary_product_id": ["070640"],
              "primary_product_master_id": ["conf-70639"],
              "primary_product_master_name": ["DIOR Forever Skin Correct"],
              "simpleProducts": {
                "id-183076": {
                  "primary_product_id": ["070640"],
                  "primary_product_master_id": ["conf-70639"],
                  "primary_product_price": ["42.00"],
                  "primary_product_price_regular": ["42.00"],
                  "primary_product_variant_name": ["1N"],
                  "primary_product_color": ["1N"],
                  "primary_product_size": ["11ML"],
                  "primary_product_availability_status": ["Available"]
                },
                "id-183114": {
                  "primary_product_id": ["070659"],
                  "primary_product_master_id": ["conf-70639"],
                  "primary_product_price": ["42.00"],
                  "primary_product_price_regular": ["42.00"],
                  "primary_product_variant_name": ["6N"],
                  "primary_product_color": ["6N"],
                  "primary_product_size": ["11ML"],
                  "primary_product_availability_status": ["Available"]
                }
              }
            },
            simples: null
          };
        </script>
        <script>
          initConfigurableOptions("183257", {
            "attributes": {
              "183": {
                "options": [
                  { "id": "18693", "label": "1N", "products": ["183076"] },
                  { "id": "30728", "label": "6N", "products": ["183114"] }
                ]
              }
            },
            "optionPrices": {
              "183076": {
                "oldPrice": { "amount": 42 },
                "finalPrice": { "amount": 42 }
              },
              "183114": {
                "oldPrice": { "amount": 42 },
                "finalPrice": { "amount": 42 }
              }
            },
            "images": {
              "183076": [
                {
                  "full": "https://douglas.bg/media/1n.jpg",
                  "img": "https://douglas.bg/media/1n.jpg",
                  "thumb": "https://douglas.bg/media/1n-thumb.jpg",
                  "isMain": true
                }
              ],
              "183114": [
                {
                  "full": "https://douglas.bg/media/6n.jpg",
                  "img": "https://douglas.bg/media/6n.jpg",
                  "thumb": "https://douglas.bg/media/6n-thumb.jpg",
                  "isMain": true
                }
              ]
            },
            "sku": {
              "183076": "070640",
              "183114": "070659"
            },
            "salable_product": {
              "183076": { "is_salable": true },
              "183114": { "is_salable": true }
            },
            "default_selected_product_id": "183076"
          });
        </script>
      </body>
    </html>
  `;

  const resolved = resolveDouglasProductHtml(
    html,
    "https://douglas.bg/dior-forever-skin-correct-conf-70639",
  );

  assert.equal(resolved.kind, "configurable");
  assert.equal(resolved.masterProductCode, "conf-70639");
  assert.equal(resolved.defaultVariantCode, "070640");
  assert.equal(resolved.variants.length, 2);
  assert.deepEqual(
    resolved.variants.map((variant) => variant.variantCode),
    ["070640", "070659"],
  );

  const snapshot = buildDouglasSnapshot(resolved, "http", "070659");

  assert.equal(snapshot.productCode, "070659");
  assert.equal(snapshot.masterProductCode, "conf-70639");
  assert.equal(snapshot.variantLabel, "6N");
  assert.equal(snapshot.price, 42);
  assert.equal(snapshot.currency, "EUR");
  assert.equal(snapshot.imageUrl, "https://douglas.bg/media/6n.jpg");
  assert.equal(snapshot.variantText, "11ML");
});
