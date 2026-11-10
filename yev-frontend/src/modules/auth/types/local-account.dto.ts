export interface LocalAccountPrefixDto {
  id: number;
  prefix: string;
  accountCount: number;
  createdAt: string;
}

export interface CreateLocalAccountDto {
  prefixId: number;
  loginName: string;
  fullName: string;
  password: string;
  email?: string;
  roleIds: number[];
}
