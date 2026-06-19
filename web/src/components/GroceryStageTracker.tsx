import {
  Check,
  ClipboardList,
  LoaderCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UserCheck
} from "lucide-react";

import type { GroceryStage } from "../store/useGroceryStore";

const stages: Array<{
  id: GroceryStage;
  label: string;
}> = [
  { id: "idle", label: "等待开始" },
  { id: "searching", label: "正在查菜" },
  { id: "options_ready", label: "选择菜品" },
  { id: "preview_ready", label: "确认订单" },
  { id: "ordering", label: "正在下单" },
  { id: "accepted", label: "骑手接单" },
  { id: "at_store", label: "骑手到店" },
  { id: "delivering", label: "正在配送" },
  { id: "delivered", label: "已经送达" }
];

export function GroceryStageTracker({
  stage,
  stageTimes = {}
}: {
  stage: GroceryStage;
  stageTimes?: Partial<Record<GroceryStage, string>>;
}) {
  const currentIndex = stage === "cancelled" ? -1 : stages.findIndex((item) => item.id === stage);
  const currentLabel = stage === "cancelled" ? "已经取消" : stages[Math.max(0, currentIndex)]?.label ?? "等待开始";

  return (
    <section className="grocery-stage" aria-label="买菜阶段">
      <div className="stage-summary">
        <span>当前阶段</span>
        <strong>{currentLabel}</strong>
      </div>
      <ol className="stage-list">
        {stages.map((item, index) => {
          const isDone = currentIndex > index;
          const isActive = currentIndex === index;
          const completedAt = stageTimes[item.id];
          return (
            <li className={isDone ? "stage-done" : isActive ? "stage-active" : ""} key={item.id}>
              <span className="stage-icon">{stageIcon(item.id, isDone, isActive)}</span>
              <span className="stage-label">{item.label}</span>
              {completedAt ? (
                <time className="stage-time" dateTime={completedAt}>
                  {formatStageTime(completedAt)}
                </time>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function stageIcon(stage: GroceryStage, isDone: boolean, isActive: boolean) {
  if (isDone) return <Check aria-hidden="true" size={18} />;
  if (isActive && stage === "ordering") return <LoaderCircle aria-hidden="true" className="spin-icon" size={18} />;
  if (stage === "idle") return <ShieldCheck aria-hidden="true" size={18} />;
  if (stage === "searching") return <Search aria-hidden="true" size={18} />;
  if (stage === "options_ready") return <ClipboardList aria-hidden="true" size={18} />;
  if (stage === "preview_ready") return <ShieldCheck aria-hidden="true" size={18} />;
  if (stage === "ordering") return <ShoppingBag aria-hidden="true" size={18} />;
  if (stage === "accepted") return <UserCheck aria-hidden="true" size={18} />;
  if (stage === "at_store") return <Store aria-hidden="true" size={18} />;
  if (stage === "delivering") return <Truck aria-hidden="true" size={18} />;
  if (stage === "delivered") return <PackageCheck aria-hidden="true" size={18} />;
  return <ShieldCheck aria-hidden="true" size={18} />;
}

function formatStageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
