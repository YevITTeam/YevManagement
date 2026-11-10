
export interface UserDto {
  id: number;
  userName: string;
  fullName: string;
  deviceName: string | null;
  // Copy of the primary UserEmail; null when the user has none.
  email: string | null;
  isLocalAccount: boolean;
  mustChangePassword: boolean;
  roles: string[];
  // Derived from roles, UI-only; BE always enforces at the API.
  permissions: string[];
}

export interface RoleDto {
  id: number;
  roleName: string;
  description: string;
}

export interface UpdateUserRolesDto {
  userId: number;
  roleIds: number[];
}

export interface CreateRoleDto {
  roleName: string;
  description?: string;
}

// Pre-creates a user before their first Windows login; deviceName is informational only (login matches userName).
export interface CreateUserDto {
  userName: string;
  deviceName?: string;
  fullName?: string;
  roleIds?: number[];
}

// Only FullName is editable; userName and deviceName are not.
export interface UpdateUserFullNameDto {
  userId: number;
  fullName: string;
}

export interface WindowsLoginResponseDto {
  user: UserDto;
  token: string;
}

// BE binds username/password against AD (not Negotiate); userName has no domain prefix.
export interface LoginRequestDto {
  userName: string;
  password: string;
}

// BE stores only a hash, so `qrPayload` is retrievable once, right after creation.
export interface LoginQrGeneratedDto {
  userId: number;
  userName: string;
  fullName: string | null;
  qrPayload: string;
  createdAt: string;
}

// A user that currently has an active login QR.
export interface LoginQrStatusDto {
  userId: number;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
}

export type LoginQrLogAction = "Created" | "Revoked" | "LoginSuccess" | "LoginFailed";

export interface LoginQrLogDto {
  id: number;
  userId: number | null;
  action: LoginQrLogAction;
  actorUserId: number | null;
  actorName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  note: string | null;
  createdAt: string;
}
