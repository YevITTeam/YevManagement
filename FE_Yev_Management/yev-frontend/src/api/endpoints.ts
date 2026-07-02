// File: src/api/endpoints.ts

export const API_ENDPOINTS = {
  AUTH: {
    ME: "/auth/me",
    // Sau này có thêm API nào về Auth thì bạn cứ nhét vào đây
  },
  ADMIN: {
    USERS: "/admin/users",
    ROLES: "/admin/roles",
    UPDATE_USER_ROLES: "/admin/users/roles",
    CREATE_ROLES: "/admin/roles",
    UPDATE_ROLES: (id: string) => `/admin/roles/${id}`,
    DELETE_ROLES: (id: string) => `/admin/roles/${id}`,
  },
  // CUSTOMER: {
  //   IDENTIFY: "/customer/identify",
  // }
} as const;
// Chú ý: 'as const' rất quan trọng, nó biến object này thành dạng Read-only
// và giúp TypeScript hiểu chính xác giá trị của từng biến (Ví dụ hiểu ME là "/auth/me" chứ không phải là string chung chung).