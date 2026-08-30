export type BillingCycle = 'Monthly' | 'Annual';

export interface PublicPlanFeature {
  key: string;
  name: string;
  included: boolean;
  category?: string;
}

export interface PublicPlanLimits {
  employeeLimit: number;
  storageLimitGB: number;
  branchLimit: number;
  apiCallLimit: number;
}

export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  monthlyAvailable: boolean;
  annualAvailable: boolean;
  isDefault?: boolean;
  isPopular?: boolean;
  version: number;
  limits: PublicPlanLimits;
  features: PublicPlanFeature[];
}

export interface PublicPlansResponse {
  plans: PublicPlan[];
}

/**
 * Display-only initial bootstrap / fallback plans matching standard database schema.
 * Note: These initial values prevent broken UI flashes on cold load; authoritative pricing
 * is dynamically fetched from GET /api/public/plans and enforced server-side during checkout.
 */
export const DEFAULT_PUBLIC_PLANS: PublicPlan[] = [
  {
    id: 'plan_starter',
    code: 'PLAN_BASIC',
    name: 'Starter',
    description: 'Essential HR & attendance tools for small teams and growing startups.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'INR',
    monthlyAvailable: true,
    annualAvailable: true,
    isDefault: true,
    isPopular: false,
    version: 1,
    limits: {
      employeeLimit: 10,
      storageLimitGB: 10,
      branchLimit: 1,
      apiCallLimit: 1000,
    },
    features: [
      { key: 'CORE_HR', name: 'Core HR & Employee Directory', included: true },
      { key: 'ATTENDANCE', name: 'Time & Attendance Tracking', included: true },
      { key: 'LEAVE', name: 'Leave Management & Approvals', included: true },
      { key: 'DOCS', name: 'Employee Document Vault', included: true },
      { key: 'PAYROLL', name: 'Automated Payroll Engine', included: false },
      { key: 'PERFORMANCE', name: 'Performance & OKR Reviews', included: false },
      { key: 'RECRUITMENT', name: 'Recruitment & ATS Pipeline', included: false },
    ],
  },
  {
    id: 'plan_standard',
    code: 'PLAN_STD',
    name: 'Professional',
    description: 'Complete HR automation & payroll compliance for growing businesses.',
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    currency: 'INR',
    monthlyAvailable: true,
    annualAvailable: true,
    isDefault: false,
    isPopular: true,
    version: 1,
    limits: {
      employeeLimit: 100,
      storageLimitGB: 50,
      branchLimit: 3,
      apiCallLimit: 5000,
    },
    features: [
      { key: 'CORE_HR', name: 'Core HR & Employee Directory', included: true },
      { key: 'ATTENDANCE', name: 'Time & Attendance with Geo-Fencing', included: true },
      { key: 'LEAVE', name: 'Custom Leave Policies & Multi-tier Approvals', included: true },
      { key: 'DOCS', name: 'Document Vault & Verification', included: true },
      { key: 'PAYROLL', name: 'Automated Payroll & Statutory Tax Deductions', included: true },
      { key: 'PERFORMANCE', name: 'Performance Appraisals & Goal Tracking', included: true },
      { key: 'RECRUITMENT', name: 'Recruitment & ATS Pipeline', included: false },
    ],
  },
  {
    id: 'plan_premium',
    code: 'PLAN_PREM',
    name: 'Enterprise',
    description: 'Comprehensive workforce management with advanced analytics & ATS.',
    monthlyPrice: 14999,
    yearlyPrice: 149990,
    currency: 'INR',
    monthlyAvailable: true,
    annualAvailable: true,
    isDefault: false,
    isPopular: false,
    version: 1,
    limits: {
      employeeLimit: 500,
      storageLimitGB: 100,
      branchLimit: 10,
      apiCallLimit: 50000,
    },
    features: [
      { key: 'CORE_HR', name: 'Core HR & Custom Org Hierarchy', included: true },
      { key: 'ATTENDANCE', name: 'Biometric Sync & Geo-Fenced Mobile Punch', included: true },
      { key: 'LEAVE', name: 'Advanced Leave Rules & Shift Scheduling', included: true },
      { key: 'DOCS', name: 'Enterprise Document Vault & Compliance', included: true },
      { key: 'PAYROLL', name: '1-Click Payroll, PF/ESI/TDS & Bank Transfer Export', included: true },
      { key: 'PERFORMANCE', name: '360° Reviews, OKRs & Appraisal Cycles', included: true },
      { key: 'RECRUITMENT', name: 'Full Recruitment Pipeline & ATS Workflows', included: true },
    ],
  },
];
