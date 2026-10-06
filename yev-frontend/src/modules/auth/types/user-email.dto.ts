// Nguồn của 1 email (khớp enum UserEmailSource ở BE).
export const USER_EMAIL_SOURCE = {
  Ad: 0,
  AdAlias: 1,
  Tanium: 2,
  Manual: 3,
} as const;

export const USER_EMAIL_SOURCE_LABELS: Record<number, string> = {
  0: "AD",
  1: "Alias AD",
  2: "Tanium",
  3: "Nhập tay",
};

export interface UserEmailDto {
  id: number;
  email: string;
  source: number;
  isPrimary: boolean;
  note: string | null;
  createdAt: string;
}

// userEmailId null = module gửi về email chính.
export interface UserEmailModuleAssignmentDto {
  moduleCode: string;
  moduleName: string;
  // false = module chưa đọc email theo cấu hình này (cấu hình được lưu sẵn, chưa có tác dụng).
  isApplied: boolean;
  userEmailId: number | null;
}

export interface UserEmailOverviewDto {
  userId: number;
  userName: string;
  fullName: string | null;
  emails: UserEmailDto[];
  modules: UserEmailModuleAssignmentDto[];
}

export interface CreateUserEmailDto {
  email: string;
  source: number;
  note: string | null;
  isPrimary: boolean;
}

export interface UpdateUserEmailModulesDto {
  items: { moduleCode: string; userEmailId: number | null }[];
}

export interface UserEmailSuggestionDto {
  email: string;
  source: number;
  note: string | null;
  alreadyAdded: boolean;
}
