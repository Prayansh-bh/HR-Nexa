import type { SaaSCompany } from "../../../store/companyStore";

export type { SaaSCompany };

export interface SaaSSupportTicket {
  id: string;
  companyName?: string;
  company?: string;
  subject: string;
  status: string;
  priority: string;
  createdAt?: string;
  date?: string;
  responseTime?: string;
}

export interface SaaSInvoice {
  id: string;
  companyName?: string;
  company?: string;
  amount: number;
  date: string;
  status: string;
}
