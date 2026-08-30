import type { PermissionCategory } from "../types/permissions.types";

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "leaves",
    name: "Leave Management",
    subModules: [
      {
        id: "leaves.requests",
        name: "Leave Requests & Policies",
        actions: [
          {
            id: "leaves:requests:view",
            label: "View Leave Requests",
            description: "View leave requests and employee balance quotas",
          },
          {
            id: "leaves:requests:create",
            label: "Create Leave Request",
            description: "Submit leave requests on behalf of self or team",
          },
          {
            id: "leaves:requests:edit",
            label: "Edit Leave Request",
            description: "Modify pending leave requests",
          },
          {
            id: "leaves:requests:approve",
            label: "Approve / Reject Leaves",
            description: "Approve or reject leave requests",
          },
          {
            id: "leaves:requests:delete",
            label: "Delete Leave Request",
            description: "Cancel or remove leave requests",
          },
          {
            id: "leaves:policy:manage",
            label: "Manage Leave Policies",
            description: "Configure leave accruals, carryover rules, and holiday calendars",
          },
        ],
      },
    ],
  },
  {
    id: "performance",
    name: "Performance Management",
    subModules: [
      {
        id: "performance.evaluations",
        name: "Reviews & Review Cycles",
        actions: [
          {
            id: "performance:reviews:view",
            label: "View Performance Reviews",
            description: "View self or team performance appraisal reviews",
          },
          {
            id: "performance:cycles:manage",
            label: "Manage Review Cycles",
            description: "Create and configure performance evaluation cycles and KPIs",
          },
        ],
      },
    ],
  },
  {
    id: "chatbox",
    name: "Communications & Helpdesk",
    subModules: [
      {
        id: "chatbox.messaging",
        name: "Internal Chatbox & Announcements",
        actions: [
          {
            id: "chatbox:access",
            label: "Access Chatbox & Messaging",
            description: "Send and receive real-time direct messages with team members",
          },
          {
            id: "system:announcement:create",
            label: "Broadcast Announcements",
            description: "Publish company-wide broadcast announcements",
          },
        ],
      },
      {
        id: "chatbox.tickets",
        name: "Support Tickets & Helpdesk",
        actions: [
          { id: "support:tickets:view", label: "View Support Tickets", description: "View company support and IT helpdesk tickets" },
          { id: "support:tickets:create", label: "Create Support Ticket", description: "Raise new support and assistance tickets" },
          { id: "support:tickets:message", label: "Send Ticket Messages", description: "Participate in ticket discussions and reply threads" },
          { id: "support:tickets:status", label: "Update Ticket Status", description: "Change ticket status (Open / In Progress)" },
          { id: "support:tickets:resolve", label: "Resolve Support Tickets", description: "Mark support tickets as Resolved" },
          { id: "support:tickets:close", label: "Close Support Tickets", description: "Mark support tickets as Closed" },
          { id: "support:tickets:delete", label: "Delete Support Tickets", description: "Soft delete or purge support tickets" },
        ],
      },
    ],
  },
  {
    id: "employees",
    name: "Employees & Directory",
    subModules: [
      {
        id: "employees.list",
        name: "Employee Directory",
        actions: [
          {
            id: "employees:list:view",
            label: "View Employees",
            description: "View list and roster of company employees",
          },
          { id: "employees:list:create", label: "Create Employee", description: "Add new employee profiles manually or via invites" },
          {
            id: "employees:list:edit",
            label: "Edit Employee",
            description: "Update existing employee details and demographic info",
          },
          { id: "employees:list:delete", label: "Delete Employee", description: "Terminate or remove employee records" },
          {
            id: "employees:list:export",
            label: "Export Employee List",
            description: "Export employee records to CSV / Excel",
          },
          {
            id: "employees:list:import",
            label: "Import Employees",
            description: "Bulk import employees via CSV spreadsheet",
          },
        ],
      },
      {
        id: "employees.profile",
        name: "Employee Profile & Documents",
        actions: [
          {
            id: "employees:profile:view",
            label: "View Profile",
            description: "View full employee personal and employment profiles",
          },
          {
            id: "employees:profile:edit",
            label: "Edit Profile",
            description: "Update profile information, emergency contacts, and bio",
          },
          {
            id: "employees:profile:docs:upload",
            label: "Upload Documents",
            description: "Upload identity, tax, certifications, and employment documents",
          },
          {
            id: "employees:profile:docs:download",
            label: "Download Documents",
            description: "Download stored employee verification documents",
          },
          {
            id: "employees:profile:docs:delete",
            label: "Delete Documents",
            description: "Delete stored employee identity or contract files",
          },
          {
            id: "documents:verify",
            label: "Verify Documents",
            description: "Approve or reject uploaded employee compliance documents",
          },
        ],
      },
      {
        id: "employees.salary",
        name: "Compensation & Structure",
        actions: [
          {
            id: "employees:salary:view",
            label: "View Salary",
            description: "View base salary, CTC structure, and allowance breakdown",
          },
          {
            id: "employees:salary:edit",
            label: "Edit Salary",
            description: "Modify compensation components and pay grade structures",
          },
          {
            id: "employees:salary:approve",
            label: "Approve Salary Revisions",
            description: "Approve salary revisions, promotions, and increments",
          },
          {
            id: "employees:salary:delete",
            label: "Delete Salary Structure",
            description: "Remove compensation configuration records",
          },
        ],
      },
      {
        id: "employees.attendance",
        name: "Attendance, Biometrics & Geo-Fencing",
        actions: [
          {
            id: "employees:attendance:view",
            label: "View Attendance",
            description: "View daily clock-in/out logs and presence statistics",
          },
          {
            id: "employees:attendance:clock",
            label: "Clock In / Clock Out",
            description: "Clock-in or clock-out for daily shift attendance",
          },
          {
            id: "employees:attendance:edit",
            label: "Edit Attendance Logs",
            description: "Manually adjust clock-in and clock-out time entries",
          },
          {
            id: "employees:attendance:regularize",
            label: "Regularize Attendance",
            description: "Approve or submit attendance regularization requests",
          },
          {
            id: "employees:attendance:verify",
            label: "Verify Attendance",
            description: "Approve or verify official attendance records",
          },
          {
            id: "attendance:devices:manage",
            label: "Manage Biometric Devices",
            description: "Configure biometric attendance hardware and API endpoints",
          },
          {
            id: "attendance:devices:sync",
            label: "Sync Biometric Logs",
            description: "Trigger manual or automated synchronization of punch logs",
          },
          {
            id: "attendance:geo:config",
            label: "Configure Geo-Fences",
            description: "Set up GPS office geofence coordinates and radiuses",
          },
          {
            id: "attendance:geo:bypass",
            label: "Bypass Geo-Fencing",
            description: "Authorize remote or client-site check-in outside geofences",
          },
        ],
      },
      {
        id: "employees.organization",
        name: "Departments, Designations & Org Chart",
        actions: [
          {
            id: "employees:departments:manage",
            label: "Manage Departments",
            description: "Create, edit, or delete department units",
          },
          {
            id: "employees:designations:manage",
            label: "Manage Designations",
            description: "Configure job titles and designation bands",
          },
          {
            id: "employees:onboarding:manage",
            label: "Automated Onboarding",
            description: "Run and manage new hire onboarding workflows",
          },
          {
            id: "employees:orgchart:view",
            label: "View Org Chart",
            description: "View interactive organizational hierarchy and reporting lines",
          },
        ],
      },
    ],
  },
  {
    id: "payroll",
    name: "Payroll, Tax & Statutory",
    subModules: [
      {
        id: "payroll.processing",
        name: "Payroll Processing",
        actions: [
          {
            id: "payroll:process:view",
            label: "View Payroll Runs",
            description: "View monthly payroll batches and calculation summaries",
          },
          {
            id: "payroll:process:generate",
            label: "Generate Payroll",
            description: "Calculate gross-to-net payouts for active pay periods",
          },
          {
            id: "payroll:process:run",
            label: "Execute Payouts",
            description: "Execute salary disbursement and payment batches",
          },
          {
            id: "payroll:process:lock",
            label: "Lock Payroll Period",
            description: "Freeze payroll period against adjustments",
          },
          {
            id: "payroll:process:reopen",
            label: "Reopen Payroll Period",
            description: "Unlock closed pay periods for retroactive corrections",
          },
        ],
      },
      {
        id: "payroll.slips",
        name: "Salary Slips",
        actions: [
          {
            id: "payroll:slips:view",
            label: "View Payslips",
            description: "View generated monthly payslips",
          },
          { id: "payroll:slips:download", label: "Download Payslips", description: "Download individual or batch PDF payslips" },
          {
            id: "payroll:slips:email",
            label: "Email Payslips",
            description: "Dispatch payslip PDFs directly to employee registered emails",
          },
        ],
      },
      {
        id: "payroll.statutory",
        name: "Statutory Compliance",
        actions: [
          {
            id: "payroll:statutory:view",
            label: "View Statutory Rules",
            description: "View EPF, ESI, Professional Tax, and LWF rates and rules",
          },
          {
            id: "payroll:statutory:calculate",
            label: "Calculate Statutory Dues",
            description: "Compute employer and employee statutory contributions",
          },
          {
            id: "payroll:statutory:export",
            label: "Export Statutory Returns",
            description: "Export government filing challans and ECR text files",
          },
        ],
      },
      {
        id: "payroll.tax",
        name: "Income Tax Declarations",
        actions: [
          {
            id: "tax:declarations:view",
            label: "View Tax Declarations",
            description: "View employee Section 80C/80D investment declarations",
          },
          {
            id: "tax:declarations:submit",
            label: "Submit Tax Declarations",
            description: "Submit personal tax-saving investment proof declarations",
          },
          {
            id: "tax:declarations:manage",
            label: "Review & Manage Declarations",
            description: "Approve or verify submitted tax deduction proofs",
          },
        ],
      },
    ],
  },
  {
    id: "recruitment",
    name: "Recruitment & Hiring",
    subModules: [
      {
        id: "recruitment.jobs",
        name: "Job Postings",
        actions: [
          {
            id: "recruitment:jobs:view",
            label: "View Jobs",
            description: "View active job requisitions and vacancy openings",
          },
          {
            id: "recruitment:jobs:create",
            label: "Create Job Opening",
            description: "Post new job requisitions with compensation ranges",
          },
          {
            id: "recruitment:jobs:edit",
            label: "Edit Job Opening",
            description: "Update job descriptions, qualifications, and requirements",
          },
          {
            id: "recruitment:jobs:delete",
            label: "Delete Job Opening",
            description: "Archive or remove job requisitions",
          },
        ],
      },
      {
        id: "recruitment.candidates",
        name: "Candidates & Pipeline",
        actions: [
          {
            id: "recruitment:candidates:view",
            label: "View Candidates",
            description: "View applicant profiles and evaluation scorecards",
          },
          {
            id: "recruitment:candidates:add",
            label: "Add Candidate",
            description: "Add candidates manually or via resume parsing",
          },
          {
            id: "recruitment:candidates:movestage",
            label: "Move Pipeline Stage",
            description: "Progress candidates through interview stages",
          },
          {
            id: "recruitment:candidates:reject",
            label: "Reject Candidate",
            description: "Disqualify applicants and send rejection communications",
          },
          {
            id: "recruitment:candidates:hire",
            label: "Hire & Generate Offer",
            description: "Convert candidate to hired employee and generate offer letters",
          },
        ],
      },
    ],
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    subModules: [
      {
        id: "reports.payroll",
        name: "Payroll Reports",
        actions: [
          {
            id: "reports:payroll:view",
            label: "View Payroll Reports",
            description: "View payroll summary, liability, and CTC reports",
          },
          {
            id: "reports:payroll:export_pdf",
            label: "Export PDF Reports",
            description: "Generate formatted PDF report files",
          },
          {
            id: "reports:payroll:export_excel",
            label: "Export Excel Reports",
            description: "Export raw financial and payroll datasets to Excel",
          },
        ],
      },
      {
        id: "reports.attendance",
        name: "Attendance Reports",
        actions: [
          {
            id: "reports:attendance:view",
            label: "View Attendance Reports",
            description: "View attendance, leave, and overtime statistics",
          },
          {
            id: "reports:attendance:export",
            label: "Export Attendance Logs",
            description: "Export daily and monthly attendance audit files",
          },
        ],
      },
    ],
  },
  {
    id: "assets",
    name: "Asset Management",
    subModules: [
      {
        id: "assets.management",
        name: "Company Assets",
        actions: [
          {
            id: "assets:view",
            label: "View Assets",
            description: "View hardware, software licenses, and assigned company assets",
          },
          {
            id: "assets:manage",
            label: "Manage & Assign Assets",
            description: "Create, allocate, transfer, and decommission physical/digital assets",
          },
        ],
      },
    ],
  },
  {
    id: "dpr",
    name: "Daily Progress Reports (DPR)",
    subModules: [
      {
        id: "dpr.reports",
        name: "Daily Progress Reports",
        actions: [
          {
            id: "dpr:view",
            label: "View DPRs",
            description: "View submitted daily work reports and site milestone progress",
          },
          {
            id: "dpr:submit",
            label: "Submit Daily Progress",
            description: "Submit daily progress logs and task updates",
          },
          {
            id: "dpr:approve",
            label: "Approve DPRs",
            description: "Review, approve, or reject employee progress reports",
          },
          {
            id: "dpr:manage",
            label: "Manage DPR Projects",
            description: "Configure DPR templates, project milestones, and assignment rules",
          },
        ],
      },
    ],
  },
  {
    id: "exit",
    name: "Exit & Offboarding",
    subModules: [
      {
        id: "exit.offboarding",
        name: "Resignations & Clearances",
        actions: [
          {
            id: "exit:view",
            label: "View Exit Requests",
            description: "View resignation applications and offboarding status",
          },
          {
            id: "exit:submit",
            label: "Submit Resignation",
            description: "Submit personal resignation notice and reasons",
          },
          {
            id: "exit:approve",
            label: "Approve Resignations",
            description: "Accept or decline employee resignation requests",
          },
          {
            id: "exit:manage",
            label: "Manage Exit Checklists",
            description: "Configure department clearance checklists and exit interviews",
          },
          {
            id: "exit:settle",
            label: "Full & Final Settlement",
            description: "Calculate and execute final financial settlements and gratuity",
          },
        ],
      },
    ],
  },
  {
    id: "expenses",
    name: "Expense Reimbursements",
    subModules: [
      {
        id: "expenses.claims",
        name: "Expense Claims",
        actions: [
          {
            id: "expenses:claims:view",
            label: "View Expense Claims",
            description: "View submitted travel, meal, and operational expense receipts",
          },
          {
            id: "expenses:claims:submit",
            label: "Submit Expense Claim",
            description: "Submit reimbursement claims with attached receipts",
          },
          {
            id: "expenses:claims:approve",
            label: "Approve Expense Claims",
            description: "Managerial and finance review of submitted expense claims",
          },
          {
            id: "expenses:claims:manage",
            label: "Manage Expense Policies",
            description: "Configure reimbursement category limits and approval matrices",
          },
          {
            id: "expenses:claims:pay",
            label: "Disburse Reimbursements",
            description: "Mark approved claims as paid and disburse funds",
          },
        ],
      },
    ],
  },
  {
    id: "settings",
    name: "Settings & Administration",
    subModules: [
      {
        id: "settings.company",
        name: "Company Profile & Office Hours",
        actions: [
          {
            id: "settings:company:view",
            label: "View Company Settings",
            description: "View organization profile, branches, and work policies",
          },
          {
            id: "settings:company:edit",
            label: "Edit Company Settings",
            description: "Update company profile, branding, and timezone parameters",
          },
        ],
      },
      {
        id: "settings.fiscal",
        name: "Fiscal Year Settings",
        actions: [
          {
            id: "settings:fiscal:view",
            label: "View Fiscal Years",
            description: "View active and historic financial year periods",
          },
          {
            id: "settings:fiscal:manage",
            label: "Manage Fiscal Years",
            description: "Configure and lock financial year cycles and book closing dates",
          },
        ],
      },
      {
        id: "settings.integrations",
        name: "Platform Integrations",
        actions: [
          {
            id: "integrations:view",
            label: "View Integrations",
            description: "View connected third-party platforms, webhooks, and API keys",
          },
          {
            id: "integrations:manage",
            label: "Manage Integrations",
            description: "Configure API credentials, webhook endpoints, and OAuth connections",
          },
        ],
      },
      {
        id: "settings.roles",
        name: "Roles & Access Governance",
        actions: [
          {
            id: "settings:roles:view",
            label: "View Roles (Admin Governance)",
            description: "View system and custom role permission matrices",
          },
          {
            id: "settings:roles:edit",
            label: "Edit Roles (Admin Governance)",
            description: "Create, modify, and assign fine-grained RBAC permissions",
          },
        ],
      },
      {
        id: "settings.audit",
        name: "Audit Logs",
        actions: [
          {
            id: "system:audit:view",
            label: "View Audit Logs",
            description: "Inspect immutable system security and action logs",
          },
          {
            id: "system:audit:delete",
            label: "Purge Audit Logs",
            description: "Purge historic audit logs (Restricted to SuperAdmin)",
          },
        ],
      },
    ],
  },
];
