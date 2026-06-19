import { apiPost } from "./client";

export interface ExternalConfigItem {
  name: string;
  configured: boolean;
  source: string;
  required_for_mvp: boolean;
}

export interface ConfigStatus {
  app_env: string;
  items: ExternalConfigItem[];
}

export async function getConfigStatus(): Promise<ConfigStatus> {
  const response = await fetch("/api/dev/config/status");
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to load config status: ${response.status} ${detail}`);
  }
  return response.json() as Promise<ConfigStatus>;
}

export async function saveOpenAIKey(openaiApiKey: string): Promise<{ configured: boolean }> {
  return apiPost<{ configured: boolean }>("/api/dev/config/openai-api-key", {
    openai_api_key: openaiApiKey
  });
}

export async function saveAMapKey(amapApiKey: string): Promise<{ configured: boolean }> {
  return apiPost<{ configured: boolean }>("/api/dev/config/amap-api-key", {
    amap_api_key: amapApiKey
  });
}
