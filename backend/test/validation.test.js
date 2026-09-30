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
