export interface UserProviderAccess {
  id: string;
  userId: string;
  providerConfigId: string;
  isDefault: boolean;
  createdAt: string;
}

export interface GrantAccessRequest {
  userId: string;
  providerConfigId: string;
  isDefault: boolean;
}
