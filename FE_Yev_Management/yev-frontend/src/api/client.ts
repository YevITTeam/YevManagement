const BASE_URL = process.env.NEXT_PUBLIC_API_URL;


const fetchClient = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${BASE_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    ...options,
    credentials: "include", // Giữ thẻ Windows Auth
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  const response = await fetch(url, defaultOptions);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `API Error: ${response.status}`);
  }

  if (response.status === 204) return {} as T;

  return response.json() as Promise<T>;
};


export const api = {
  get: <T>(url: string, options?: RequestInit) =>
    fetchClient<T>(url, { ...options, method: "GET" }),

  post: <T>(url: string, data?: any, options?: RequestInit) =>
    fetchClient<T>(url, {
      ...options,
      method: "POST",
      // Tự động chuyển Object thành JSON
      body: data ? JSON.stringify(data) : undefined, 
    }),

  put: <T>(url: string, data?: any, options?: RequestInit) =>
    fetchClient<T>(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(url: string, data?: any, options?: RequestInit) =>
    fetchClient<T>(url, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(url: string, options?: RequestInit) =>
    fetchClient<T>(url, { ...options, method: "DELETE" }),
};