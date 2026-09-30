import test from "node:test";
import assert from "node:assert/strict";
import {
  extractionSchema,
  normalizeAccountLast4,
  normalizeExtractionInput,
} from "../validators/document.validators.js";

for (const [input, expected] of [
  ["****1234", "1234"],
  ["XXXX1234", "1234"],
  ["ending in 1234", "1234"],
  ["Account: 1234", "1234"],
  ["1234", "1234"],
  ["N/A", null],
  ["", null],
  [null, null],
  ["abcdef", null],
]) {
  test(`normalizes accountLast4 from ${JSON.stringify(input)}`, () => {
    assert.equal(normalizeAccountLast4(input), expected);
  });
}

test("normalized accountLast4 passes the strict extraction schema", () => {
  const result = extractionSchema.parse(
    normalizeExtractionInput({ accountLast4: "Account ending 1234" }),
  );
  assert.equal(result.accountLast4, "1234");
});

test("nullable money preserves null instead of coercing it to zero", () => {
  const result = extractionSchema.parse({ subtotal: null, taxAmount: null });
  assert.equal(result.subtotal, null);
  assert.equal(result.taxAmount, null);
});
