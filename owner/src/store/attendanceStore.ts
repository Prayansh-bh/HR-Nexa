import { create } from "zustand";
import { attendanceService } from "../services/attendance.service";

export interface AttendanceStore {
  attendanceRecords: any[];
  isLoading: boolean;
  error: string | null;
  setAttendanceRecords: (update: any[] | ((prev: any[]) => any[])) => void;
  fetchAttendance: (employeeId?: string, date?: string, status?: string) => Promise<void>;
  clockInOut: (record: any) => Promise<any>;
  regularize: (id: string, record: any) => Promise<any>;
  verify: (id: string) => Promise<any>;
}

export const useAttendanceStore = create<AttendanceStore>()((set, get) => ({
  attendanceRecords: [],
  isLoading: false,
  error: null,
  setAttendanceRecords: (update) =>
    set((state) => ({
      attendanceRecords: typeof update === "function" ? update(state.attendanceRecords) : update,
    })),
  fetchAttendance: async (employeeId, date, status) => {
    set({ isLoading: true, error: null });
    try {
      const data = await attendanceService.getAttendance(employeeId, date, status);
      // Data returned from attendanceService.getAttendance is already mapped using mapApiAttendanceToModel
      set({ attendanceRecords: Array.isArray(data) ? data : [], isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch attendance",
        isLoading: false,
      });
    }
  },
  clockInOut: async (record) => {
    const res = await attendanceService.clockInOut(record);
    await get().fetchAttendance();
    return res;
  },
  regularize: async (id, record) => {
    const res = await attendanceService.regularize(id, record);
    await get().fetchAttendance();
    return res;
  },
  verify: async (id) => {
    const res = await attendanceService.verify(id);
    await get().fetchAttendance();
    return res;
  },
}));
