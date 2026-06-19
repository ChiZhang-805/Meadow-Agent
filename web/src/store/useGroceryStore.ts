import { create } from "zustand";

import type { GroceryOption, OrderPreview, OrderResult } from "../api/grocery";

export type GroceryStage =
  | "idle"
  | "searching"
  | "options_ready"
  | "preview_ready"
  | "ordering"
  | "accepted"
  | "at_store"
  | "delivering"
  | "delivered"
  | "cancelled";

export interface OrderHistoryRecord {
  order: OrderResult;
  preview: OrderPreview;
  stage: GroceryStage;
  stageTimes: Partial<Record<GroceryStage, string>>;
  createdAt: string;
  updatedAt: string;
}

interface GroceryState {
  options: GroceryOption[];
  currentPreview?: OrderPreview;
  lastOrder?: OrderResult;
  orderHistory: OrderHistoryRecord[];
  selectedHistoryOrderId?: string;
  pendingConfirmation: boolean;
  stage: GroceryStage;
  setOptions: (options: GroceryOption[]) => void;
  setPreview: (preview: OrderPreview) => void;
  clearPreview: () => void;
  setOrder: (order: OrderResult, preview: OrderPreview) => void;
  setStage: (stage: GroceryStage) => void;
  cancelOrder: (orderId: string) => void;
  selectHistoryOrder: (orderId?: string) => void;
  cancelFlow: () => void;
}

export const useGroceryStore = create<GroceryState>((set) => ({
  options: [],
  orderHistory: [],
  pendingConfirmation: false,
  stage: "idle",
  setOptions: (options) =>
    set({
      options,
      currentPreview: undefined,
      lastOrder: undefined,
      pendingConfirmation: false,
      selectedHistoryOrderId: undefined,
      stage: options.length > 0 ? "options_ready" : "searching"
    }),
  setPreview: (preview) =>
    set({ currentPreview: preview, pendingConfirmation: true, selectedHistoryOrderId: undefined, stage: "preview_ready" }),
  clearPreview: () => set({ currentPreview: undefined, pendingConfirmation: false }),
  setOrder: (order, preview) =>
    set((state) => {
      const now = new Date().toISOString();
      const record: OrderHistoryRecord = {
        order,
        preview,
        stage: "ordering",
        stageTimes: {
          idle: now,
          searching: now,
          options_ready: now,
          preview_ready: now,
          ordering: now
        },
        createdAt: now,
        updatedAt: now
      };
      return {
        lastOrder: order,
        currentPreview: undefined,
        pendingConfirmation: false,
        selectedHistoryOrderId: order.order_id,
        stage: "ordering",
        orderHistory: [record, ...state.orderHistory.filter((item) => item.order.order_id !== order.order_id)].slice(
          0,
          20
        )
      };
    }),
  setStage: (stage) =>
    set((state) => {
      const now = new Date().toISOString();
      return {
        stage,
        orderHistory: state.lastOrder
          ? state.orderHistory.map((item) =>
              item.order.order_id === state.lastOrder?.order_id
                ? { ...item, stage, stageTimes: { ...item.stageTimes, [stage]: now }, updatedAt: now }
                : item
            )
          : state.orderHistory
      };
    }),
  cancelOrder: (orderId) =>
    set((state) => {
      const now = new Date().toISOString();
      const isLastOrder = state.lastOrder?.order_id === orderId;
      return {
        stage: isLastOrder ? "cancelled" : state.stage,
        selectedHistoryOrderId: orderId,
        orderHistory: state.orderHistory.map((item) =>
          item.order.order_id === orderId
            ? { ...item, stage: "cancelled", stageTimes: { ...item.stageTimes, cancelled: now }, updatedAt: now }
            : item
        )
      };
    }),
  selectHistoryOrder: (orderId) => set({ selectedHistoryOrderId: orderId }),
  cancelFlow: () =>
    set({
      currentPreview: undefined,
      pendingConfirmation: false,
      selectedHistoryOrderId: undefined,
      stage: "cancelled"
    })
}));
