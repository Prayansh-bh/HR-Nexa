import { create } from "zustand";
import { persist, StateStorage, createJSONStorage } from "zustand/middleware";
import { Employee, DocRecord } from "../types";

export interface UIStore {
  company: string;
  collapsed: boolean;
  active: string;
  mobileOpen: boolean;
  openGroup: string | null;

  empModal: { open: boolean; editing?: Employee };
  leaveModal: boolean;
  viewEmp: Employee | null;
  messageEmp: Employee | null;
  viewDoc: DocRecord | null;
  confirmState: {
    open: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: "danger" | "primary" | "warning" | "outline";
    onConfirm: () => void;
  };
  seatLimitModal: { open: boolean; message?: string; purchasedSeats?: number; usedSeats?: number };

  setCompany: (update: string | ((prev: string) => string)) => void;
  setCollapsed: (update: boolean | ((prev: boolean) => boolean)) => void;
  setActive: (active: string) => void;
  setMobileOpen: (open: boolean) => void;
  setOpenGroup: (group: string | null) => void;

  setEmpModal: (val: { open: boolean; editing?: Employee }) => void;
  setLeaveModal: (open: boolean) => void;
  setViewEmp: (emp: Employee | null) => void;
  setMessageEmp: (emp: Employee | null) => void;
  setViewDoc: (doc: DocRecord | null) => void;
  setConfirmState: (state: {
    open: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: "danger" | "primary" | "warning" | "outline";
    onConfirm: () => void;
  }) => void;
  setSeatLimitModal: (val: {
    open: boolean;
    message?: string;
    purchasedSeats?: number;
    usedSeats?: number;
  }) => void;
}

const uiStorage: StateStorage = {
  getItem: (name: string): string | null => {
    const comp = localStorage.getItem("hrms.company");
    const coll = localStorage.getItem("hrms.sidebar.collapsed");
    const act = localStorage.getItem("hrms.active");

    const state: any = {};
    if (comp) state.company = JSON.parse(comp);
    if (coll) state.collapsed = JSON.parse(coll);
    if (act) state.active = JSON.parse(act);

    return JSON.stringify({ state, version: 0 });
  },
  setItem: (name: string, value: string): void => {
    const parsed = JSON.parse(value);
    const state = parsed.state;
    if (state.company !== undefined) {
      localStorage.setItem("hrms.company", JSON.stringify(state.company));
    }
    if (state.collapsed !== undefined) {
      localStorage.setItem("hrms.sidebar.collapsed", JSON.stringify(state.collapsed));
    }
    if (state.active !== undefined) {
      localStorage.setItem("hrms.active", JSON.stringify(state.active));
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem("hrms.company");
    localStorage.removeItem("hrms.sidebar.collapsed");
    localStorage.removeItem("hrms.active");
  },
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      company: "",
      collapsed: false,
      active: "dashboard",
      mobileOpen: false,
      openGroup: null,

      empModal: { open: false },
      leaveModal: false,
      viewEmp: null,
      messageEmp: null,
      viewDoc: null,
      confirmState: { open: false, message: "", onConfirm: () => {} },
      seatLimitModal: { open: false },

      setCompany: (update) =>
        set((state) => ({
          company: typeof update === "function" ? update(state.company) : update,
        })),
      setCollapsed: (update) =>
        set((state) => ({
          collapsed: typeof update === "function" ? update(state.collapsed) : update,
        })),
      setActive: (active) => set({ active }),
      setMobileOpen: (mobileOpen) => set({ mobileOpen }),
      setOpenGroup: (openGroup) => set({ openGroup }),

      setEmpModal: (empModal) => set({ empModal }),
      setLeaveModal: (leaveModal) => set({ leaveModal }),
      setViewEmp: (viewEmp) => set({ viewEmp }),
      setMessageEmp: (messageEmp) => set({ messageEmp }),
      setViewDoc: (viewDoc) => set({ viewDoc }),
      setConfirmState: (confirmState) => set({ confirmState }),
      setSeatLimitModal: (seatLimitModal) => set({ seatLimitModal }),
    }),
    {
      name: "hrms.ui",
      storage: createJSONStorage(() => uiStorage),
      partialize: (state) => ({
        company: state.company,
        collapsed: state.collapsed,
        active: state.active,
      }),
    },
  ),
);
