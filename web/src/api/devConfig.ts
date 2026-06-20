import { apiGet, apiPost } from "./client";

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

export async function getConfigStatus(userId: string): Promise<ConfigStatus> {
  return apiGet<ConfigStatus>("/api/dev/config/status", { "X-User-Id": userId });
}

export async function saveOpenAIKey(openaiApiKey: string, userId: string): Promise<{ configured: boolean }> {
  return apiPost<{ configured: boolean }>(
    "/api/dev/config/openai-api-key",
    {
      openai_api_key: openaiApiKey
    },
    { "X-User-Id": userId }
  );
}

export async function saveAMapKey(amapApiKey: string, userId: string): Promise<{ configured: boolean }> {
  return apiPost<{ configured: boolean }>(
    "/api/dev/config/amap-api-key",
    {
      amap_api_key: amapApiKey
    },
    { "X-User-Id": userId }
  );
}
