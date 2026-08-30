import { useEmployeesStore } from "../employeesStore";
import { useUIStore } from "../uiStore";
import { employeeService } from "../../services/employee.service";
import { dashboardService } from "../../services/dashboard.service";
import { Employee } from "../../types";
import { mapApiEmployeeToModel } from "../../mappers/employee.mapper";
import { employeeSyncService } from "../../services/employee-sync.service";

export const saveEmployee = async (
  e: Omit<Employee, "id" | "avatar"> & { id?: string },
  isEdit: boolean = false,
  toast: { push: (msg: string, tone?: "success" | "error" | "info") => void },
): Promise<boolean> => {
  const store = useEmployeesStore.getState();
  try {
    const serverActive = await dashboardService.isServerActive();
    if (serverActive) {
      if (isEdit && e.id) {
        const updated = await employeeService.updateEmployee(e.id, e);
        store.setEmployees((prev) => prev.map((x) => (x.id === e.id ? updated : x)));
        employeeSyncService.notifyEmployeeChange();
        toast.push("Employee updated");
      } else {
        const id = e.id || `EMP${String(store.employees.length + 1).padStart(3, "0")}`;
        const avatar = e.name
          .split(" ")
          .map((x) => x[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        const created = await employeeService.createEmployee({ ...e, id, avatar });
        store.setEmployees((prev) => [created, ...prev]);
        employeeSyncService.notifyEmployeeChange();
        toast.push(
          `Employee "${created.name}" onboarded! Welcome invitation & login credentials sent to ${created.email} via Brevo email.`,
          "success",
        );
      }
      return true;
    }
  } catch (err: any) {
    if (
      err.code === "SEAT_LIMIT_REACHED" ||
      (err.message && err.message.toLowerCase().includes("seat limit"))
    ) {
      useUIStore.getState().setEmpModal({ open: false });
      useUIStore.getState().setSeatLimitModal({
        open: true,
        message:
          err.message ||
          "Your company has reached its employee seat limit. Upgrade your subscription or free an existing seat before adding another employee.",
        purchasedSeats: err.purchasedSeats || 50,
        usedSeats: err.usedSeats || 50,
      });
    } else {
      toast.push(err.message || "Failed to save employee", "error");
    }
    return false;
  }

  if (isEdit) {
    store.setEmployees((prev) =>
      prev.map((x) => (x.id === e.id ? { ...x, ...e, avatar: x.avatar } : x)),
    );
    toast.push("Employee updated", "success");
  } else {
    const id = e.id || `EMP${String(store.employees.length + 1).padStart(3, "0")}`;
    const avatar = e.name
      .split(" ")
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    store.setEmployees((prev) => [{ ...e, id, avatar } as Employee, ...prev]);
    toast.push(
      `Employee "${e.name}" onboarded! Welcome invitation & login credentials sent to ${e.email} via Brevo email.`,
      "success",
    );
  }
  return true;
};

export const removeEmployee = async (
  id: string,
  toast: { push: (msg: string, tone?: "success" | "error" | "info") => void },
) => {
  const store = useEmployeesStore.getState();
  try {
    const serverActive = await dashboardService.isServerActive();
    if (serverActive) {
      await employeeService.deleteEmployee(id);
      store.setEmployees((prev) => prev.filter((e) => e.id !== id));
      employeeSyncService.notifyEmployeeChange();
      toast.push("Employee removed", "info");
      return;
    }
  } catch (err: any) {
    toast.push(err.message || "Failed to remove employee", "error");
    return;
  }

  store.setEmployees((prev) => prev.filter((e) => e.id !== id));
  toast.push("Employee removed", "info");
};
