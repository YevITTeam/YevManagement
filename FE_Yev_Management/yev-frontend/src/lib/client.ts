const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const AUTH_TOKEN_KEY = "yev_auth_token";
// Cache thông tin user hiện tại đi kèm token, để tránh gọi lại windows-login (bật popup đăng nhập Windows) khi đã đăng nhập.
export const CURRENT_USER_KEY = "yev_current_user";

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
  // Token bị xoá (hết hạn / re-login thất bại) → dọn luôn cache user để lần sau buộc đăng nhập lại.
  window.localStorage.removeItem(CURRENT_USER_KEY);
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
  let token = getStoredToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const defaultOptions: RequestInit = {
    ...options,
    credentials: "include", // Cờ này giúp gửi Windows Credentials
    headers,
  };

  let response = await fetch(url, defaultOptions);
  let payload: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";

  // -----------------------------------------------------------
  // XỬ LÝ AUTO RE-LOGIN KHI GẶP LỖI 401 (TOKEN HẾT HẠN)
  // -----------------------------------------------------------
  if (response.status === 401 && !endpoint.includes("windows-login")) {
    try {

      const loginRes = await fetch(`${BASE_URL}/Auth/windows-login`, {
        method: "POST",
        credentials: "include"
      });

      if (loginRes.ok) {
        let loginPayload = null;
        const loginContentType = loginRes.headers.get("content-type") ?? "";
        if (loginContentType.includes("application/json")) {
          loginPayload = await loginRes.json();
        }

        const newToken = extractTokenFromPayload(loginPayload);
        
        if (newToken) {
          // Lưu token mới
          persistToken(newToken);
          
          // Set lại Authorization header với token mới
          headers.set("Authorization", `Bearer ${newToken}`);
          defaultOptions.headers = headers;

          // THỰC HIỆN GỌI LẠI (RETRY) REQUEST BAN ĐẦU
          response = await fetch(url, defaultOptions);
        }
      }
    } catch (error) {
      console.error("Auto re-login failed:", error);
    }
  }
  // -----------------------------------------------------------

  // Đọc dữ liệu từ response (bao gồm cả response gốc hoặc response sau khi retry)
  const finalContentType = response.headers.get("content-type") ?? "";
  if (response.status !== 204) {
    if (finalContentType.includes("application/json")) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }
  }

  // Bắt các lỗi còn lại (403 hoặc 401 mà re-login vẫn thất bại)
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      persistToken(null);
    }
    const errorBody = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    throw new Error(errorBody || `API Error: ${response.status}`);
  }

  // Trích xuất Token (nếu api trả về có token)
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