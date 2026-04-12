import assert from "node:assert/strict";
import test from "node:test";

import {
  extractDiscountCodeFromHtml,
  extractDiscountCodeFromText,
  normalizeDiscountCode,
} from "@/lib/discount-code";

test("extractDiscountCodeFromText finds english promo code phrases", () => {
  assert.equal(
    extractDiscountCodeFromText("Save more today with code spring20 at checkout."),
    "SPRING20",
  );
});

test("extractDiscountCodeFromText finds bulgarian code phrases", () => {
  assert.equal(
    extractDiscountCodeFromText("Вземи отстъпка с код beauty15 до края на деня."),
    "BEAUTY15",
  );
});

test("normalizeDiscountCode rejects free text", () => {
  assert.equal(normalizeDiscountCode("special spring offer"), null);
});

test("extractDiscountCodeFromHtml finds a code split by markup", () => {
  assert.equal(
    extractDiscountCodeFromHtml(
      '<div><span>26,52 €</span><span>с код <span class="promo">sale</span></span></div>',
    ),
    "SALE",
  );
});

test("extractDiscountCodeFromText ignores plain product code labels", () => {
  assert.equal(
    extractDiscountCodeFromText("код RIM04203 цвят розов, коралов"),
    null,
  );
});
