// Core API client for the GYMAI backend.
// Base URL comes from VITE_API_BASE_URL (see .env.example); falls back to local dev backend.
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:5000/api/v1";

/**
 * Access token is kept IN-MEMORY only (never in localStorage / sessionStorage)
 * to mitigate XSS token-theft attacks. The refresh token lives in an httpOnly
 * cookie (set by the backend), so a silent refresh restores the access token
 * automatically after a page reload or 401 response.
 */
let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string | null) {
  _accessToken = token;
  // No longer written to localStorage — intentional XSS mitigation.
}

import { toast } from "sonner";

export interface ApiFieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Per-field validation errors, e.g. [{ field: "phone", message: "..." }], when the backend sends them. */
  details?: ApiFieldError[];
  /** Legacy Axios response compatibility object for components checking err.response?.data */
  response?: {
    data?: any;
    status: number;
  };

  constructor(message: string, status: number, code?: string, details?: ApiFieldError[], rawData?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.response = {
      data: rawData || { message, error: { code, message, details } },
      status,
    };
  }
}

/**
 * Universal error message extractor that unwraps ApiError, Axios-like errors,
 * Zod validation details, or generic error objects.
 */
export function formatApiError(err: unknown, fallback = "An unexpected error occurred"): string {
  if (!err) return fallback;
  if (err instanceof ApiError) {
    return err.message || fallback;
  }
  if (typeof err === "object" && err !== null) {
    const anyErr = err as any;
    if (anyErr.response?.data?.error?.message) {
      const details = anyErr.response.data.error.details;
      if (Array.isArray(details) && details.length > 0) {
        const detailsStr = details.map((d: any) => d.message || `${d.field}: invalid`).join("; ");
        return `${anyErr.response.data.error.message}: ${detailsStr}`;
      }
      return anyErr.response.data.error.message;
    }
    if (anyErr.response?.data?.message) return anyErr.response.data.message;
    if (anyErr.message) return anyErr.message;
  }
  if (typeof err === "string") return err;
  return fallback;
}

/**
 * Trigger an informative, detailed error toast with actionable failure details.
 */
export function showApiErrorToast(err: unknown, fallback = "Action failed"): string {
  const message = formatApiError(err, fallback);
  toast.error(message);
  return message;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip the automatic 401 -> refresh-token -> retry flow (used by the refresh call itself). */
  skipAuthRetry?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // De-dupe concurrent refresh attempts triggered by parallel requests.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) return null;
        const json = await res.json();
        const token = json?.data?.accessToken as string | undefined;
        if (token) _accessToken = token; // Set in-memory directly (avoid re-export indirection)
        return token ?? null;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/**
 * Low-level fetch wrapper: attaches the bearer token, sends the refresh-token
 * cookie, unwraps the {success, data, message} envelope used by every
 * backend route, and transparently retries once after a token refresh on 401.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRetry, headers, ...rest } = options;
  const token = getAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Access token expired — try one silent refresh, then retry the original call.
  if (res.status === 401 && !skipAuthRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // No JSON body (e.g. 204)
  }

  if (!res.ok || json?.success === false) {
    const details = json?.error?.details as ApiFieldError[] | undefined;
    let message = json?.error?.message || json?.message || `Request failed (${res.status})`;
    if (Array.isArray(details) && details.length > 0) {
      const detailsStr = details
        .map((d) => (d.field ? `${d.field}: ${d.message || "invalid"}` : d.message))
        .filter(Boolean)
        .join("; ");
      if (detailsStr && !message.includes(detailsStr)) {
        message = `${message} — ${detailsStr}`;
      }
    }
    throw new ApiError(message, res.status, json?.error?.code, Array.isArray(details) ? details : undefined, json);
  }

  return (json?.data ?? json) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "DELETE" }),
};
