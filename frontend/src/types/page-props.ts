import type {
  AuthUser,
  Employee,
  Department,
  Designation,
  LeaveRequest,
  LeaveType,
  Holiday,
  Device,
  Zone,
  DocRecord,
  EmpDoc,
  Message,
  Broadcast,
} from "./index";

export type PageProps = {
  active: string;
  setActive: (id: string) => void;
  user: AuthUser;
  setUser: (u: AuthUser | null) => void;
  employees: Employee[];
  setEmployees: (e: Employee[] | ((p: Employee[]) => Employee[])) => void;
  leaves: LeaveRequest[];
  setLeaves: (l: LeaveRequest[] | ((p: LeaveRequest[]) => LeaveRequest[])) => void;
  departments: Department[];
  setDepartments: (d: Department[] | ((p: Department[]) => Department[])) => void;
  designations: Designation[];
  setDesignations: (d: Designation[] | ((p: Designation[]) => Designation[])) => void;
  devices: Device[];
  setDevices: (d: Device[] | ((p: Device[]) => Device[])) => void;
  zones: Zone[];
  setZones: (z: Zone[] | ((p: Zone[]) => Zone[])) => void;
  leaveTypes: LeaveType[];
  setLeaveTypes: (l: LeaveType[] | ((p: LeaveType[]) => LeaveType[])) => void;
  holidays: Holiday[];
  setHolidays: (h: Holiday[] | ((p: Holiday[]) => Holiday[])) => void;
  docs: DocRecord[];
  setDocs: (d: DocRecord[] | ((p: DocRecord[]) => DocRecord[])) => void;
  empDocs: EmpDoc[];
  setEmpDocs: (d: EmpDoc[] | ((p: EmpDoc[]) => EmpDoc[])) => void;
  users: any[];
  setUsers: (u: any[] | ((p: any[]) => any[])) => void;
  messages: Message[];
  setMessages: (m: Message[] | ((p: Message[]) => Message[])) => void;
  attendanceRecords: any[];
  setAttendanceRecords: (r: any[] | ((p: any[]) => any[])) => void;
  salaryComponents: any[];
  setSalaryComponents: (c: any[] | ((p: any[]) => any[])) => void;
  salarySlips: any[];
  setSalarySlips: (s: any[] | ((p: any[]) => any[])) => void;
  payrollHistory: any[];
  setPayrollHistory: (h: any[] | ((p: any[]) => any[])) => void;
  payrollInputs: Record<string, any>;
  setPayrollInputs: (
    inp: Record<string, any> | ((p: Record<string, any>) => Record<string, any>),
  ) => void;
  broadcasts: Broadcast[];
  setBroadcasts: (b: Broadcast[] | ((p: Broadcast[]) => Broadcast[])) => void;
  triggerConfirm: (message: string, onConfirm: () => void, title?: string) => void;
  onAddEmployee: () => void;
  onEditEmployee: (e: Employee) => void;
  onMessageEmployee: (e: Employee) => void;
  onApplyLeave: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemove: (id: string) => void;
  onView: (e: Employee) => void;
  onViewDoc: (d: DocRecord) => void;
  toast: (m: string, tone?: "success" | "error" | "info") => void;
  company: string;
};
