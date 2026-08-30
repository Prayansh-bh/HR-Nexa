import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assetService,
  AssetRecord,
  HardwareDeviceRecord,
  AssetHistoryRecord,
  CreateAssetPayload,
  UpdateAssetPayload,
  AssignAssetPayload,
  ReturnAssetPayload,
  MaintenanceAssetPayload,
  RepairAssetPayload,
  RetireAssetPayload,
} from "../services/asset.service";

export const ASSET_KEYS = {
  all: ["company-assets"] as const,
  list: (params?: { page?: number; limit?: number }) => ["company-assets", params] as const,
  details: (id?: string) => ["company-asset", id] as const,
  history: (id?: string) => ["company-asset-history", id] as const,
  employee: (employeeId?: string) => ["employee-assets", employeeId] as const,
  devices: (params?: { page?: number; limit?: number }) => ["company-asset-devices", params] as const,
};

export function useAssetsQuery(params?: { page?: number; limit?: number }) {
  const query = useQuery({
    queryKey: ASSET_KEYS.list(params),
    queryFn: async () => {
      const data = await assetService.getAssets(params);
      return data;
    },
  });

  const assets = Array.isArray(query.data)
    ? query.data
    : Array.isArray(query.data?.data)
    ? query.data.data
    : [];

  return {
    ...query,
    assets,
    records: assets,
    total: query.data?.total ?? assets.length,
    page: query.data?.page ?? params?.page ?? 1,
    limit: query.data?.limit ?? params?.limit ?? 50,
    totalPages: query.data?.totalPages ?? (assets.length > 0 ? 1 : 0),
  };
}

export function useAssetDetailsQuery(id?: string) {
  return useQuery<AssetRecord>({
    queryKey: ASSET_KEYS.details(id),
    queryFn: async () => {
      if (!id) throw new Error("Asset ID required");
      return assetService.getAssetById(id);
    },
    enabled: !!id,
  });
}

export function useAssetHistoryQuery(id?: string) {
  return useQuery<AssetHistoryRecord[]>({
    queryKey: ASSET_KEYS.history(id),
    queryFn: async () => {
      if (!id) throw new Error("Asset ID required");
      return assetService.getAssetHistory(id);
    },
    enabled: !!id,
  });
}

export function useEmployeeAssetsQuery(employeeId?: string) {
  return useQuery<AssetRecord[]>({
    queryKey: ASSET_KEYS.employee(employeeId),
    queryFn: async () => {
      if (!employeeId) throw new Error("Employee ID required");
      return assetService.getEmployeeAssets(employeeId);
    },
    enabled: !!employeeId,
  });
}

export function useAssetDevicesQuery(params?: { page?: number; limit?: number }) {
  const query = useQuery({
    queryKey: ASSET_KEYS.devices(params),
    queryFn: async () => {
      const data = await assetService.getDevices(params);
      return data;
    },
  });

  const devices = Array.isArray(query.data)
    ? query.data
    : Array.isArray(query.data?.data)
    ? query.data.data
    : [];

  return {
    ...query,
    devices,
    records: devices,
    total: query.data?.total ?? devices.length,
    page: query.data?.page ?? params?.page ?? 1,
    limit: query.data?.limit ?? params?.limit ?? 50,
    totalPages: query.data?.totalPages ?? (devices.length > 0 ? 1 : 0),
  };
}

export function useCreateAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAssetPayload) => assetService.createAsset(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.all });
    },
  });
}

export function useUpdateAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAssetPayload }) =>
      assetService.updateAsset(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.details(variables.id) });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.history(variables.id) });
    },
  });
}

export function useAssignAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AssignAssetPayload }) =>
      assetService.assignAsset(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.details(variables.id) });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.history(variables.id) });
      if (variables.payload.employeeId) {
        queryClient.invalidateQueries({
          queryKey: ASSET_KEYS.employee(variables.payload.employeeId),
        });
      }
    },
  });
}

export function useReturnAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnAssetPayload }) =>
      assetService.returnAsset(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.details(variables.id) });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.history(variables.id) });
      queryClient.invalidateQueries({ queryKey: ["employee-assets"] });
    },
  });
}

export function useMaintenanceAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MaintenanceAssetPayload }) =>
      assetService.sendToMaintenance(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.details(variables.id) });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.history(variables.id) });
    },
  });
}

export function useRepairAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RepairAssetPayload }) =>
      assetService.completeRepair(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.details(variables.id) });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.history(variables.id) });
    },
  });
}

export function useRetireAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RetireAssetPayload }) =>
      assetService.retireAsset(id, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.details(variables.id) });
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.history(variables.id) });
    },
  });
}

export function useDeleteAssetMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assetService.deleteAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_KEYS.all });
    },
  });
}
