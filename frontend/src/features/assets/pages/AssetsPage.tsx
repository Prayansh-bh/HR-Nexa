import React, { useState } from "react";
import {
  Laptop,
  Cpu,
  ShieldCheck,
  Search,
  Loader2,
  Plus,
  MoreVertical,
  UserCheck,
  Undo2,
  Wrench,
  CheckCircle2,
  History,
  Edit,
  Trash2,
  Archive,
} from "lucide-react";
import { PageHeader, Card, Btn, Badge, ConfirmModal } from "../../../components/ui";
import { useAssetsQuery, useAssetDevicesQuery, useDeleteAssetMutation } from "../../../hooks/useAssetsQuery";
import { useAuthStore } from "../../../store/authStore";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";
import { useToast } from "../../../hooks";
import { AssetRecord, HardwareDeviceRecord } from "../../../services/asset.service";
import { CreateAssetModal } from "../modals/CreateAssetModal";
import { EditAssetModal } from "../modals/EditAssetModal";
import { AssignAssetModal } from "../modals/AssignAssetModal";
import { ReturnAssetModal } from "../modals/ReturnAssetModal";
import { AssetMaintenanceModal } from "../modals/AssetMaintenanceModal";
import { AssetHistoryDrawer } from "../modals/AssetHistoryDrawer";

type StatusFilter = "ALL" | "Available" | "Assigned" | "Maintenance" | "Retired";

