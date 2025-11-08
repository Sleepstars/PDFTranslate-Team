export interface ProviderConfig {
  id: string;
  name: string;
  providerType: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  settings: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderRequest {
  name: string;
  providerType: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  settings: Record<string, string>;
}

export interface UpdateProviderRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  settings?: Record<string, string>;
}
