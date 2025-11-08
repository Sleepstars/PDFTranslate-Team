export type ProviderType = 
  | 'google'
  | 'deepl'
  | 'openai'
  | 'azure-openai'
  | 'ollama'
  | 'gemini'
  | 'deepseek'
  | 'zhipu'
  | 'siliconflow'
  | 'tencent'
  | 'grok'
  | 'groq';

export interface ProviderConfig {
  id: string;
  name: string;
  providerType: ProviderType;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderConfigRequest {
  name: string;
  providerType: ProviderType;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  settings: Record<string, any>;
}

export interface UpdateProviderConfigRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  settings?: Record<string, any>;
}

// Provider-specific settings interfaces
export interface GoogleSettings {
  // No settings required
}

export interface DeepLSettings {
  api_key: string;
  api_url?: string; // Optional: free vs pro
}

export interface OpenAISettings {
  api_key: string;
  model: string;
  base_url?: string;
}

export interface AzureOpenAISettings {
  api_key: string;
  endpoint: string;
  deployment: string;
  model?: string;
}

export interface OllamaSettings {
  base_url: string;
  model: string;
}

export interface GeminiSettings {
  api_key: string;
  model?: string;
}

export interface DeepSeekSettings {
  api_key: string;
  model?: string;
}

export interface ZhipuSettings {
  api_key: string;
  model?: string;
}

export interface SiliconFlowSettings {
  api_key: string;
}

export interface TencentSettings {
  secret_id: string;
  secret_key: string;
}

export interface GrokSettings {
  api_key: string;
  model?: string;
}

export interface GroqSettings {
  api_key: string;
  model?: string;
}

export type ProviderSettings =
  | GoogleSettings
  | DeepLSettings
  | OpenAISettings
  | AzureOpenAISettings
  | OllamaSettings
  | GeminiSettings
  | DeepSeekSettings
  | ZhipuSettings
  | SiliconFlowSettings
  | TencentSettings
  | GrokSettings
  | GroqSettings;

