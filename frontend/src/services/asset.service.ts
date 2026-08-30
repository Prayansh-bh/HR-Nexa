import axiosInstance from "../api/axios";
import { handleApiError } from "../utils/apiError";
import type { PaginatedResponse } from "../types/pagination";

export interface AssetRecord {
  id: string;
  companyId?: string;
  assetTag?: string;
  name: string;
  category: string;
  type?: string;
  brand?: string;
  modelNumber?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  currency?: string;
  warrantyExpiry?: string;
  vendor?: string;
  condition?: "New" | "Good" | "Fair" | "Damaged" | string;
  status: "Available" | "Assigned" | "Maintenance" | "Retired";
  assignedToId?: string;
  assignedDate?: string;
  notes?: string;
  invoiceUrl?: string;
  assignedToUser?: {
    id: string;
    name: string;
    email: string;
    department?: string;
    designation?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    department?: string;
    designation?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetHistoryRecord {
  id: string;
  assetId: string;
  companyId: string;
  employeeId?: string;
  action: "CREATED" | "UPDATED" | "ASSIGNED" | "RETURNED" | "MAINTENANCE" | "REPAIRED" | "RETIRED";
  condition?: string;
  remarks?: string;
  actorId?: string;
  actorName?: string;
  timestamp: string;
  employee?: {
    id: string;
    name: string;
    email: string;
    department?: string;
    designation?: string;
  };
}

export interface HardwareDeviceRecord {
  id: string;
  deviceName: string;
  name?: string;
  ipAddress?: string;
  ip?: string;
  macAddress?: string;
  location?: string;
  status: "Online" | "Offline" | "Syncing";
  lastSyncAt?: string;
  lastSeen?: string;
  createdAt?: string;
}

export interface CreateAssetPayload {
  name: string;
  type: string;
  assetTag?: string;
  brand?: string;
  modelNumber?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  currency?: string;
  warrantyExpiry?: string;
  vendor?: string;
  condition?: string;
  notes?: string;
  invoiceUrl?: string;
}

export interface UpdateAssetPayload {
  name?: string;
  type?: string;
  assetTag?: string;
  brand?: string;
  modelNumber?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  currency?: string;
  warrantyExpiry?: string;
  vendor?: string;
  condition?: string;
  notes?: string;
  invoiceUrl?: string;
}

export interface AssignAssetPayload {
  employeeId: string;
  assignedDate?: string;
  condition?: string;
  remarks?: string;
}

export interface ReturnAssetPayload {
  condition: "Good" | "Fair" | "Damaged" | string;
  destinationStatus?: "Available" | "Maintenance" | "Retired";
  remarks?: string;
  returnDate?: string;
}

export interface MaintenanceAssetPayload {
  reason?: string;
  condition?: string;
}

export interface RepairAssetPayload {
  condition?: string;
  remarks?: string;
}

export interface RetireAssetPayload {
  reason?: string;
}

function normalizeAsset(a: any): AssetRecord {
  return {
    id: a.id,
    companyId: a.companyId,
    assetTag: a.assetTag || undefined,
    name: a.name,
    category: a.category || a.type || "General Asset",
    type: a.type || a.category || "General Asset",
    brand: a.brand || undefined,
    modelNumber: a.modelNumber || undefined,
    serialNumber: a.serialNumber || undefined,
    purchaseDate: a.purchaseDate || undefined,
    purchaseCost: a.purchaseCost ? Number(a.purchaseCost) : undefined,
    currency: a.currency || "USD",
    warrantyExpiry: a.warrantyExpiry || undefined,
    vendor: a.vendor || undefined,
    condition: a.condition || "New",
    status: a.status || "Available",
    assignedToId: a.assignedToId || undefined,
    assignedDate: a.assignedDate || undefined,
    notes: a.notes || undefined,
    invoiceUrl: a.invoiceUrl || undefined,
    assignedToUser: a.assignedToUser || (a.assignedTo ? {
      id: a.assignedTo.id,
      name: a.assignedTo.name,
      email: a.assignedTo.email,
      department: a.assignedTo.department,
      designation: a.assignedTo.designation,
    } : undefined),
    assignedTo: a.assignedTo || a.assignedToUser,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export const assetService = {
  async getAssets(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<AssetRecord>> {
    try {
      const response = await axiosInstance.get("/assets", { params });
      const raw = response.data;
      if (raw && Array.isArray(raw.data)) {
        return {
          data: raw.data.map(normalizeAsset),
          total: Number(raw.total) >= 0 ? Number(raw.total) : raw.data.length,
          page: Number(raw.page) > 0 ? Number(raw.page) : 1,
          limit: Number(raw.limit) > 0 ? Number(raw.limit) : 50,
          totalPages: Number(raw.totalPages) >= 0 ? Number(raw.totalPages) : 1,
        };
      }
      if (Array.isArray(raw)) {
        const mapped = raw.map(normalizeAsset);
        return {
          data: mapped,
          total: mapped.length,
          page: 1,
          limit: mapped.length || 50,
          totalPages: 1,
        };
      }
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getAssetById(id: string): Promise<AssetRecord> {
    try {
      const response = await axiosInstance.get(`/assets/${id}`);
      return normalizeAsset(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getAssetHistory(id: string): Promise<AssetHistoryRecord[]> {
    try {
      const response = await axiosInstance.get(`/assets/${id}/history`);
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getEmployeeAssets(employeeId: string): Promise<AssetRecord[]> {
    try {
      const response = await axiosInstance.get(`/assets/employee/${employeeId}`);
      const rawList = Array.isArray(response.data) ? response.data : [];
      return rawList.map(normalizeAsset);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async createAsset(payload: CreateAssetPayload): Promise<AssetRecord> {
    try {
      const response = await axiosInstance.post("/assets", payload);
      return normalizeAsset(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async updateAsset(id: string, payload: UpdateAssetPayload): Promise<AssetRecord> {
    try {
      const response = await axiosInstance.put(`/assets/${id}`, payload);
      return normalizeAsset(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async assignAsset(id: string, payload: AssignAssetPayload): Promise<AssetRecord> {
    try {
      const response = await axiosInstance.post(`/assets/${id}/assign`, payload);
      return normalizeAsset(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async returnAsset(id: string, payload: ReturnAssetPayload): Promise<AssetRecord> {
    try {
      const response = await axiosInstance.post(`/assets/${id}/return`, payload);
      return normalizeAsset(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async sendToMaintenance(id: string, payload: MaintenanceAssetPayload): Promise<AssetRecord> {
    try {
      const response = await axiosInstance.post(`/assets/${id}/maintenance`, payload);
      return normalizeAsset(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async completeRepair(id: string, payload: RepairAssetPayload): Promise<AssetRecord> {
    try {
      const response = await axiosInstance.post(`/assets/${id}/repair-done`, payload);
      return normalizeAsset(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async retireAsset(id: string, payload: RetireAssetPayload): Promise<AssetRecord> {
    try {
      const response = await axiosInstance.post(`/assets/${id}/retire`, payload);
      return normalizeAsset(response.data);
    } catch (error) {
      return handleApiError(error);
    }
  },

  async deleteAsset(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axiosInstance.delete(`/assets/${id}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  async getDevices(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<HardwareDeviceRecord>> {
    try {
      const response = await axiosInstance.get("/assets/devices", { params });
      const raw = response.data;
      const normalizeDevice = (d: any): HardwareDeviceRecord => ({
        id: d.id,
        deviceName: d.deviceName || d.name || "Hardware Node",
        name: d.name || d.deviceName || "Hardware Node",
        ipAddress: d.ipAddress || d.ip || undefined,
        ip: d.ip || d.ipAddress || undefined,
        macAddress: d.macAddress || undefined,
        location: d.location || "N/A",
        status: d.status === "Online" ? "Online" : d.status === "Syncing" ? "Syncing" : "Offline",
        lastSyncAt: d.lastSyncAt || d.lastSeen || undefined,
        lastSeen: d.lastSeen || d.lastSyncAt || undefined,
        createdAt: d.createdAt,
      });

      if (raw && Array.isArray(raw.data)) {
        return {
          data: raw.data.map(normalizeDevice),
          total: Number(raw.total) >= 0 ? Number(raw.total) : raw.data.length,
          page: Number(raw.page) > 0 ? Number(raw.page) : 1,
          limit: Number(raw.limit) > 0 ? Number(raw.limit) : 50,
          totalPages: Number(raw.totalPages) >= 0 ? Number(raw.totalPages) : 1,
        };
      }
      if (Array.isArray(raw)) {
        const mapped = raw.map(normalizeDevice);
        return {
          data: mapped,
          total: mapped.length,
          page: 1,
          limit: mapped.length || 50,
          totalPages: 1,
        };
      }
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
};
