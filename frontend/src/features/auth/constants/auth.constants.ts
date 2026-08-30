import { AuthUser, Role } from "../types/auth.types";

export const DEMO_USERS: (AuthUser & { password: string })[] = [
  {
    email: "hr@demo.co",
    password: "demo1234",
    name: "Priya Menon",
    role: "HRAdmin",
    initials: "PM",
    department: "HR",
  },
  {
    email: "manager@demo.co",
    password: "demo1234",
    name: "Aarav Sharma",
    role: "Manager",
    initials: "AS",
    department: "Engineering",
  },
  {
    email: "accountant@demo.co",
    password: "demo1234",
    name: "Maya Patel",
    role: "Accountant",
    initials: "MP",
    department: "Finance",
  },
  {
    email: "employee@demo.co",
    password: "demo1234",
    name: "Devon Chen",
    role: "Employee",
    initials: "DC",
    department: "Engineering",
  },
  {
    email: "viewer@demo.co",
    password: "demo1234",
    name: "Rahul Kapoor",
    role: "Viewer",
    initials: "RK",
    department: "Sales",
  },
];

export const ROLE_LABEL: Record<Role, string> = {
  SuperAdmin: "Super Admin",
  HRAdmin: "HR Admin",
  Manager: "Manager",
  Accountant: "Accountant",
  Employee: "Employee",
  Viewer: "Viewer / HR Staff",
};
