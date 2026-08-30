/**
 * Strongly-Typed Backend Permission Constants
 *
 * Single source of truth for backend controller authorization decorators.
 * Fully synchronized with all 70 distinct permissions present in PostgreSQL database.
 */

export const Permission = {
  // Chatbox & Communications
  CHATBOX_ACCESS: 'chatbox:access',

  // Support Tickets (Granular Keys)
  SUPPORT_TICKETS_VIEW: 'support:tickets:view',
  SUPPORT_TICKETS_CREATE: 'support:tickets:create',
  SUPPORT_TICKETS_MESSAGE: 'support:tickets:message',
  SUPPORT_TICKETS_STATUS: 'support:tickets:status',
  SUPPORT_TICKETS_RESOLVE: 'support:tickets:resolve',
  SUPPORT_TICKETS_CLOSE: 'support:tickets:close',
  SUPPORT_TICKETS_DELETE: 'support:tickets:delete',

  // Employees Management
  EMPLOYEES_LIST_VIEW: 'employees:list:view',
  EMPLOYEES_LIST_CREATE: 'employees:list:create',
  EMPLOYEES_LIST_EDIT: 'employees:list:edit',
  EMPLOYEES_LIST_DELETE: 'employees:list:delete',
  EMPLOYEES_LIST_EXPORT: 'employees:list:export',
  EMPLOYEES_LIST_IMPORT: 'employees:list:import',

  EMPLOYEES_PROFILE_VIEW: 'employees:profile:view',
  EMPLOYEES_PROFILE_EDIT: 'employees:profile:edit',
  EMPLOYEES_PROFILE_DOCS_UPLOAD: 'employees:profile:docs:upload',
  EMPLOYEES_PROFILE_DOCS_DOWNLOAD: 'employees:profile:docs:download',
  EMPLOYEES_PROFILE_DOCS_DELETE: 'employees:profile:docs:delete',

  EMPLOYEES_SALARY_VIEW: 'employees:salary:view',
  EMPLOYEES_SALARY_EDIT: 'employees:salary:edit',
  EMPLOYEES_SALARY_APPROVE: 'employees:salary:approve',
  EMPLOYEES_SALARY_DELETE: 'employees:salary:delete',

  EMPLOYEES_ATTENDANCE_VIEW: 'employees:attendance:view',
  EMPLOYEES_ATTENDANCE_EDIT: 'employees:attendance:edit',
  EMPLOYEES_ATTENDANCE_REGULARIZE: 'employees:attendance:regularize',
  EMPLOYEES_ATTENDANCE_VERIFY: 'employees:attendance:verify',
  EMPLOYEES_ATTENDANCE_CLOCK: 'employees:attendance:clock',

  EMPLOYEES_DEPARTMENTS_MANAGE: 'employees:departments:manage',
  EMPLOYEES_DESIGNATIONS_MANAGE: 'employees:designations:manage',
  EMPLOYEES_ONBOARDING_MANAGE: 'employees:onboarding:manage',
  EMPLOYEES_ORGCHART_VIEW: 'employees:orgchart:view',

  // Payroll & Compensation
  PAYROLL_PROCESS_VIEW: 'payroll:process:view',
  PAYROLL_PROCESS_GENERATE: 'payroll:process:generate',
  PAYROLL_PROCESS_RUN: 'payroll:process:run',
  PAYROLL_PROCESS_LOCK: 'payroll:process:lock',
  PAYROLL_PROCESS_REOPEN: 'payroll:process:reopen',

  PAYROLL_SLIPS_VIEW: 'payroll:slips:view',
  PAYROLL_SLIPS_DOWNLOAD: 'payroll:slips:download',
  PAYROLL_SLIPS_EMAIL: 'payroll:slips:email',

  // Recruitment & Hiring
  RECRUITMENT_JOBS_VIEW: 'recruitment:jobs:view',
  RECRUITMENT_JOBS_CREATE: 'recruitment:jobs:create',
  RECRUITMENT_JOBS_EDIT: 'recruitment:jobs:edit',
  RECRUITMENT_JOBS_DELETE: 'recruitment:jobs:delete',

  RECRUITMENT_CANDIDATES_VIEW: 'recruitment:candidates:view',
  RECRUITMENT_CANDIDATES_ADD: 'recruitment:candidates:add',
  RECRUITMENT_CANDIDATES_MOVESTAGE: 'recruitment:candidates:movestage',
  RECRUITMENT_CANDIDATES_REJECT: 'recruitment:candidates:reject',
  RECRUITMENT_CANDIDATES_HIRE: 'recruitment:candidates:hire',

  // Reports & Analytics
  REPORTS_PAYROLL_VIEW: 'reports:payroll:view',
  REPORTS_PAYROLL_EXPORT_PDF: 'reports:payroll:export_pdf',
  REPORTS_PAYROLL_EXPORT_EXCEL: 'reports:payroll:export_excel',

  REPORTS_ATTENDANCE_VIEW: 'reports:attendance:view',
  REPORTS_ATTENDANCE_EXPORT: 'reports:attendance:export',

  // Settings & Administration
  SETTINGS_COMPANY_VIEW: 'settings:company:view',
  SETTINGS_COMPANY_EDIT: 'settings:company:edit',
  SETTINGS_ROLES_VIEW: 'settings:roles:view',
  SETTINGS_ROLES_EDIT: 'settings:roles:edit',

  SYSTEM_AUDIT_VIEW: 'system:audit:view',
  SYSTEM_AUDIT_DELETE: 'system:audit:delete',
  SYSTEM_AUDIT_READ: 'system:audit:read',
  SYSTEM_ANNOUNCEMENT_CREATE: 'system:announcement:create',

  // Leave Management (Granular Keys)
  LEAVES_VIEW: 'leaves:requests:view',
  LEAVES_REQUESTS_CREATE: 'leaves:requests:create',
  LEAVES_REQUESTS_EDIT: 'leaves:requests:edit',
  LEAVES_REQUESTS_APPROVE: 'leaves:requests:approve',
  LEAVES_REQUESTS_DELETE: 'leaves:requests:delete',

  // Daily Progress Reports (DPR)
  DPR_VIEW: 'dpr:view',
  DPR_SUBMIT: 'dpr:submit',
  DPR_APPROVE: 'dpr:approve',
  DPR_MANAGE: 'dpr:manage',


  // Legacy / Seed Alias Keys
  ATTENDANCE_CLOCK: 'attendance:clock',
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_VERIFY: 'attendance:verify',
  DEPARTMENTS_MANAGE: 'departments:manage',
  DEPARTMENTS_READ: 'departments:read',
  DOCUMENTS_DELETE: 'documents:delete',
  DOCUMENTS_READ: 'documents:read',
  DOCUMENTS_WRITE: 'documents:write',
  EMPLOYEES_CREATE: 'employees:create',
  EMPLOYEES_DELETE: 'employees:delete',
  EMPLOYEES_READ: 'employees:read',
  EMPLOYEES_UPDATE: 'employees:update',
  LEAVES_APPROVE: 'leaves:requests:approve',
  LEAVES_CREATE: 'leaves:requests:create',
  LEAVES_READ: 'leaves:read',
  PAYROLL_PROCESS: 'payroll:process',
  PAYROLL_READ: 'payroll:read',
} as const;

export type PermissionType = (typeof Permission)[keyof typeof Permission];
