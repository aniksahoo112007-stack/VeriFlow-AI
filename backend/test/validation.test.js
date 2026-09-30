import test from "node:test";
import assert from "node:assert/strict";
import {
  assessRisk,
  validateDocument,
} from "../services/validation.service.js";

const noRows = {
  from: () => ({
    select: () => ({
      eq: () => ({
        neq: () => ({
          ilike: () => ({
            ilike: () => ({ limit: async () => ({ data: [] }) }),
          }),
        }),
      }),
    }),
  }),
};

test("risk is capped and categorized", () => {
  const risk = assessRisk([
    { code: "LIKELY_DUPLICATE", passed: false },
    { code: "PO_AMOUNT_MISMATCH", passed: false },
    { code: "MISSING_TOTAL", passed: false },
  ]);
  assert.deepEqual(risk, { score: 80, level: "high" });
});

test("basic deterministic validation catches missing total", async () => {
  const results = await validateDocument(
    {
      id: "1",
      user_id: "u",
      vendor_name: null,
      document_number: null,
      document_date: null,
      total_amount: null,
    },
    noRows,
  );
  assert.ok(results.some((item) => item.code === "MISSING_TOTAL"));
  assert.equal(assessRisk(results).level, "medium");
});

test("new identifier and anomaly evidence uses weighted risk", () => {
  const risk = assessRisk([
    { code: "DUPLICATE_UTR", passed: false },
    { code: "INVALID_GSTIN", passed: false },
    { code: "AI_ANOMALY_WARNING", passed: false },
  ]);
  assert.deepEqual(risk, { score: 65, level: "high" });
});

test("documents without suspicious evidence remain low risk", () => {
  assert.deepEqual(assessRisk([]), { score: 0, level: "low" });
  assert.deepEqual(
    assessRisk([{ code: "TOTAL_MATCH", passed: true }]),
    { score: 0, level: "low" },
  );
});

const monetaryDocument = (overrides) => ({
  id: "money-test",
  user_id: "user-test",
  document_type: "other",
  vendor_name: "Vendor",
  document_number: null,
  total_amount: 60000,
  ...overrides,
});

test("skips total consistency when subtotal and tax sources are unavailable", async () => {
  const results = await validateDocument(
    monetaryDocument({ subtotal: null, tax_amount: null }),
    noRows,
  );
  assert.equal(results.some((item) => item.code === "TOTAL_MISMATCH"), false);
  assert.equal(results.some((item) => item.code === "TOTAL_MATCH"), false);
});

test("passes explicit subtotal, tax, discount, and total", async () => {
  const results = await validateDocument(
    monetaryDocument({ subtotal: 50000, tax_amount: 10000, discount: 0 }),
    noRows,
  );
  assert.equal(results.some((item) => item.code === "TOTAL_MATCH"), true);
});

test("fails a genuine subtotal and tax mismatch", async () => {
  const results = await validateDocument(
    monetaryDocument({ subtotal: 50000, tax_amount: 9000, discount: 0 }),
    noRows,
  );
  assert.equal(results.some((item) => item.code === "TOTAL_MISMATCH"), true);
});

test("uses explicitly present GST components without requiring all components", async () => {
  const results = await validateDocument(
    monetaryDocument({ subtotal: 50000, cgst: 4500, sgst: 4500, total_amount: 59000 }),
    noRows,
  );
  assert.equal(results.some((item) => item.code === "TOTAL_MATCH"), true);
});

test("treats explicit zero monetary values as present", async () => {
  const results = await validateDocument(
    monetaryDocument({ subtotal: 0, tax_amount: 0, discount: 0, total_amount: 0 }),
    noRows,
  );
  assert.equal(results.some((item) => item.code === "TOTAL_MATCH"), true);
  assert.equal(results.some((item) => item.code === "MISSING_TOTAL"), false);
});
