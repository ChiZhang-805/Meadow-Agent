const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (!apiBaseUrl) return path;
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiGet<TResponse>(path: string, headers?: HeadersInit): Promise<TResponse> {
  const response = await fetch(apiUrl(path), { headers });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${path} failed with ${response.status}: ${detail}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function apiPost<TResponse, TPayload = unknown>(
  path: string,
  payload?: TPayload,
  headers?: HeadersInit
): Promise<TResponse> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${path} failed with ${response.status}: ${detail}`);
  }

  return response.json() as Promise<TResponse>;
}
