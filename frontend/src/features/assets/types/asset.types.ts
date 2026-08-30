export type Asset = {
  id: string;
  name: string;
  type: "Laptop" | "Mobile" | "Monitor" | "Accessory";
  serialNumber: string;
  assignedTo?: string;
  assignedDate?: string;
  status: "Assigned" | "Available" | "In Maintenance";
};

export type Device = {
  id: string;
  name: string;
  ip: string;
  status: "Online" | "Offline";
  last: string;
};
