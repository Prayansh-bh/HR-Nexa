import { create } from "zustand";
import { Device, Zone, LeaveType, Holiday } from "../types";
import { attendanceService } from "../services/attendance.service";
import { leaveService } from "../services/leave.service";

export interface OrgStore {
  devices: Device[];
  zones: Zone[];
  leaveTypes: LeaveType[];
  holidays: Holiday[];
  users: any[];
  isLoading: boolean;
  error: string | null;

  setDevices: (update: Device[] | ((prev: Device[]) => Device[])) => void;
  setZones: (update: Zone[] | ((prev: Zone[]) => Zone[])) => void;
  setLeaveTypes: (update: LeaveType[] | ((prev: LeaveType[]) => LeaveType[])) => void;
  setHolidays: (update: Holiday[] | ((prev: Holiday[]) => Holiday[])) => void;
  setUsers: (update: any[] | ((prev: any[]) => any[])) => void;

  fetchDevices: () => Promise<void>;
  createDevice: (name: string, ip: string) => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
  syncDevice: (id: string) => Promise<void>;

  fetchZones: () => Promise<void>;
  createZone: (name: string, radius: string, lat: string) => Promise<void>;
  deleteZone: (name: string) => Promise<void>;

  fetchLeaveTypes: () => Promise<void>;
  createLeaveType: (name: string, days: number, tone: string) => Promise<void>;
  deleteLeaveType: (name: string) => Promise<void>;
}

export const useOrgStore = create<OrgStore>()((set, get) => ({
  devices: [],
  zones: [],
  leaveTypes: [],
  holidays: [],
  users: [],
  isLoading: false,
  error: null,

  setDevices: (update) =>
    set((state) => ({
      devices: typeof update === "function" ? update(state.devices) : update,
    })),
  setZones: (update) =>
    set((state) => ({
      zones: typeof update === "function" ? update(state.zones) : update,
    })),
  setLeaveTypes: (update) =>
    set((state) => ({
      leaveTypes: typeof update === "function" ? update(state.leaveTypes) : update,
    })),
  setHolidays: (update) =>
    set((state) => ({
      holidays: typeof update === "function" ? update(state.holidays) : update,
    })),
  setUsers: (update) =>
    set((state) => ({
      users: typeof update === "function" ? update(state.users) : update,
    })),

  fetchDevices: async () => {
    try {
      const data = await attendanceService.getDevices();
      set({ devices: data });
    } catch {
      // Ignore
    }
  },
  createDevice: async (name, ip) => {
    await attendanceService.createDevice({ name, ip });
    await get().fetchDevices();
  },
  deleteDevice: async (id) => {
    await attendanceService.deleteDevice(id);
    await get().fetchDevices();
  },
  syncDevice: async (id) => {
    await attendanceService.syncDevice(id);
    await get().fetchDevices();
  },

  fetchZones: async () => {
    try {
      const data = await attendanceService.getZones();
      set({ zones: data });
    } catch {
      // Ignore
    }
  },
  createZone: async (name, radius, lat) => {
    await attendanceService.createZone({
      name,
      radiusMeters: Number(radius) || 100,
      latitude: Number(lat) || 0,
      longitude: 0,
    });
    await get().fetchZones();
  },
  deleteZone: async (name) => {
    await attendanceService.deleteZone(name);
    await get().fetchZones();
  },

  fetchLeaveTypes: async () => {
    try {
      const data = await leaveService.getLeaveTypes();
      set({ leaveTypes: data });
    } catch {
      // Ignore
    }
  },
  createLeaveType: async (name, days, tone) => {
    await leaveService.createLeaveType({ name, days, tone });
    await get().fetchLeaveTypes();
  },
  deleteLeaveType: async (name) => {
    await leaveService.deleteLeaveType(name);
    await get().fetchLeaveTypes();
  },
}));
