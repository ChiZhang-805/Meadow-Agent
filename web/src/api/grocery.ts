import { apiPost } from "./client";

export interface GroceryItem {
  name: string;
  quantity?: string;
}

export interface GroceryOption {
  id: string;
  provider: string;
  title: string;
  shop_name: string;
  items: Array<Record<string, unknown>>;
  price_cents: number;
  delivery_fee_cents: number;
  eta_minutes: number;
}

export interface OrderPreview {
  preview_id: string;
  provider: string;
  title: string;
  items: Array<Record<string, unknown>>;
  total_cents: number;
  delivery_fee_cents: number;
  eta_minutes: number;
  address_masked: string;
  need_caregiver_confirm: boolean;
  policy_reason?: string | null;
}

export interface OrderResult {
  order_id: string;
  provider_order_id: string;
  status: string;
}

export async function searchGroceryOptions(payload: {
  user_id: string;
  items: GroceryItem[];
  budget_cents?: number;
  utterance?: string;
}): Promise<GroceryOption[]> {
  const data = await apiPost<{ options: GroceryOption[] }>("/api/tools/search_grocery_options", payload);
  return data.options;
}

export async function createOrderPreview(payload: {
  user_id: string;
  option_id: string;
}): Promise<OrderPreview> {
  const data = await apiPost<{ preview: OrderPreview }>("/api/tools/create_order_preview", payload);
  return data.preview;
}

export async function issueConfirmationToken(payload: {
  user_id: string;
  preview_id: string;
}): Promise<string> {
  const data = await apiPost<{ confirmation_token: string }>("/api/tools/issue_confirmation_token", payload);
  return data.confirmation_token;
}

export async function submitOrder(payload: {
  user_id: string;
  preview_id: string;
  confirmation_token: string;
}): Promise<OrderResult> {
  const data = await apiPost<{ order: OrderResult }>("/api/tools/submit_order", payload);
  return data.order;
}
