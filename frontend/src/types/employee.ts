export type Employee = {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  status: "Active" | "On Leave" | "Inactive";
  joined: string;
  salary: number | null;
  avatar: string;
  phone?: string;
  address?: string;
  dob?: string;
  gender?: string;
  uan?: string;
  esic?: string;
  pan?: string;
  aadhaar?: string;
  bankName?: string;
  accountNumber?: string;
  accountNo?: string;
  ifscCode?: string;
  ifsc?: string;
  location?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  passportNumber?: string;
  personalEmail?: string;
  permanentAddress?: string;
  emergencyContactNamePrimary?: string;
  emergencyContactRelPrimary?: string;
  emergencyContactPhonePrimary?: string;
  emergencyContactNameSecondary?: string;
  emergencyContactRelSecondary?: string;
  emergencyContactPhoneSecondary?: string;
  photoData?: string;
  photoRotation?: number;
  user?: { id: string; email: string; role: string; roleId?: string | null };
  userId?: string;
  managerId?: string | null;
};

export type Department = {
  id?: string;
  name: string;
  head: string;
};

export type Designation = {
  id?: string;
  name: string;
  band: string;
};

export interface OrgChartEmployee {
  id: string;
  name: string;
  avatar: string | null;
  managerId: string | null;
  designation: string | null;
  department: string | null;
}

