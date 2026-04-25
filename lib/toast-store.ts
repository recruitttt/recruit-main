import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ duration, ...rest }) => {
    const id = `toast_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
    const next: Toast = { id, duration: duration ?? 4000, ...rest };
    set((state) => ({ toasts: [...state.toasts, next] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
}

export const toast = {
  success: (opts: ToastOptions) => useToastStore.getState().push({ ...opts, variant: "success" }),
  error: (opts: ToastOptions) => useToastStore.getState().push({ ...opts, variant: "error" }),
  info: (opts: ToastOptions) => useToastStore.getState().push({ ...opts, variant: "info" }),
  warning: (opts: ToastOptions) => useToastStore.getState().push({ ...opts, variant: "warning" }),
  show: (opts: ToastOptions) => useToastStore.getState().push({ ...opts, variant: "default" }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
