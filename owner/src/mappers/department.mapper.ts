import type { Department } from "../types";

export function mapApiDepartmentToModel(raw: any): Department {
  return {
    id: raw.id,
    name: raw.name,
    head: raw.head ?? "",
  };
}
