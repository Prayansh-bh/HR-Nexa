import { create } from "zustand";
import { LeaveRequest, CalendarEvent } from "../types";
import { leaveService } from "../services/leave.service";
import { employeeService } from "../services/employee.service";

export interface LeavesStore {
  leaves: LeaveRequest[];
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  setLeaves: (update: LeaveRequest[] | ((prev: LeaveRequest[]) => LeaveRequest[])) => void;
  fetchLeaves: (employeeId?: string, status?: string) => Promise<void>;
  applyLeave: (leaveData: Partial<LeaveRequest>) => Promise<LeaveRequest>;
  updateLeaveStatus: (id: string, status: "Approved" | "Rejected") => Promise<void>;
  fetchEvents: () => Promise<void>;
  createEvent: (eventData: Omit<CalendarEvent, "id">) => Promise<void>;
}

export const useLeavesStore = create<LeavesStore>()((set, get) => ({
  leaves: [],
  events: [],
  isLoading: false,
  error: null,
  setLeaves: (update) =>
    set((state) => ({
      leaves: typeof update === "function" ? update(state.leaves) : update,
    })),
  fetchLeaves: async (employeeId, status) => {
    set({ isLoading: true, error: null });
    try {
      const data = await leaveService.getLeaves(employeeId, status);
      // Data returned from leaveService.getLeaves is already mapped using mapApiLeaveToModel
      set({ leaves: Array.isArray(data) ? data : [], isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch leaves",
        isLoading: false,
      });
    }
  },
  applyLeave: async (leaveData) => {
    let employeeId = (leaveData as any).employeeId;
    let deptName = leaveData.department || "";
    if (!employeeId) {
      const employees = await employeeService.getEmployees();
      const emp = employees.find((e) => e.name === leaveData.employee);
      if (emp) {
        employeeId = emp.id;
        if (!deptName) deptName = emp.department || "";
      }
    }

    const created = await leaveService.createLeave({
      employeeId: employeeId || "EMP001",
      type: leaveData.type,
      from: leaveData.from,
      to: leaveData.to,
      days: Number(leaveData.days),
      reason: leaveData.reason || "",
      department: deptName,
    });
    await get().fetchLeaves();
    return created;
  },
  updateLeaveStatus: async (id, status) => {
    await leaveService.updateLeaveStatus(id, status);
    await get().fetchLeaves();
  },
  fetchEvents: async () => {
    try {
      const data = await leaveService.getEvents();
      set({ events: Array.isArray(data) ? data : [] });
    } catch {
      // Ignore
    }
  },
  createEvent: async (eventData) => {
    await leaveService.createEvent(eventData);
    await get().fetchEvents();
  },
}));
