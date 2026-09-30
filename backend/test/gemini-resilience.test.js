import test from "node:test";
import assert from "node:assert/strict";
import {
  isCapacityGeminiError,
  isTransientGeminiError,
  requestModelWithRetry,
  retryDelayMs,
} from "../services/gemini.service.js";

const context = {
  documentId: "test-document",
  mimeType: "application/pdf",
  bufferBytes: 128,
};

async function withoutDiagnosticOutput(callback) {
  const originalInfo = console.info;
  const originalError = console.error;
  console.info = () => {};
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }
}

test("classifies transient and permanent Gemini failures conservatively", () => {
  assert.equal(isTransientGeminiError({ status: 503 }), true);
  assert.equal(isTransientGeminiError({ status: 429 }), true);
  assert.equal(
    isTransientGeminiError({
      message: "fetch failed",
      cause: { code: "ETIMEDOUT" },
    }),
    true,
  );
  assert.equal(
    isTransientGeminiError({ status: 401, message: "API key is invalid" }),
    false,
  );
  assert.equal(
    isTransientGeminiError({ status: 400, message: "Invalid request" }),
    false,
  );
});

test("recognizes model availability and capacity failures", () => {
  assert.equal(
    isCapacityGeminiError({
      status: 503,
      code: "UNAVAILABLE",
      message: "This model is currently experiencing high demand.",
    }),
    true,
  );
  assert.equal(
    isCapacityGeminiError({ code: "ETIMEDOUT", message: "fetch failed" }),
    false,
  );
});

test("uses exponential backoff with bounded jitter", () => {
  assert.equal(retryDelayMs(1, 0.5), 1000);
  assert.equal(retryDelayMs(2, 0.5), 2000);
  assert.equal(retryDelayMs(1, 0), 800);
  assert.equal(retryDelayMs(1, 1), 1200);
});

test("retries transient failures up to the configured maximum", async () => {
  let calls = 0;
  const delays = [];
  const response = { text: "{}" };
  const ai = {
    models: {
      generateContent: async () => {
        calls += 1;
        if (calls < 3) {
          const error = new Error("High demand. Please try again later.");
          error.status = 503;
          error.code = "UNAVAILABLE";
          throw error;
        }
        return response;
      },
    },
  };

  const result = await withoutDiagnosticOutput(() =>
    requestModelWithRetry({
      ai,
      model: "primary-model",
      contents: [],
      context,
      maxAttempts: 3,
      sleepFn: async (delay) => delays.push(delay),
      randomFn: () => 0.5,
    }),
  );

  assert.equal(result, response);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test("does not retry permanent authentication failures", async () => {
  let calls = 0;
  const ai = {
    models: {
      generateContent: async () => {
        calls += 1;
        const error = new Error("API key is invalid");
        error.status = 401;
        throw error;
      },
    },
  };

  await assert.rejects(
    withoutDiagnosticOutput(() =>
      requestModelWithRetry({
        ai,
        model: "primary-model",
        contents: [],
        context,
        maxAttempts: 3,
        sleepFn: async () => assert.fail("Permanent errors must not wait"),
      }),
    ),
    (error) => {
      assert.equal(error.transient, false);
      assert.equal(error.attempts.length, 1);
      return true;
    },
  );
  assert.equal(calls, 1);
});

test("honors the two-attempt fallback limit for transient failures", async () => {
  let calls = 0;
  const delays = [];
  const ai = {
    models: {
      generateContent: async () => {
        calls += 1;
        const error = new Error("Model temporarily unavailable");
        error.status = 503;
        error.code = "UNAVAILABLE";
        throw error;
      },
    },
  };

  await assert.rejects(
    withoutDiagnosticOutput(() =>
      requestModelWithRetry({
        ai,
        model: "fallback-model",
        contents: [],
        context,
        maxAttempts: 2,
        sleepFn: async (delay) => delays.push(delay),
        randomFn: () => 0.5,
      }),
    ),
    (error) => {
      assert.equal(error.transient, true);
      assert.equal(error.allCapacity, true);
      assert.equal(error.attempts.length, 2);
      return true;
    },
  );
  assert.equal(calls, 2);
  assert.deepEqual(delays, [1000]);
});
