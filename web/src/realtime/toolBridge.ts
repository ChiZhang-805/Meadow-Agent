import {
  createOrderPreview,
  searchGroceryOptions,
  submitOrder,
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
  const groceryStore = useGroceryStore.getState();

  if (call.name === "search_grocery_options") {
    const searchId = ++latestGrocerySearchId;
    useGroceryStore.getState().setOptions([]);
    const options = await searchGroceryOptions({
      user_id: userId,
      items: args.items ?? [],
      budget_cents: args.budget_cents,
      utterance: args.utterance
    });
    if (searchId === latestGrocerySearchId) {
      useGroceryStore.getState().setOptions(options);
    }
    return { options, safety_note: "只展示候选项，尚未下单。" };
  }

  if (call.name === "create_order_preview") {
    const preview = await createOrderPreview({ user_id: userId, option_id: String(args.option_id) });
    useGroceryStore.getState().setPreview(preview);
    return {
      preview,
      requires_ui_confirmation: true,
      next_step: "请老人查看屏幕并点击确认后，前端才会签发 confirmation_token 并提交。"
    };
  }

  if (call.name === "submit_order") {
    groceryStore.setStage("ordering");
    const order = await submitOrder({
      user_id: userId,
      preview_id: String(args.preview_id),
      confirmation_token: String(args.confirmation_token)
    });
    if (groceryStore.currentPreview) {
      groceryStore.setOrder(order, groceryStore.currentPreview);
    }
    return { order };
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