export function AssetsPage() {
  const [activeTab, setActiveTab] = useState<"assets" | "devices">("assets");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const toast = useToast();

  const user = useAuthStore((s) => s.user);
  const canManage = useHasPermission(PERMISSIONS.ASSETS_MANAGE);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);
  const [assigningAsset, setAssigningAsset] = useState<AssetRecord | null>(null);
  const [returningAsset, setReturningAsset] = useState<AssetRecord | null>(null);
  const [maintenanceAsset, setMaintenanceAsset] = useState<{ asset: AssetRecord; mode: "maintenance" | "repair" | "retire" } | null>(null);
  const [historyAsset, setHistoryAsset] = useState<AssetRecord | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<AssetRecord | null>(null);

  const { data: assetsData, assets: assetsProp, isLoading: isLoadingAssets } = useAssetsQuery();
  const assets: AssetRecord[] =
    Array.isArray(assetsProp) && assetsProp.length > 0
      ? assetsProp
      : Array.isArray(assetsData)
      ? (assetsData as AssetRecord[])
      : (assetsData as any)?.data || [];

  const { data: devicesData, devices: devicesProp, isLoading: isLoadingDevices } = useAssetDevicesQuery();
  const devices: HardwareDeviceRecord[] =
    Array.isArray(devicesProp) && devicesProp.length > 0
      ? devicesProp
      : Array.isArray(devicesData)
      ? (devicesData as HardwareDeviceRecord[])
      : (devicesData as any)?.data || [];
  const deleteMutation = useDeleteAssetMutation();

  // Filter Assets
  const filteredAssets = assets.filter((a) => {
    const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(q) ||
      (a.category || a.type || "").toLowerCase().includes(q) ||
      (a.assetTag && a.assetTag.toLowerCase().includes(q)) ||
      (a.serialNumber && a.serialNumber.toLowerCase().includes(q)) ||
      (a.brand && a.brand.toLowerCase().includes(q)) ||
      (a.assignedToUser?.name || a.assignedTo?.name || "").toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  // Filter Devices
  const filteredDevices = devices.filter((d) => {
    const q = search.toLowerCase();
    return (
      !search ||
      (d.deviceName || d.name || "").toLowerCase().includes(q) ||
      (d.location || "").toLowerCase().includes(q) ||
      (d.ipAddress && d.ipAddress.includes(q)) ||
      (d.ip && d.ip.includes(q))
    );
  });

  const handleDelete = async () => {
    if (!deletingAsset) return;
    try {
      await deleteMutation.mutateAsync(deletingAsset.id);
      toast.push(`Asset "${deletingAsset.name}" deleted from inventory`, "success");
      setDeletingAsset(null);
    } catch (err: any) {
      toast.push(err.message || "Failed to delete asset", "error");
    }
  };

  const isLoading = isLoadingAssets || isLoadingDevices;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Asset & Hardware Device Management"
          subtitle="Track company laptops, mobile devices, hardware accessories, and attendance sync nodes."
        />
        {canManage && activeTab === "assets" && (
          <Btn variant="primary" onClick={() => setIsCreateOpen(true)} className="shadow-md">
            <Plus className="h-4 w-4" />
            <span>Add Asset</span>
          </Btn>
        )}
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4 !p-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Laptop className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">{assets.length}</div>
            <div className="text-xs text-muted-foreground font-medium">Total Assets</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4 !p-4">
          <div className="p-3 rounded-xl bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">
              {assets.filter((a) => a.status === "Available").length}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Available in Stock</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4 !p-4">
          <div className="p-3 rounded-xl bg-[color:var(--color-info)]/10 text-[color:var(--color-info)]">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">
              {assets.filter((a) => a.status === "Assigned").length}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Assigned Hardware</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4 !p-4">
          <div className="p-3 rounded-xl bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-foreground">{devices.length}</div>
            <div className="text-xs text-muted-foreground font-medium">Hardware Nodes</div>
          </div>
        </Card>
      </div>

      {/* Tabs & Search Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-wrap gap-2">
          <Btn
            variant={activeTab === "assets" ? "primary" : "outline"}
            size="sm"
            onClick={() => setActiveTab("assets")}
          >
            Laptops & Assets ({assets.length})
          </Btn>
          <Btn
            variant={activeTab === "devices" ? "primary" : "outline"}
            size="sm"
            onClick={() => setActiveTab("devices")}
          >
            Hardware Devices ({devices.length})
          </Btn>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name, tag, serial, employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Status Filter Strip for Assets */}
      {activeTab === "assets" && (
        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "Available", "Assigned", "Maintenance", "Retired"] as StatusFilter[]).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                statusFilter === st
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {st === "ALL" ? `All (${assets.length})` : `${st} (${assets.filter((a) => a.status === st).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      <Card className="!p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === "assets" ? (
          filteredAssets.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No hardware assets recorded matching selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase">
                  <tr>
                    <th className="py-3 px-4">Asset Details</th>
                    <th className="py-3 px-4">Tag / Serial</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Custody</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{asset.name}</div>
                        {asset.brand && (
                          <div className="text-[11px] text-muted-foreground">
                            {asset.brand} {asset.modelNumber ? `· ${asset.modelNumber}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div>{asset.assetTag || "—"}</div>
                        {asset.serialNumber && (
                          <div className="text-[10px] text-muted-foreground">S/N: {asset.serialNumber}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">{asset.category || asset.type || "General Asset"}</td>
                      <td className="py-3 px-4">
                        <Badge
                          tone={
                            asset.status === "Assigned"
                              ? "indigo"
                              : asset.status === "Available"
                              ? "green"
                              : asset.status === "Maintenance"
                              ? "amber"
                              : "slate"
                          }
                        >
                          {asset.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {asset.assignedToUser?.name || asset.assignedTo?.name ? (
                          <div>
                            <span className="font-medium text-foreground">
                              {asset.assignedToUser?.name || asset.assignedTo?.name}
                            </span>
                            {asset.assignedDate && (
                              <div className="text-[10px] text-muted-foreground">Since: {asset.assignedDate}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">In Inventory</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* History Button (Readable by all ASSETS_VIEW) */}
                          <button
                            onClick={() => setHistoryAsset(asset)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                            title="Custody History Log"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>

                          {/* Mutation Actions (Guarded by ASSETS_MANAGE) */}
                          {canManage && (
                            <>
                              {asset.status === "Available" && (
                                <button
                                  onClick={() => setAssigningAsset(asset)}
                                  className="px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-[11px] transition flex items-center gap-1"
                                  title="Assign to Employee"
                                >
                                  <UserCheck className="h-3 w-3" /> Assign
                                </button>
                              )}

                              {asset.status === "Assigned" && (
                                <button
                                  onClick={() => setReturningAsset(asset)}
                                  className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 font-semibold text-[11px] transition flex items-center gap-1"
                                  title="Return Asset"
                                >
                                  <Undo2 className="h-3 w-3" /> Return
                                </button>
                              )}

                              {asset.status === "Available" && (
                                <button
                                  onClick={() => setMaintenanceAsset({ asset, mode: "maintenance" })}
                                  className="p-1.5 rounded-lg hover:bg-muted text-amber-600 hover:text-amber-700 transition"
                                  title="Send to Maintenance"
                                >
                                  <Wrench className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {asset.status === "Maintenance" && (
                                <button
                                  onClick={() => setMaintenanceAsset({ asset, mode: "repair" })}
                                  className="px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 font-semibold text-[11px] transition flex items-center gap-1"
                                  title="Complete Repair"
                                >
                                  <CheckCircle2 className="h-3 w-3" /> Repair Done
                                </button>
                              )}

                              <button
                                onClick={() => setEditingAsset(asset)}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                                title="Edit Asset Specs"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>

                              {asset.status !== "Retired" && asset.status !== "Assigned" && (
                                <button
                                  onClick={() => setMaintenanceAsset({ asset, mode: "retire" })}
                                  className="p-1.5 rounded-lg hover:bg-muted text-slate-500 hover:text-slate-700 transition"
                                  title="Retire / Decommission"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {asset.status === "Available" && (
                                <button
                                  onClick={() => setDeletingAsset(asset)}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                                  title="Delete Asset"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredDevices.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No hardware devices found matching query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase">
                <tr>
                  <th className="py-3 px-4">Device Name</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">IP / MAC Address</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDevices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {dev.deviceName || dev.name || "Hardware Node"}
                    </td>
                    <td className="py-3 px-4">{dev.location || "N/A"}</td>
                    <td className="py-3 px-4 font-mono">
                      {dev.ipAddress || dev.ip || dev.macAddress || "DHCP Dynamic"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge tone={dev.status === "Online" ? "green" : "rose"}>{dev.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals & Drawers */}
      {isCreateOpen && (
        <CreateAssetModal
          onClose={() => setIsCreateOpen(false)}
          toast={toast.push}
        />
      )}

      {editingAsset && (
        <EditAssetModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          toast={toast.push}
        />
      )}

      {assigningAsset && (
        <AssignAssetModal
          asset={assigningAsset}
          onClose={() => setAssigningAsset(null)}
          toast={toast.push}
        />
      )}

      {returningAsset && (
        <ReturnAssetModal
          asset={returningAsset}
          onClose={() => setReturningAsset(null)}
          toast={toast.push}
        />
      )}

      {maintenanceAsset && (
        <AssetMaintenanceModal
          asset={maintenanceAsset.asset}
          mode={maintenanceAsset.mode}
          onClose={() => setMaintenanceAsset(null)}
          toast={toast.push}
        />
      )}

      {historyAsset && (
        <AssetHistoryDrawer
          asset={historyAsset}
          onClose={() => setHistoryAsset(null)}
        />
      )}

      {deletingAsset && (
        <ConfirmModal
          title={`Delete Asset: ${deletingAsset.name}`}
          message={`Are you sure you want to permanently delete this asset (${deletingAsset.assetTag || deletingAsset.id}) from inventory? This action is only permitted for assets with no historical employee custody records.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingAsset(null)}
        />
      )}
    </div>
  );
}
