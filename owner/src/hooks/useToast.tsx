import { create } from "zustand";

export interface ToastItem {
  id: number;
  msg: string;
  tone: "success" | "error" | "info";
}

interface ToastStore {
  toasts: ToastItem[];
  push: (msg: string, tone?: "success" | "error" | "info") => void;
  remove: (id: number) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (msg: string, tone: "success" | "error" | "info" = "success") => {
    const id = Date.now() + Math.random();
    set((state) => ({ toasts: [...state.toasts, { id, msg, tone }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }));
    }, 3200);
  },
  remove: (id: number) => {
    set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }));
  },
}));

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto min-w-[240px] rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md animate-in slide-in-from-right-4 fade-in ${
            t.tone === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : t.tone === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-sky-500/30 bg-sky-500/10 text-sky-400"
          }`}
        >
          <div className="text-sm font-semibold">{t.msg}</div>
        </div>
      ))}
    </div>
  );
}

export const toast = (msg: string, tone: "success" | "error" | "info" = "success") => {
  useToastStore.getState().push(msg, tone);
};
toast.push = toast;

export function useToast() {
  return { push: toast, toast, ToastHost };
}
