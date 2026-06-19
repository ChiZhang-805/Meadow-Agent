import { Clock3, X } from "lucide-react";

import { type GroceryStage, type OrderHistoryRecord } from "../store/useGroceryStore";
import { GroceryStageTracker } from "./GroceryStageTracker";

interface OrderHistoryDialogProps {
  history: OrderHistoryRecord[];
  selectedOrderId?: string;
  onSelect: (orderId: string) => void;
  onClose: () => void;
}

export function OrderHistoryDialog({ history, selectedOrderId, onSelect, onClose }: OrderHistoryDialogProps) {
  const selected = history.find((item) => item.order.order_id === selectedOrderId) ?? history[0];

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="history-dialog" role="dialog" aria-modal="true" aria-label="历史订单">
        <header className="history-dialog-header">
          <div>
            <h2>历史订单</h2>
            <p>订单记忆按时间排序，最近的权重更高</p>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭历史订单">
            <X aria-hidden="true" size={24} />
          </button>
        </header>

        {history.length === 0 ? (
          <p className="order-empty">暂无历史订单</p>
        ) : (
          <div className="history-dialog-body">
            <section className="history-list" aria-label="历史订单列表">
              {history.map((record, index) => (
                <button
                  className={record.order.order_id === selected?.order.order_id ? "history-card selected" : "history-card"}
                  key={record.order.order_id}
                  onClick={() => onSelect(record.order.order_id)}
                  type="button"
                >
                  <strong>{record.preview.title}</strong>
                  <span>{itemSummary(record)}</span>
                  <footer>
                    <em>{stageLabel(record.stage)}</em>
                    <small>权重 {memoryWeight(index)}</small>
                  </footer>
                </button>
              ))}
            </section>

            {selected ? (
              <section className="history-detail" aria-label="历史订单详情">
                <div className="history-detail-title">
                  <Clock3 aria-hidden="true" size={22} />
                  <div>
                    <h3>{selected.preview.title}</h3>
                    <p>{selected.order.order_id}</p>
                  </div>
                </div>
                <dl className="history-meta">
                  <div>
                    <dt>合计</dt>
                    <dd>{(selected.preview.total_cents / 100).toFixed(2)} 元</dd>
                  </div>
                  <div>
                    <dt>地址</dt>
                    <dd>{selected.preview.address_masked}</dd>
                  </div>
                  <div>
                    <dt>更新时间</dt>
                    <dd>{formatTime(selected.updatedAt)}</dd>
                  </div>
                </dl>
                <GroceryStageTracker stage={selected.stage} stageTimes={selected.stageTimes} />
              </section>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

export function stageLabel(stage: GroceryStage) {
  const labels: Record<GroceryStage, string> = {
    idle: "等待开始",
    searching: "正在查菜",
    options_ready: "选择菜品",
    preview_ready: "确认订单",
    ordering: "正在下单",
    accepted: "骑手接单",
    at_store: "骑手到店",
    delivering: "正在配送",
    delivered: "已经送达",
    cancelled: "已经取消"
  };
  return labels[stage];
}

function itemSummary(record: OrderHistoryRecord) {
  return record.preview.items
    .map((item) => String(item.name ?? "菜品"))
    .filter(Boolean)
    .join("、");
}

function memoryWeight(index: number) {
  return Math.max(0.45, 1 - index * 0.18).toFixed(2);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
