const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const AUTH_TOKEN_KEY = "yev_auth_token";
// LƯU Ý: chỉ lưu JWT ở đây — bắt buộc vì `fetchClient` là hàm thuần (không phải React component/hook)
// nên không thể đọc từ React Context. Thông tin user (fullName, roles, permissions...) KHÔNG lưu ở
// localStorage vì đây là dữ liệu nhạy cảm hơn, có thể đọc được bởi bất kỳ script nào chạy trên trang
// (XSS, extension độc hại) và tồn tại vô thời hạn trên đĩa — thay vào đó giữ trong React Context
// (bộ nhớ JS, mất khi đóng tab/reload), xem `src/modules/auth/context/AuthContext.tsx`.

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

const WINDOWS_LOGIN_ENDPOINT = "/Auth/windows-login";

// Windows Negotiate/NTLM là handshake gắn với 1 kết nối — nếu nhiều request cùng lúc bị 401 (vd trang
// Quản lý PC gọi song song device/branch/supplier/device-type...) mà MỖI request tự ý bắn 1 lần
// `POST /Auth/windows-login` riêng, trình duyệt phải xử lý nhiều handshake NTLM chồng chéo cùng lúc →
// hay gặp hiện tượng liên tục hiện popup nhập mật khẩu domain mà không bao giờ đăng nhập xong.
// Dồn toàn bộ lời gọi đồng thời về ĐÚNG 1 request thật duy nhất, các lời gọi khác chỉ đợi ăn theo kết quả.
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

// Dùng cho AuthApi.windowsLogin() — đi qua đúng 1 cơ chế single-flight với nhánh auto re-login bên dưới.
export const windowsLogin = requestWindowsLogin;

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
  // Đi qua requestWindowsLogin() (single-flight) thay vì tự fetch riêng — nhiều API gọi song song
  // cùng bị 401 (vd trang Quản lý PC) sẽ gộp chung về đúng 1 request Negotiate thật sự.
  // -----------------------------------------------------------
  if (response.status === 401 && !endpoint.includes("windows-login")) {
    try {
      await requestWindowsLogin();
      const newToken = getStoredToken();

      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        defaultOptions.headers = headers;

        // THỰC HIỆN GỌI LẠI (RETRY) REQUEST BAN ĐẦU
        response = await fetch(url, defaultOptions);
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

  // Bắt các lỗi còn lại. 401 = token hết hạn/không hợp lệ ngay cả sau khi re-login → xoá token, buộc đăng nhập lại.
  // 403 = token còn hợp lệ nhưng Role của user thiếu permission cho hành động này (docs/identity-api-fe.md §6) —
  // KHÔNG xoá token, vì đăng nhập lại (cùng user Windows) sẽ vẫn ra permission y hệt, chỉ gây mất session vô ích.
  if (!response.ok) {
    if (response.status === 401) {
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