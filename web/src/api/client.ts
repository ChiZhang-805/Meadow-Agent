export async function apiPost<TResponse, TPayload = unknown>(
  path: string,
  payload?: TPayload,
  headers?: HeadersInit
): Promise<TResponse> {
  const response = await fetch(path, {
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
