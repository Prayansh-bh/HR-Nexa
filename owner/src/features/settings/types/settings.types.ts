export type Department = {
  id?: string;
  name: string;
  head?: string;
};

export type Designation = {
  id?: string;
  name: string;
  band: string;
};

export type AuditLog = {
  id: string;
  userId?: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
};

export type SystemHealth = {
  status: "Healthy" | "Degraded" | "Down";
  uptimeSeconds: number;
  cpuUsagePct: number;
  memoryUsagePct: number;
};
