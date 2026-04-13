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

test("resolveDouglasProductHtml prefers secure meta image and normalizes relative paths", () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="default/SEO_Open_Graphs_AB_Tests_4_.jpg" />
        <meta property="og:image:secure_url" content="https://douglas.bg/media/secure-example.jpg" />
        <meta property="og:availability" content="in stock" />
      </head>
      <body>
        <div class="product-view-custom-title">
          <h1 itemprop="name">Secure Image Product</h1>
        </div>
        <div class="product-info-main">
          <span class="sku-code">999001</span>
          <div class="price-box">
            <div class="final-price">
              <span class="price-wrapper">
                <span class="price">19,99 €</span>
              </span>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const resolved = resolveDouglasProductHtml(
    html,
    "https://douglas.bg/secure-image-product-999001",
  );

  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.imageUrl, "https://douglas.bg/media/secure-example.jpg");
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

test("resolveDouglasProductHtml prefers Douglas promo-code price for simple products", () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="https://douglas.bg/media/example.jpg" />
        <meta property="og:availability" content="in stock" />
      </head>
      <body>
        <div class="product-view-custom-title">
          <h1 itemprop="name">Tangle Teezer Wet Detangler Brush</h1>
        </div>
        <div class="product-info-main">
          <span class="sku-code">050732</span>
          <div class="price-box">
            <div class="final-price">
              <span class="price-wrapper">
                <span class="price">18,15 €</span>
                <span class="side-price"> /35,50 лв.</span>
              </span>
            </div>
          </div>
          <p class="stock stock-availability">Наличен</p>
        </div>
        <div id="stenik-rule-discount">
          <div class="discount-block">
            <span class="discount-price">
              <span class="price">14,52 €</span>
              <span class="side-price"> /28,40 лв.</span>
            </span>
            <span class="discount-text">с код</span>
            <span class="discount-code">EGG20</span>
          </div>
        </div>
      </body>
    </html>
  `;

  const resolved = resolveDouglasProductHtml(
    html,
    "https://douglas.bg/tangle-teezer-wet-detangler-brush-50732",
  );

  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.price, 14.52);
  assert.equal(resolved.originalPrice, 18.15);
  assert.equal(resolved.discountCode, "EGG20");
});

test("resolveDouglasProductHtml ignores configurable function definitions on simple pages", () => {
  const html = `
    <html>
      <head>
        <meta property="og:image:secure_url" content="https://douglas.bg/media/simple.jpg" />
        <meta property="og:availability" content="in stock" />
      </head>
      <body>
        <div class="product-view-custom-title">
          <h1 itemprop="name">YVES SAINT LAURENT Myslf</h1>
        </div>
        <div class="product-info-main">
          <span class="sku-code">091138</span>
          <div id="weight-container">150ML</div>
          <div class="price-box">
            <div class="final-price">
              <span class="price-wrapper">
                <span class="price">201,45 €</span>
              </span>
            </div>
          </div>
          <p class="stock stock-availability">Наличен</p>
        </div>
        <script>
          window.component = {
            utag_data: {
              "primary_product_id": ["091138"],
              "primary_product_master_id": ["091138"],
              "primary_product_master_name": ["YVES SAINT LAURENT Myslf"],
              "primary_product_price": ["201.45"],
              "primary_product_price_regular": ["201.45"],
              "primary_product_size": ["150ML"],
              "primary_product_availability_status": ["Available"]
            }
          };
        </script>
        <script>
          function initConfigurableOptions(productId, optionConfig) {
            return { productId, optionConfig };
          }
        </script>
      </body>
    </html>
  `;

  const resolved = resolveDouglasProductHtml(
    html,
    "https://douglas.bg/yves-saint-laurent-myslf-91138",
  );

  assert.equal(resolved.kind, "simple");
  assert.equal(resolved.productCode, "091138");
  assert.equal(resolved.price, 201.45);
  assert.equal(resolved.inStock, true);
  assert.equal(resolved.variantText, "150ML");
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

test("resolveDouglasProductHtml prefers promo-code prices for configurable variants", () => {
  const html = `
    <html>
      <body>
        <div class="product-view-custom-title">
          <h1 itemprop="name">YVES SAINT LAURENT Libre Berry Crush</h1>
        </div>
        <div class="product-info-main">
          <span class="sku-code">conf-91627</span>
        </div>
        <script>
          window.component = {
            utag_data: {
              "currency": "EUR",
              "primary_product_id": ["091627"],
              "primary_product_master_id": ["conf-91627"],
              "primary_product_master_name": ["YVES SAINT LAURENT Libre Berry Crush"],
              "simpleProducts": {
                "id-3001": {
                  "primary_product_id": ["091627"],
                  "primary_product_master_id": ["conf-91627"],
                  "primary_product_price": ["104.00"],
                  "primary_product_price_regular": ["104.00"],
                  "primary_product_variant_name": ["30ML"],
                  "primary_product_size": ["30ML"],
                  "primary_product_availability_status": ["Available"]
                },
                "id-3002": {
                  "primary_product_id": ["091628"],
                  "primary_product_master_id": ["conf-91627"],
                  "primary_product_price": ["147.00"],
                  "primary_product_price_regular": ["147.00"],
                  "primary_product_variant_name": ["50ML"],
                  "primary_product_size": ["50ML"],
                  "primary_product_availability_status": ["Available"]
                }
              }
            }
          };
        </script>
        <script>
          initConfigurableOptions("master-91627", {
            "attributes": {
              "183": {
                "options": [
                  { "id": "3001", "label": "30ML", "products": ["3001"] },
                  { "id": "3002", "label": "50ML", "products": ["3002"] }
                ]
              }
            },
            "optionPrices": {
              "3001": {
                "oldPrice": { "amount": 104 },
                "finalPrice": { "amount": 104 }
              },
              "3002": {
                "oldPrice": { "amount": 147 },
                "finalPrice": { "amount": 147 }
              }
            },
            "images": {
              "3001": [
                {
                  "full": "https://douglas.bg/media/30ml.jpg",
                  "isMain": true
                }
              ],
              "3002": [
                {
                  "full": "https://douglas.bg/media/50ml.jpg",
                  "isMain": true
                }
              ]
            },
            "sku": {
              "3001": "091627",
              "3002": "091628"
            },
            "salable_product": {
              "3001": { "is_salable": true },
              "3002": { "is_salable": true }
            },
            "default_selected_product_id": "3001"
          });
        </script>

        <div class="variant-row">
          <div class="variant-size">30ML</div>
          <div class="variant-price">104,00 € / 203,41 лв.</div>
          <div class="discount-block">
            <div class="discount-price">83,20 € / 162,73 лв.</div>
            <div class="discount-text">с код</div>
            <div class="discount-code">EGG20</div>
          </div>
        </div>

        <div class="variant-row">
          <div class="variant-size">50ML</div>
          <div class="variant-price">147,00 € / 287,51 лв.</div>
          <div class="discount-block">
            <div class="discount-price">117,60 € / 230,01 лв.</div>
            <div class="discount-text">с код</div>
            <div class="discount-code">EGG20</div>
          </div>
        </div>
      </body>
    </html>
  `;

  const resolved = resolveDouglasProductHtml(
    html,
    "https://douglas.bg/yves-saint-laurent-libre-berry-crush-conf-91627",
  );

  assert.equal(resolved.kind, "configurable");
  assert.equal(resolved.discountCode, "EGG20");
  assert.deepEqual(
    resolved.variants.map((variant) => ({
      code: variant.variantCode,
      price: variant.price,
      originalPrice: variant.originalPrice,
    })),
    [
      {
        code: "091627",
        price: 83.2,
        originalPrice: 104,
      },
      {
        code: "091628",
        price: 117.6,
        originalPrice: 147,
      },
    ],
  );
});
