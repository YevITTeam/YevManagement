const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const AUTH_TOKEN_KEY = "yev_auth_token";

const getStoredToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

const persistToken = (token: string | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
};

const extractTokenFromPayload = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const nestedData = candidate.data;

  const tokenCandidates = [
    candidate.token,
    candidate.accessToken,
    candidate.access_token,
    nestedData && typeof nestedData === "object" ? (nestedData as Record<string, unknown>).token : undefined,
    nestedData && typeof nestedData === "object" ? (nestedData as Record<string, unknown>).accessToken : undefined,
    nestedData && typeof nestedData === "object" ? (nestedData as Record<string, unknown>).access_token : undefined,
  ];

  for (const value of tokenCandidates) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
};

const fetchClient = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${BASE_URL}${endpoint}`;
  const token = getStoredToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const defaultOptions: RequestInit = {
    ...options,
    credentials: "include",
    headers,
  };

  const response = await fetch(url, defaultOptions);

  let payload: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status !== 204) {
    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      persistToken(null);
    }

    const errorBody = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    throw new Error(errorBody || `API Error: ${response.status}`);
  }

  const authToken = extractTokenFromPayload(payload);
  if (authToken) {
    persistToken(authToken);
  }

  if (response.status === 204) return {} as T;

  return (payload ?? {}) as T;
};

export const setAuthToken = (token: string | null) => {
  persistToken(token);
};

export const clearAuthToken = () => {
  persistToken(null);
};

export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    fetchClient<T>(url, { ...options, method: "GET" }),

  post: <T>(url: string, data?: unknown, options?: RequestInit) =>
    fetchClient<T>(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(url: string, data?: unknown, options?: RequestInit) =>
    fetchClient<T>(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(url: string, data?: unknown, options?: RequestInit) =>
    fetchClient<T>(url, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(url: string, options?: RequestInit) =>
    fetchClient<T>(url, { ...options, method: "DELETE" }),
};