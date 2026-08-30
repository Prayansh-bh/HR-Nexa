import type { Employee } from "../types";

export function mapApiEmployeeToModel(raw: any): Employee {
  // Handle both legacy (string) and new relational (object) dept/designation
  const department =
    raw.department?.name || // new relational: { id, name, ... }
    raw.departmentName || // legacy string field
    "";

  const designation =
    raw.designation?.name || // new relational: { id, name, ... }
    (typeof raw.designation === "string" ? raw.designation : "") || // legacy string
    "";

  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    department,
    designation,
    status: raw.status || "Active",
    joined: raw.joined || "",
    salary: typeof raw.salary === "number" ? raw.salary : Number(raw.salary) || 0,
    avatar: raw.avatar || raw.name?.slice(0, 2).toUpperCase() || "??",
    phone: raw.phone,
    address: raw.address,
    dob: raw.dob,
    gender: raw.gender,
    location: raw.location,
    uan: raw.uan,
    esic: raw.esic,
    pan: raw.pan,
    aadhaar: raw.aadhaar,
    user: raw.user,
    userId: raw.userId || raw.user?.id,
    managerId: raw.managerId,
  };
}
