import { AlertTriangle, X } from "lucide-react";

import { type GroceryStage, type OrderHistoryRecord } from "../store/useGroceryStore";
import { stageLabel } from "./OrderHistoryDialog";

interface CancelOrderDialogProps {
  activeOrders: OrderHistoryRecord[];
  confirmTarget?: OrderHistoryRecord;
  onChoose: (orderId: string) => void;
  onConfirm: (orderId: string) => void;
  onBack: () => void;
  onClose: () => void;
}

export function CancelOrderDialog({
  activeOrders,
  confirmTarget,
  onChoose,
  onConfirm,
  onBack,
  onClose
}: CancelOrderDialogProps) {
  if (confirmTarget) {
    return (
      <div className="dialog-backdrop" role="presentation">
        <section className="cancel-confirm-dialog" role="dialog" aria-modal="true" aria-label="确认取消订单">
          <header className="cancel-confirm-header">
            <AlertTriangle aria-hidden="true" size={28} />
            <h2>确认取消这个订单？</h2>
          </header>
          <p>{confirmTarget.preview.title}</p>
          <dl className="cancel-confirm-meta">
            <div>
              <dt>订单号</dt>
              <dd>{confirmTarget.order.order_id}</dd>
            </div>
            <div>
              <dt>当前阶段</dt>
              <dd>{stageLabel(confirmTarget.stage)}</dd>
            </div>
          </dl>
          <div className="dialog-actions">
            <button className="dialog-confirm danger-confirm" onClick={() => onConfirm(confirmTarget.order.order_id)}>
              确认取消
            </button>
            <button className="dialog-cancel" onClick={onBack}>
              返回
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="cancel-order-dialog" role="dialog" aria-modal="true" aria-label="取消订单">
        <header className="history-dialog-header">
          <div>
            <h2>取消订单</h2>
            <p>请选择一个正在进行的订单</p>
          </div>
          <button className="icon-button" onClick={onClose} title="关闭取消订单">
            <X aria-hidden="true" size={24} />
          </button>
        </header>

        {activeOrders.length === 0 ? (
          <p className="order-empty">暂无正在进行的订单</p>
        ) : (
          <section className="cancel-order-list" aria-label="正在进行的订单">
            {activeOrders.map((record) => (
              <article className="cancel-order-card" key={record.order.order_id}>
                <div>
                  <h3>{record.preview.title}</h3>
                  <p>{itemSummary(record)}</p>
                  <strong>{stageLabel(record.stage)}</strong>
                </div>
                <button type="button" onClick={() => onChoose(record.order.order_id)}>
                  取消
                </button>
              </article>
            ))}
          </section>
        )}
      </section>
    </div>
  );
}

export function isActiveOrderStage(stage: GroceryStage) {
  return stage !== "delivered" && stage !== "cancelled";
}

function itemSummary(record: OrderHistoryRecord) {
  return record.preview.items
    .map((item) => String(item.name ?? "菜品"))
    .filter(Boolean)
    .join("、");
}
