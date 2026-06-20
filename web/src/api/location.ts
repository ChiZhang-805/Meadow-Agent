import { apiPost } from "./client";

export interface AddressSuggestion {
  id?: string | null;
  name: string;
  district?: string | null;
  address?: string | null;
  location?: string | null;
  adcode?: string | null;
}

export interface DeliveryAddressPayload {
  user_id: string;
  name: string;
  district?: string | null;
  address?: string | null;
  location?: string | null;
  detail?: string | null;
}

export async function getAddressSuggestions(payload: {
  user_id: string;
  query: string;
  city?: string;
}): Promise<AddressSuggestion[]> {
  const data = await apiPost<{ suggestions: AddressSuggestion[] }>(
    "/api/location/amap/address_suggestions",
    payload,
    { "X-User-Id": payload.user_id }
  );
  return data.suggestions;
}

export async function saveDeliveryAddress(payload: DeliveryAddressPayload): Promise<void> {
  await apiPost("/api/location/address", payload, { "X-User-Id": payload.user_id });
}
