// Mirrors BE enum UserEmailSource.
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

// userEmailId null = module uses the primary email.
export interface UserEmailModuleAssignmentDto {
  moduleCode: string;
  moduleName: string;
  // false = module doesn't read this setting yet (saved but not in effect).
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

// What Identity has for a domain account (DOMAIN\user).
export interface DomainAccountEmailStatusDto {
  domainAccount: string;
  userExists: boolean;
  userId: number | null;
  fullName: string | null;
  emails: string[];
}

export interface LinkDomainAccountEmailsDto {
  domainAccount: string;
  // Used only when creating a new User; ignored if the user exists.
  fullName: string | null;
  emails: { email: string; note: string | null }[];
}

export interface LinkDomainAccountEmailsResultDto {
  userId: number;
  userName: string;
  userCreated: boolean;
  addedEmails: string[];
  // Emails the User already had in Identity.
  skippedEmails: string[];
}

export interface UserEmailSuggestionDto {
  email: string;
  source: number;
  note: string | null;
  alreadyAdded: boolean;
}
