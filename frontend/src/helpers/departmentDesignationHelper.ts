/**
 * departmentDesignationHelper.ts
 *
 * Single Responsibility: Derive Department and Designation data from an
 * array of employees when the backend returns no data.
 *
 * Contracts:
 *   - Pure functions — no side effects, no API calls, no React/DOM dependencies.
 *   - Fully type-safe — no `any`.
 *   - Defensive — handles null/undefined/empty-string values.
 *   - Immutable — never mutates the original employee array.
 *   - Deterministic — results are alphabetically sorted and deduplicated.
 *   - Unit-testable — each function can be tested in isolation.
 *
 * Architecture rule:
 *   Components, hooks, stores, and services must NEVER duplicate this logic.
 *   Always import from this file.
 */

import type { Employee, Department, Designation } from "../types";

// ---------------------------------------------------------------------------
// Internal utilities (private to this module)
// ---------------------------------------------------------------------------

/**
 * Normalise a raw string value:
 *   - Returns `null` if the value is null, undefined, or blank after trimming.
 *   - Otherwise returns the trimmed string.
 */
function normalise(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Extract unique, non-empty strings from `employees` via a selector function,
 * then sort them alphabetically.
 */
function collectUnique(
  employees: ReadonlyArray<Employee>,
  selector: (emp: Employee) => string | null | undefined,
): string[] {
  const seen = new Set<string>();

  for (const emp of employees) {
    const value = normalise(selector(emp));
    if (value !== null) {
      seen.add(value);
    }
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive a list of Departments from employee data.
 *
 * - Reads each employee's `department` field.
 * - Ignores null / undefined / blank values.
 * - Removes duplicates.
 * - Sorts alphabetically by name.
 * - Returns `head` resolved based on employee designation (fallback to first employee).
 * - Never mutates the input array.
 *
 * @param employees - Array of Employee records (may be empty).
 * @returns A sorted, deduplicated array of Department objects.
 */
export function deriveDepartments(employees: ReadonlyArray<Employee>): Department[] {
  const names = collectUnique(employees, (emp) => emp.department);
  return names.map((name) => {
    const deptEmps = employees.filter((e) => e.department === name);
    const headEmp =
      deptEmps.find(
        (e) =>
          e.designation.toLowerCase().includes("head") ||
          e.designation.toLowerCase().includes("manager") ||
          e.designation.toLowerCase().includes("lead") ||
          e.designation.toLowerCase().includes("director"),
      ) || deptEmps[0];
    return { name, head: headEmp ? headEmp.name : "" };
  });
}

/**
 * Derive a list of Designations from employee data.
 *
 * - Reads each employee's `designation` field.
 * - Ignores null / undefined / blank values.
 * - Removes duplicates.
 * - Sorts alphabetically by name.
 * - Returns `band` as "L1" (no band metadata available when deriving from employees).
 * - Never mutates the input array.
 *
 * @param employees - Array of Employee records (may be empty).
 * @returns A sorted, deduplicated array of Designation objects.
 */
export function deriveDesignations(employees: ReadonlyArray<Employee>): Designation[] {
  const names = collectUnique(employees, (emp) => emp.designation);
  return names.map((name) => ({ name, band: "L1" }));
}

/**
 * Resolve the final Department list applying the backend-first priority rule:
 *
 *   1. If `backendDepartments` is a non-empty array → use it (backend is source of truth).
 *   2. Otherwise → derive from `employees` as fallback.
 *
 * This function is the single entry-point that enforces the priority contract.
 *
 * @param backendDepartments - Raw response from the backend departments endpoint.
 * @param employees          - Already-loaded employee records.
 * @returns Final Department array ready for the store.
 */
export function resolveDepartments(
  backendDepartments: Department[] | null | undefined,
  employees: ReadonlyArray<Employee>,
): Department[] {
  if (Array.isArray(backendDepartments)) {
    return backendDepartments.map((d) => {
      if (!d.head || d.head.trim() === "") {
        const deptEmps = employees.filter((e) => e.department === d.name);
        const headEmp =
          deptEmps.find(
            (e) =>
              e.designation.toLowerCase().includes("head") ||
              e.designation.toLowerCase().includes("manager") ||
              e.designation.toLowerCase().includes("lead") ||
              e.designation.toLowerCase().includes("director"),
          ) || deptEmps[0];
        return { ...d, head: headEmp ? headEmp.name : "" };
      }
      return d;
    });
  }
  return deriveDepartments(employees);
}

export function resolveDesignations(
  backendDesignations: Designation[] | null | undefined,
  employees: ReadonlyArray<Employee>,
): Designation[] {
  if (Array.isArray(backendDesignations) && backendDesignations.length > 0) {
    return backendDesignations;
  }
  return deriveDesignations(employees);
}
