const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const AUTH_TOKEN_KEY = "yev_auth_token";
// Only the JWT lives here because `fetchClient` is not a hook and can't read React Context. User profile data
// stays in memory (AuthContext) instead of localStorage, which any script (XSS, extensions) can read.

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

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setOnUnauthorized = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

const handleUnauthorized = () => {
  persistToken(null);
  if (unauthorizedHandler) {
    unauthorizedHandler();
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
};

const WINDOWS_LOGIN_ENDPOINT = "/Auth/windows-login";

// Negotiate/NTLM is a per-connection handshake: concurrent 401s each firing windows-login cause overlapping
// handshakes and endless domain password popups, so all callers share one in-flight request.
let pendingWindowsLogin: Promise<unknown> | null = null;

const requestWindowsLogin = async (): Promise<unknown> => {
  if (pendingWindowsLogin) {
    return pendingWindowsLogin;
  }

  pendingWindowsLogin = (async () => {
    const response = await fetch(`${BASE_URL}${WINDOWS_LOGIN_ENDPOINT}`, {
      method: "POST",
      credentials: "include",
    });

    let payload: unknown = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (response.status !== 204 && contentType.includes("application/json")) {
      payload = await response.json();
    }

    if (!response.ok) {
      const errorBody = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
      throw new Error(errorBody || `API Error: ${response.status}`);
    }

    const token = extractTokenFromPayload(payload);
    if (token) {
      persistToken(token);
    }
    return payload;
  })();

  try {
    return await pendingWindowsLogin;
  } finally {
    pendingWindowsLogin = null;
  }
};

// Shares the same single-flight as the 401 auto re-login path.
export const windowsLogin = requestWindowsLogin;

const LOGIN_ENDPOINT = "/Auth/login";

// Plain JSON login (BE binds to AD), not a Negotiate handshake; mirrors requestWindowsLogin's payload/token
// handling so both flows return the same shape.
const requestPasswordLogin = async (userName: string, password: string): Promise<unknown> => {
  const response = await fetch(`${BASE_URL}${LOGIN_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName, password }),
  });

  let payload: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status !== 204 && contentType.includes("application/json")) {
    payload = await response.json();
  }

  if (!response.ok) {
    const errorBody = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    throw new Error(errorBody || `API Error: ${response.status}`);
  }

  const token = extractTokenFromPayload(payload);
  if (token) {
    persistToken(token);
  }
  return payload;
};

export const passwordLogin = requestPasswordLogin;

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

// Shared transport: Bearer token, one re-login + retry on 401, and returns the Response with body unread
// so callers can parse JSON or stream it.
const fetchWithAuth = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
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
    credentials: options.credentials ?? "same-origin",
    headers,
  };

  const response = await fetch(url, defaultOptions);

  if (response.status === 401 && !endpoint.includes("windows-login")) {
    handleUnauthorized();
  }

  return response;
};

const fetchClient = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await fetchWithAuth(endpoint, options);
  let payload: unknown = null;

  const finalContentType = response.headers.get("content-type") ?? "";
  if (response.status !== 204) {
    if (finalContentType.includes("application/json")) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }
  }

  // 401 after re-login means the token is invalid → clear it. 403 keeps the token: re-login as the same
  // Windows user would yield the same permissions and just lose the session.
  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
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

// Returns the raw Response so NDJSON can be read incrementally. Errors before the stream starts are plain
// JSON and are thrown like `api.*` so `getApiErrorMessage` handles them uniformly.
export const postStream = async (
  url: string,
  data?: unknown,
  options?: RequestInit
): Promise<Response> => {
  const response = await fetchWithAuth(url, {
    ...options,
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");
    const errorBody = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    throw new Error(errorBody || `API Error: ${response.status}`);
  }

  return response;
};

export interface BlobDownloadResult {
  blob: Blob;
  // From Content-Disposition; null if missing or not exposed via CORS (WithExposedHeaders), caller picks a default.
  fileName: string | null;
  // Raw headers for endpoint-specific extras (e.g. X-Missing-Device-Count).
  headers: Headers;
}

const extractFileNameFromContentDisposition = (headerValue: string | null): string | null => {
  if (!headerValue) return null;
  // BE always emits ASCII filenames, so RFC 5987 filename*= is not handled.
  const match = /filename="?([^";]+)"?/i.exec(headerValue);
  return match ? match[1] : null;
};

// Errors before the file body (400, 401/403) are still JSON and are unwrapped like `postStream`.
export const postFormForBlob = async (
  url: string,
  formData: FormData,
  options?: RequestInit
): Promise<BlobDownloadResult> => {
  const response = await fetchWithAuth(url, {
    ...options,
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");
    const errorBody = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    throw new Error(errorBody || `API Error: ${response.status}`);
  }

  const blob = await response.blob();
  const fileName = extractFileNameFromContentDisposition(response.headers.get("content-disposition"));

  return { blob, fileName, headers: response.headers };
};

export const getForBlob = async (url: string, options?: RequestInit): Promise<BlobDownloadResult> => {
  const response = await fetchWithAuth(url, { ...options, method: "GET" });

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");
    const errorBody = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    throw new Error(errorBody || `API Error: ${response.status}`);
  }

  const blob = await response.blob();
  const fileName = extractFileNameFromContentDisposition(response.headers.get("content-disposition"));

  return { blob, fileName, headers: response.headers };
};

// Lets callers pick GET /Auth/me (silent) when a token exists instead of windows-login, which may prompt
// for domain credentials. Only signals presence; never parse the JWT.
export const getAuthToken = (): string | null => getStoredToken();

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

  // No JSON.stringify so the browser sets Content-Type with the multipart boundary.
  postForm: <T>(url: string, formData: FormData, options?: RequestInit) =>
    fetchClient<T>(url, {
      ...options,
      method: "POST",
      body: formData,
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