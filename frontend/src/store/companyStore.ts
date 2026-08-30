import { create } from "zustand";

export interface SaaSCompany {
  id: string;
  name: string;
  plan: string;
  employeesCount: number;
  status:
    | "Active"
    | "Trial"
    | "Expired"
    | "Suspended"
    | "Pending"
    | "Pending Approval"
    | "PENDING_APPROVAL"
    | "Rejected"
    | "Archived"
    | "Cancelled";
  joinedDate: string;
  billingStartDate?: string;
  expiryDate: string;
  createdAt?: string;
  ownerName: string;
  ownerEmail: string;
  purchasedSeats: number;
  usedSeats: number;
  logo?: string;
  gst?: string;
  pan?: string;
  cin?: string;
  address?: string;
  contact?: string;
  hrAdmin?: string;
  storageUsed?: string;
  billing?: string;
  apiKeys?: number;
  loginActivity?: string;
}

export interface CompanyUIStore {
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useCompanyUIStore = create<CompanyUIStore>()((set) => ({
  selectedCompanyId: null,
  setSelectedCompanyId: (selectedCompanyId) => set({ selectedCompanyId }),
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));

// Backward-compatibility exports
export const useCompanyStore = useCompanyUIStore;
