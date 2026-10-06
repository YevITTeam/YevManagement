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

// GET /UserEmail/domain-account — Identity đang có gì cho 1 tài khoản domain (DOMAIN\user).
export interface DomainAccountEmailStatusDto {
  domainAccount: string;
  userExists: boolean;
  userId: number | null;
  fullName: string | null;
  emails: string[];
}

export interface LinkDomainAccountEmailsDto {
  domainAccount: string;
  // Họ tên cho User được tạo mới; bỏ qua nếu User đã tồn tại.
  fullName: string | null;
  emails: { email: string; note: string | null }[];
}

export interface LinkDomainAccountEmailsResultDto {
  userId: number;
  userName: string;
  userCreated: boolean;
  addedEmails: string[];
  // Email User đã có sẵn trên Identity.
  skippedEmails: string[];
}

export interface UserEmailSuggestionDto {
  email: string;
  source: number;
  note: string | null;
  alreadyAdded: boolean;
}
