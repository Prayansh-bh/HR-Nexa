import type { Designation } from "../types";

export function mapApiDesignationToModel(raw: any): Designation {
  return {
    id: raw.id,
    name: raw.name,
    band: raw.band ?? "",
  };
}
