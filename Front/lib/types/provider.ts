export interface BaseProviderSettings {
  max_concurrency?: number;
  requests_per_minute?: number;
  model?: string;
  [key: string]: string | number | undefined;
}

export interface OpenAIProviderSettings extends BaseProviderSettings {
  api_key?: string;
  base_url?: string;
}

export interface AzureOpenAIProviderSettings extends BaseProviderSettings {
  api_key?: string;
  endpoint?: string;
  deployment_name?: string;
}

export interface DeepLProviderSettings extends BaseProviderSettings {
  api_key?: string;
  endpoint?: string;
}

export interface OllamaProviderSettings extends BaseProviderSettings {
  endpoint?: string;
}

export interface TencentProviderSettings extends BaseProviderSettings {
  secret_id?: string;
  secret_key?: string;
}

export interface GenericProviderSettings extends BaseProviderSettings {
  api_key?: string;
  endpoint?: string;
}

export type ProviderSettings = 
  | OpenAIProviderSettings 
  | AzureOpenAIProviderSettings 
  | DeepLProviderSettings 
  | OllamaProviderSettings 
  | TencentProviderSettings 
  | GenericProviderSettings
  | Record<string, string | number>;

export interface ProviderConfig {
  id: string;
  name: string;
  providerType: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  settings: ProviderSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderRequest {
  name: string;
  providerType: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  settings: ProviderSettings;
}

export interface UpdateProviderRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  settings?: Record<string, string | number>;
}
