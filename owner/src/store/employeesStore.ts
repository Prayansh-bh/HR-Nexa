import { create } from "zustand";
import { Employee } from "../types";
import { employeeService } from "../services/employee.service";
import { employeeSyncService } from "../services/employee-sync.service";

export interface EmployeesStore {
  employees: Employee[];
  isLoading: boolean;
  error: string | null;
  setEmployees: (update: Employee[] | ((prev: Employee[]) => Employee[])) => void;
  fetchEmployees: (search?: string, department?: string, status?: string) => Promise<void>;
  addEmployee: (employee: Partial<Employee>) => Promise<Employee>;
  updateEmployee: (id: string, employee: Partial<Employee>) => Promise<Employee>;
  deleteEmployee: (id: string) => Promise<void>;
}

export const useEmployeesStore = create<EmployeesStore>()((set, get) => ({
  employees: [],
  isLoading: false,
  error: null,
  setEmployees: (update) =>
    set((state) => ({
      employees: typeof update === "function" ? update(state.employees) : update,
    })),
  fetchEmployees: async (search, department, status) => {
    set({ isLoading: true, error: null });
    try {
      const data = await employeeService.getEmployees(search, department, status);
      set({ employees: data, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch employees",
        isLoading: false,
      });
    }
  },
  addEmployee: async (employeeData) => {
    const created = await employeeService.createEmployee(employeeData);
    await get().fetchEmployees();
    // Notify all subscribed UI components and other tabs
    employeeSyncService.notifyEmployeeChange();
    return created;
  },
  updateEmployee: async (id, employeeData) => {
    const updated = await employeeService.updateEmployee(id, employeeData);
    await get().fetchEmployees();
    employeeSyncService.notifyEmployeeChange();
    return updated;
  },
  deleteEmployee: async (id) => {
    await employeeService.deleteEmployee(id);
    await get().fetchEmployees();
    employeeSyncService.notifyEmployeeChange();
  },
}));
