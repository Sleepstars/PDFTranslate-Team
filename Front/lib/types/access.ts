export interface UserProviderAccess {
  id: string;
  userId: string;
  providerConfigId: string;
  isDefault: boolean;
  createdAt: string;
  user?: {
    email: string;
    name: string;
  };
  provider?: {
    name: string;
    providerType: string;
  };
}

export interface GrantProviderAccessRequest {
  userId: string;
  providerConfigId: string;
  isDefault: boolean;
}

