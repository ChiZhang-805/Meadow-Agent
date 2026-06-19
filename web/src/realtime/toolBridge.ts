import {
  createOrderPreview,
  searchGroceryOptions,
  type OrderPreview
} from "../api/grocery";
import { useGroceryStore } from "../store/useGroceryStore";

export interface RealtimeToolCall {
  callId: string;
  name: string;
  arguments: string;
}

let latestGrocerySearchId = 0;

export async function handleRealtimeToolCall(call: RealtimeToolCall, userId: string): Promise<unknown> {
  const args = parseToolArguments(call.arguments);

  if (call.name === "search_grocery_options") {
    const searchId = ++latestGrocerySearchId;
    const requestedItems = Array.isArray(args.items) ? args.items : [];
    useGroceryStore.getState().setOptions([]);
    if (requestedItems.length === 0) {
      return { error: "items must be a non-empty array", options: [] };
    }
    const options = await searchGroceryOptions({
      user_id: userId,
      items: requestedItems,
      budget_cents: typeof args.budget_cents === "number" ? args.budget_cents : undefined,
      utterance: typeof args.utterance === "string" ? args.utterance : undefined
    });
    if (searchId === latestGrocerySearchId) {
      useGroceryStore.getState().setOptions(options);
    }
    return { options, safety_note: "只展示候选项，尚未下单。" };
  }

  if (call.name === "create_order_preview") {
    if (typeof args.option_id !== "string" || args.option_id.trim().length === 0) {
      return { error: "option_id is required to create an order preview" };
    }
    const preview = await createOrderPreview({ user_id: userId, option_id: args.option_id.trim() });
    useGroceryStore.getState().setPreview(preview);
    return {
      preview,
      requires_ui_confirmation: true,
      next_step: "请老人查看屏幕并点击确认后，前端才会签发 confirmation_token 并提交。"
    };
  }

  if (call.name === "submit_order") {
    return {
      error: "submit_order is only allowed after the elder clicks the on-screen confirmation button.",
      requires_ui_confirmation: true,
      next_step: "请老人查看屏幕上的确认弹窗。前端确认按钮会签发一次性 confirmation_token 并提交订单。"
    };
  }

  return { error: `Unknown tool: ${call.name}` };
}

export function sendToolOutput(dc: RTCDataChannel, callId: string, output: unknown): void {
  if (dc.readyState !== "open") return;

  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output)
      }
    })
  );
  dc.send(JSON.stringify({ type: "response.create" }));
}

export function summarizePreview(preview: OrderPreview): string {
  const total = (preview.total_cents / 100).toFixed(2);
  return `请确认：${preview.title}，总价 ${total} 元，送到${preview.address_masked}。`;
}

function parseToolArguments(raw: string): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
