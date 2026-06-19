import type { OrderPreview } from "../api/grocery";

interface ConfirmDialogProps {
  preview: OrderPreview;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ preview, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-label="订单确认">
        <h2>确认购买</h2>
        <p className="confirm-title">{preview.title}</p>
        <dl>
          <div>
            <dt>总价</dt>
            <dd>{(preview.total_cents / 100).toFixed(2)} 元</dd>
          </div>
          <div>
            <dt>地址</dt>
            <dd>{preview.address_masked}</dd>
          </div>
          <div>
            <dt>送达</dt>
            <dd>{preview.eta_minutes} 分钟</dd>
          </div>
        </dl>
        {preview.need_caregiver_confirm ? <p className="policy-note">{preview.policy_reason}</p> : null}
        <div className="dialog-actions">
          <button className="dialog-confirm" disabled={busy || preview.need_caregiver_confirm} onClick={onConfirm}>
            确认提交
          </button>
          <button className="dialog-cancel" disabled={busy} onClick={onCancel}>
            取消
          </button>
        </div>
      </section>
    </div>
  );
}
