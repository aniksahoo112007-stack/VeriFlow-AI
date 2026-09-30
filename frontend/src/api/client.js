import axios from "axios";
import { config } from "../config/env";

let accessToken = null;
let refreshPromise = null;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const api = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
  timeout: 30000,
});

const AI_PROCESSING_TIMEOUT_MS = 120000;
const processEndpointPattern = /^\/documents\/[^/]+\/process(?:\?.*)?$/;

export const processDocument = (documentId) =>
  api.post(`/documents/${documentId}/process`, undefined, {
    timeout: AI_PROCESSING_TIMEOUT_MS,
  });

api.interceptors.request.use((request) => {
  if (accessToken) request.headers.Authorization = `Bearer ${accessToken}`;
  return request;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original?._retry &&
      !original?.url?.includes("/auth/refresh")
    ) {
      original._retry = true;
      refreshPromise ||= api
        .post("/auth/refresh")
        .then(({ data }) => {
          setAccessToken(data.data.accessToken);
          return data.data.accessToken;
        })
        .finally(() => {
          refreshPromise = null;
        });
      try {
        const token = await refreshPromise;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new Event("veriflow:logout"));
      }
    }
    return Promise.reject(error);
  },
);

export const errorMessage = (error) => {
  if (error.response?.data?.message) return error.response.data.message;
  const timedOut = ["ECONNABORTED", "ETIMEDOUT"].includes(error.code);
  const isProcessingRequest =
    error.config?.method?.toLowerCase() === "post" &&
    processEndpointPattern.test(error.config?.url || "");
  if (timedOut && isProcessingRequest)
    return "AI analysis is taking longer than expected. Your document is safe. Please retry.";
  if (timedOut) return "The request timed out. Please try again.";
  return "Could not reach VeriFlow. Check your connection.";
};
