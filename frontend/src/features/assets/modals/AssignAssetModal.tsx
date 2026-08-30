import React, { useState } from "react";
import { UserCheck, Loader2 } from "lucide-react";
import { ModalShell, Field, Btn, inputCls } from "../../../components/ui";
import { useAssignAssetMutation } from "../../../hooks/useAssetsQuery";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";
import { AssetRecord } from "../../../services/asset.service";
import type { Employee } from "../../../types";

interface AssignAssetModalProps {
  asset: AssetRecord;
  onClose: () => void;
  onSuccess?: () => void;
  toast?: (msg: string, tone?: "success" | "error" | "info") => void;
}

const CONDITIONS = ["New", "Good", "Fair"];

export function AssignAssetModal({ asset, onClose, onSuccess, toast }: AssignAssetModalProps) {
  const { data: employeesData, employees: employeesProp, isLoading: isLoadingEmployees } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data)
            ? (employeesData as any).data
            : (Array.isArray(employeesProp) ? employeesProp : [])));
  const activeEmployees = employees.filter((e) => e.status === "Active" || !e.status);

  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id || "");
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().split("T")[0]);
  const [condition, setCondition] = useState(asset.condition || "Good");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  const assignMutation = useAssignAssetMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setError("Please select an employee to allocate this asset");
      return;
    }

    try {
      await assignMutation.mutateAsync({
        id: asset.id,
        payload: {
          employeeId,
          assignedDate: assignedDate || undefined,
          condition,
          remarks: remarks.trim() || undefined,
        },
      });

      toast?.(`Asset "${asset.name}" successfully assigned`, "success");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast?.(err.message || "Failed to assign asset", "error");
    }
  };

  return (
    <ModalShell title={`Assign Asset: ${asset.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-muted/30 p-3 rounded-lg border border-border text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Asset Tag:</span>
            <span className="font-mono font-bold text-foreground">{asset.assetTag || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Category:</span>
            <span className="font-medium text-foreground">{asset.category || asset.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Serial Number:</span>
            <span className="font-mono text-foreground">{asset.serialNumber || "N/A"}</span>
          </div>
        </div>

        <Field label="Assign To Employee *" error={error}>
          {isLoadingEmployees ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading employees...
            </div>
          ) : (
            <select
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setError("");
              }}
              className={inputCls}
            >
              <option value="">Select Employee...</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.department || "No Dept"} · {emp.id})
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Handover Date">
            <input
              type="date"
              value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Handover Condition">
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className={inputCls}
            >
              {CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Handover Remarks / Notes">
          <textarea
            rows={2}
            placeholder="e.g. Issued with charger and laptop sleeve. Signed handover acknowledgment."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className={inputCls + " min-h-[60px] py-2"}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Btn variant="outline" onClick={onClose} disabled={assignMutation.isPending}>
            Cancel
          </Btn>
          <Btn type="submit" variant="primary" disabled={assignMutation.isPending}>
            {assignMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            <span>{assignMutation.isPending ? "Assigning..." : "Assign Hardware"}</span>
          </Btn>
        </div>
      </form>
    </ModalShell>
  );
}
