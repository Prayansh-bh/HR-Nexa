import { PrismaClient } from '@prisma/client';
import { Role } from '../src/modules/auth/role.enum';
import { Permission } from '../src/modules/auth/permissions.enum';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding HRMS database...');

  // 1. Clear database (order respects FK constraints)
  await (prisma as any).planAuditLog.deleteMany({});
  await (prisma as any).companyPlanAssignment.deleteMany({});
  await (prisma as any).addOn.deleteMany({});
  await (prisma as any).planFeatureConfig.deleteMany({});
  await (prisma as any).planVersion.deleteMany({});
  await (prisma as any).saaSPlanNew.deleteMany({});
  await (prisma as any).featureDependency.deleteMany({});
  await (prisma as any).feature.deleteMany({});
  await (prisma as any).featureCategory.deleteMany({});
  await (prisma as any).coupon.deleteMany({});
  await (prisma as any).subscriptionEvent.deleteMany({});
  await (prisma as any).systemNotification.deleteMany({});
  await (prisma as any).candidate.deleteMany({});
  await (prisma as any).jobRequisition.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.leaveQuota.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.user.deleteMany({});
  await (prisma as any).role.deleteMany({});
  await prisma.designation.deleteMany({});
  await prisma.department.deleteMany({});
  await (prisma as any).company.deleteMany({});
  await prisma.leaveType.deleteMany({});
  await prisma.biometricDevice.deleteMany({});
  await prisma.geoZone.deleteMany({});
  await prisma.calendarEvent.deleteMany({});

  // 2. Hash Password (same password for all demo accounts: demo1234)
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('demo1234', salt);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Create Company and Subscription for Acme Corp FIRST (needed for subscriptionId FK)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding company (Acme Corp)...');
  const acmeCompany = await prisma.company.create({
    data: {
      id: 'C1',
      name: 'Acme Corp',
      isDemo: true,
    },
  });

  console.log('Seeding subscription (Acme Corp)...');
  const acmeSub = await prisma.subscription.create({
    data: {
      id: 'C1',
      company: 'Acme Corp',
      plan: 'PREMIUM',
      cycle: 'Annual',
      start: '2024-01-15',
      expiry: '2027-01-15',
      amount: 180000,
      status: 'Active',
      gst: '27AADCB2230M1Z2',
      pan: 'AADCB2230M',
      cin: 'L12345MH2000PLC123456',
      address: '123 Business Park, Mumbai',
      contact: 'Rajesh Kumar',
      hrAdmin: 'Priya Menon',
      ownerName: 'Rajesh Kumar',
      ownerEmail: 'hr@demo.co',
      billing: 'Credit Card (ending 4242)',
      storageUsed: '45 GB / 100 GB',
      employeesCount: 5,
      purchasedSeats: 50,
      usedSeats: 5,
      logo: 'AC',
      companyId: acmeCompany.id,
    } as any,
  });

  // Default permissions matrix for role seeding
  const defaultRolePermissions: Record<string, string[]> = {
    SuperAdmin: Object.values(Permission),
    HRAdmin: [
      Permission.EMPLOYEES_LIST_VIEW, Permission.EMPLOYEES_LIST_CREATE, Permission.EMPLOYEES_LIST_EDIT, Permission.EMPLOYEES_LIST_DELETE, Permission.EMPLOYEES_LIST_EXPORT, Permission.EMPLOYEES_LIST_IMPORT,
      Permission.EMPLOYEES_PROFILE_VIEW, Permission.EMPLOYEES_PROFILE_EDIT, Permission.EMPLOYEES_PROFILE_DOCS_UPLOAD, Permission.EMPLOYEES_PROFILE_DOCS_DOWNLOAD, Permission.EMPLOYEES_PROFILE_DOCS_DELETE,
      Permission.EMPLOYEES_SALARY_VIEW, Permission.EMPLOYEES_SALARY_EDIT, Permission.EMPLOYEES_SALARY_APPROVE,
      Permission.EMPLOYEES_ATTENDANCE_VIEW, Permission.EMPLOYEES_ATTENDANCE_CLOCK, Permission.EMPLOYEES_ATTENDANCE_EDIT, Permission.EMPLOYEES_ATTENDANCE_REGULARIZE, Permission.EMPLOYEES_ATTENDANCE_VERIFY,
      Permission.EMPLOYEES_DEPARTMENTS_MANAGE, Permission.EMPLOYEES_DESIGNATIONS_MANAGE, Permission.EMPLOYEES_ONBOARDING_MANAGE, Permission.EMPLOYEES_ORGCHART_VIEW,
      Permission.PAYROLL_PROCESS_VIEW, Permission.PAYROLL_PROCESS_GENERATE, Permission.PAYROLL_PROCESS_RUN, Permission.PAYROLL_PROCESS_LOCK,
      Permission.PAYROLL_SLIPS_VIEW, Permission.PAYROLL_SLIPS_DOWNLOAD, Permission.PAYROLL_SLIPS_EMAIL,
      Permission.RECRUITMENT_JOBS_VIEW, Permission.RECRUITMENT_JOBS_CREATE, Permission.RECRUITMENT_JOBS_EDIT, Permission.RECRUITMENT_JOBS_DELETE,
      Permission.RECRUITMENT_CANDIDATES_VIEW, Permission.RECRUITMENT_CANDIDATES_ADD, Permission.RECRUITMENT_CANDIDATES_MOVESTAGE, Permission.RECRUITMENT_CANDIDATES_REJECT, Permission.RECRUITMENT_CANDIDATES_HIRE,
      Permission.REPORTS_PAYROLL_VIEW, Permission.REPORTS_PAYROLL_EXPORT_PDF, Permission.REPORTS_PAYROLL_EXPORT_EXCEL,
      Permission.REPORTS_ATTENDANCE_VIEW, Permission.REPORTS_ATTENDANCE_EXPORT,
      Permission.SETTINGS_COMPANY_VIEW, Permission.SETTINGS_ROLES_VIEW, Permission.SYSTEM_AUDIT_VIEW, Permission.CHATBOX_ACCESS,
      Permission.EMPLOYEES_READ, Permission.EMPLOYEES_CREATE, Permission.EMPLOYEES_UPDATE, Permission.EMPLOYEES_DELETE,
      Permission.DEPARTMENTS_MANAGE, Permission.DEPARTMENTS_READ, Permission.ATTENDANCE_READ, Permission.ATTENDANCE_VERIFY,
      Permission.LEAVES_READ, Permission.LEAVES_APPROVE, Permission.DOCUMENTS_READ, Permission.DOCUMENTS_WRITE, Permission.DOCUMENTS_DELETE,
      Permission.SYSTEM_ANNOUNCEMENT_CREATE, Permission.SYSTEM_AUDIT_LOG_READ,
      Permission.LEAVES_VIEW, Permission.LEAVES_REQUESTS_CREATE, Permission.LEAVES_REQUESTS_EDIT, Permission.LEAVES_REQUESTS_APPROVE, Permission.LEAVES_REQUESTS_DELETE,
      Permission.DOCUMENTS_VERIFY, Permission.LEAVES_POLICY_MANAGE, Permission.PERFORMANCE_REVIEWS_VIEW, Permission.PERFORMANCE_CYCLES_MANAGE,
      Permission.SUPPORT_TICKETS_VIEW, Permission.SUPPORT_TICKETS_CREATE, Permission.SUPPORT_TICKETS_MESSAGE, Permission.SUPPORT_TICKETS_STATUS, Permission.SUPPORT_TICKETS_RESOLVE, Permission.SUPPORT_TICKETS_CLOSE, Permission.SUPPORT_TICKETS_DELETE,
      Permission.DPR_VIEW, Permission.DPR_SUBMIT, Permission.DPR_APPROVE, Permission.DPR_MANAGE,
    ],
    Manager: [
      Permission.EMPLOYEES_LIST_VIEW, Permission.EMPLOYEES_PROFILE_VIEW,
      Permission.EMPLOYEES_ATTENDANCE_VIEW, Permission.EMPLOYEES_ATTENDANCE_CLOCK, Permission.EMPLOYEES_ATTENDANCE_REGULARIZE, Permission.EMPLOYEES_ATTENDANCE_VERIFY,
      Permission.EMPLOYEES_ORGCHART_VIEW,
      Permission.RECRUITMENT_JOBS_VIEW, Permission.RECRUITMENT_CANDIDATES_VIEW,
      Permission.REPORTS_ATTENDANCE_VIEW, Permission.CHATBOX_ACCESS,
      Permission.EMPLOYEES_READ, Permission.DEPARTMENTS_READ, Permission.ATTENDANCE_READ, Permission.ATTENDANCE_VERIFY, Permission.LEAVES_READ, Permission.LEAVES_APPROVE,
      Permission.LEAVES_VIEW, Permission.LEAVES_REQUESTS_APPROVE,
      Permission.PERFORMANCE_REVIEWS_VIEW,
      Permission.SUPPORT_TICKETS_VIEW, Permission.SUPPORT_TICKETS_CREATE, Permission.SUPPORT_TICKETS_MESSAGE,
      Permission.DPR_VIEW, Permission.DPR_SUBMIT, Permission.DPR_APPROVE,
    ],
    Accountant: [
      Permission.EMPLOYEES_LIST_VIEW, Permission.EMPLOYEES_SALARY_VIEW, Permission.EMPLOYEES_SALARY_EDIT, Permission.EMPLOYEES_SALARY_APPROVE,
      Permission.PAYROLL_PROCESS_VIEW, Permission.PAYROLL_PROCESS_GENERATE, Permission.PAYROLL_PROCESS_RUN, Permission.PAYROLL_PROCESS_LOCK, Permission.PAYROLL_PROCESS_REOPEN,
      Permission.PAYROLL_SLIPS_VIEW, Permission.PAYROLL_SLIPS_DOWNLOAD, Permission.PAYROLL_SLIPS_EMAIL,
      Permission.REPORTS_PAYROLL_VIEW, Permission.REPORTS_PAYROLL_EXPORT_PDF, Permission.REPORTS_PAYROLL_EXPORT_EXCEL,
      Permission.CHATBOX_ACCESS,
      Permission.EMPLOYEES_READ, Permission.PAYROLL_READ, Permission.PAYROLL_PROCESS, Permission.ATTENDANCE_READ, Permission.LEAVES_READ,
    ],
    Recruiter: [
      Permission.EMPLOYEES_LIST_VIEW, Permission.EMPLOYEES_LIST_CREATE, Permission.EMPLOYEES_ORGCHART_VIEW,
      Permission.RECRUITMENT_JOBS_VIEW, Permission.RECRUITMENT_JOBS_CREATE, Permission.RECRUITMENT_JOBS_EDIT,
      Permission.RECRUITMENT_CANDIDATES_VIEW, Permission.RECRUITMENT_CANDIDATES_ADD, Permission.RECRUITMENT_CANDIDATES_MOVESTAGE, Permission.RECRUITMENT_CANDIDATES_HIRE,
      Permission.CHATBOX_ACCESS,
      Permission.EMPLOYEES_READ, Permission.EMPLOYEES_CREATE, Permission.DEPARTMENTS_READ,
    ],
    Employee: [
      Permission.EMPLOYEES_PROFILE_VIEW, Permission.EMPLOYEES_PROFILE_DOCS_DOWNLOAD,
      Permission.EMPLOYEES_ATTENDANCE_VIEW, Permission.EMPLOYEES_ATTENDANCE_CLOCK, Permission.PAYROLL_SLIPS_VIEW, Permission.CHATBOX_ACCESS,
      Permission.ATTENDANCE_CLOCK, Permission.LEAVES_CREATE, Permission.DOCUMENTS_READ,
      Permission.LEAVES_VIEW, Permission.LEAVES_REQUESTS_CREATE,
      Permission.PERFORMANCE_REVIEWS_VIEW,
      Permission.SUPPORT_TICKETS_VIEW, Permission.SUPPORT_TICKETS_CREATE, Permission.SUPPORT_TICKETS_MESSAGE,
      Permission.EXPENSES_VIEW, Permission.EXPENSES_SUBMIT,
      Permission.TAX_DECLARATIONS_VIEW, Permission.TAX_DECLARATIONS_SUBMIT,
      Permission.DPR_VIEW, Permission.DPR_SUBMIT,
    ],
    Viewer: [
      Permission.EMPLOYEES_LIST_VIEW, Permission.EMPLOYEES_PROFILE_VIEW, Permission.EMPLOYEES_ORGCHART_VIEW,
      Permission.REPORTS_PAYROLL_VIEW, Permission.REPORTS_ATTENDANCE_VIEW,
      Permission.EMPLOYEES_READ,
    ],
    'HR Staff': [
      Permission.EMPLOYEES_LIST_VIEW, Permission.EMPLOYEES_PROFILE_VIEW, Permission.EMPLOYEES_ORGCHART_VIEW,
      Permission.REPORTS_PAYROLL_VIEW, Permission.REPORTS_ATTENDANCE_VIEW,
      Permission.EMPLOYEES_READ,
    ]
  };

  // Seed dynamic roles
  console.log('Seeding dynamic roles...');
  const rolesMap: Record<string, any> = {};

  // Global SuperAdmin role
  rolesMap['SuperAdmin'] = await prisma.role.create({
    data: {
      name: 'SuperAdmin',
      description: 'Platform Super Admin with root bypass permissions',
      isSystem: true,
      permissions: JSON.stringify(defaultRolePermissions['SuperAdmin']),
      companyId: null,
    },
  });

  // Company scoped roles
  const companyRoles = ['HRAdmin', 'Manager', 'Accountant', 'Employee', 'Viewer', 'Recruiter', 'HR Staff'];
  for (const roleName of companyRoles) {
    rolesMap[roleName] = await prisma.role.create({
      data: {
        name: roleName,
        description: `${roleName} default system role`,
        isSystem: true,
        permissions: JSON.stringify(defaultRolePermissions[roleName] || []),
        companyId: acmeCompany.id,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Create the ONLY SuperAdmin user (no Employee record — platform admin)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding SuperAdmin user (no employee record)...');
  await prisma.user.create({
    data: {
      email: 'admin@demo.co',
      password: hashedPassword,
      name: 'Deepak Bhagat',
      role: 'SuperAdmin',
      roleId: rolesMap['SuperAdmin'].id,
      permissionVersion: 1,
      initials: 'DB',
      subscriptionId: null, // SuperAdmin is NOT scoped to any company
      companyId: null,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Seed Departments (scoped to Acme Corp subscription)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding departments...');
  const depts = [
    { name: 'Engineering', head: 'Aarav Sharma', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
    { name: 'Design', head: 'Priya Menon', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
    { name: 'Sales', head: 'Rahul Kapoor', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
    { name: 'HR', head: 'Priya Menon', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
    { name: 'Finance', head: 'Maya Patel', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
  ];
  for (const d of depts) {
    await prisma.department.create({ data: d });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Seed Designations (scoped to Acme Corp subscription)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding designations...');
  const desigs = [
    { name: 'Sr. Engineer', band: 'L3', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
    { name: 'Product Designer', band: 'L2', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
    { name: 'Account Executive', band: 'L2', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
    { name: 'HR Manager', band: 'L3', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
    { name: 'Frontend Dev', band: 'L1', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
    { name: 'Analyst', band: 'L1', subscriptionId: acmeSub.id, companyId: acmeCompany.id },
  ];
  for (const ds of desigs) {
    await prisma.designation.create({ data: ds });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Seed Employees for Acme Corp (EMP001–EMP006, NO EMP004 SuperAdmin)
  //    SuperAdmin (Deepak Bhagat / admin@demo.co) has NO Employee record.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding users and employees...');

  // Fetch seeded departments and designations for ID lookup
  const deptRecords = await prisma.department.findMany({ where: { subscriptionId: acmeSub.id } });
  const desigRecords = await prisma.designation.findMany({ where: { subscriptionId: acmeSub.id } });
  const deptMap: Record<string, string> = {};
  const desigMap: Record<string, string> = {};
  for (const d of deptRecords) deptMap[d.name] = d.id;
  for (const d of desigRecords) desigMap[d.name] = d.id;

  // Employee data — EMP004 (Deepak Bhagat) REMOVED — SuperAdmin is not an employee
  const employeesData = [
    {
      id: 'EMP001',
      name: 'Aarav Sharma',
      email: 'aarav@acme.co',
      status: 'Active',
      joined: '2022-03-14',
      salary: 92000,
      avatar: 'AS',
      phone: '+91 98100 12345',
      address: 'Bengaluru, IN',
      dob: '1994-05-12',
      gender: 'Male',
      uan: '100987654321',
      esic: '1112345678',
      pan: 'AAAAA1111A',
      aadhaar: '1234 5678 9012',
      location: 'Bengaluru Office',
      maritalStatus: 'Single',
      bloodGroup: 'O+',
      role: Role.Manager,
      initials: 'AS',
      deptName: 'Engineering',
      desigName: 'Sr. Engineer',
    },
    {
      id: 'EMP002',
      name: 'Priya Menon',
      email: 'priya@acme.co',
      status: 'Active',
      joined: '2023-01-09',
      salary: 78000,
      avatar: 'PM',
      phone: '+91 98100 22345',
      address: 'Kochi, IN',
      dob: '1996-08-25',
      gender: 'Female',
      uan: '100987654322',
      esic: '1112345679',
      pan: 'BBBBB2222B',
      aadhaar: '2345 6789 0123',
      location: 'Remote',
      maritalStatus: 'Single',
      bloodGroup: 'A+',
      role: Role.HRAdmin,
      initials: 'PM',
      deptName: 'HR',
      desigName: 'HR Manager',
    },
    {
      id: 'EMP003',
      name: 'Rahul Kapoor',
      email: 'rahul@acme.co',
      status: 'On Leave',
      joined: '2021-08-22',
      salary: 65000,
      avatar: 'RK',
      phone: '+91 98100 32345',
      address: 'Mumbai, IN',
      dob: '1992-12-05',
      gender: 'Male',
      uan: '100987654323',
      esic: '1112345680',
      pan: 'CCCCC3333C',
      aadhaar: '3456 7890 1234',
      location: 'Mumbai Office',
      maritalStatus: 'Married',
      bloodGroup: 'B+',
      role: Role.Viewer,
      initials: 'RK',
      deptName: 'Sales',
      desigName: 'Account Executive',
    },
    {
      id: 'EMP004',
      name: 'Devon Chen',
      email: 'devon@acme.co',
      status: 'Active',
      joined: '2024-02-15',
      salary: 72000,
      avatar: 'DC',
      phone: '+91 98100 52345',
      address: 'Hyderabad, IN',
      dob: '1998-09-30',
      gender: 'Male',
      uan: '100987654325',
      esic: '1112345682',
      pan: 'EEEEE5555E',
      aadhaar: '5678 9012 3456',
      location: 'Remote',
      maritalStatus: 'Single',
      bloodGroup: 'AB+',
      role: Role.Employee,
      initials: 'DC',
      deptName: 'Engineering',
      desigName: 'Frontend Dev',
    },
    {
      id: 'EMP005',
      name: 'Maya Patel',
      email: 'maya@acme.co',
      status: 'Inactive',
      joined: '2019-06-01',
      salary: 60000,
      avatar: 'MP',
      phone: '+91 98100 62345',
      address: 'Ahmedabad, IN',
      dob: '1995-10-10',
      gender: 'Female',
      uan: '100987654326',
      esic: '1112345683',
      pan: 'FFFFF6666F',
      aadhaar: '6789 0123 4567',
      location: 'Ahmedabad Office',
      maritalStatus: 'Single',
      bloodGroup: 'B-',
      role: Role.Accountant,
      initials: 'MP',
      deptName: 'Finance',
      desigName: 'Analyst',
    },
  ];

  // Demo login email aliases (so login works with demo credentials)
  const emailAliasMap: Record<string, string> = {
    'Priya Menon':   'hr@demo.co',
    'Aarav Sharma':  'manager@demo.co',
    'Maya Patel':    'accountant@demo.co',
    'Devon Chen':    'employee@demo.co',
    'Rahul Kapoor':  'viewer@demo.co',
  };

  for (const emp of employeesData) {
    const loginEmail = emailAliasMap[emp.name] || emp.email;
    const { role, initials, deptName, desigName, ...empRest } = emp;

    const assignedRole = rolesMap[role] || rolesMap['Employee'];

    const user = await prisma.user.create({
      data: {
        email: loginEmail,
        password: hashedPassword,
        name: emp.name,
        role,
        roleId: assignedRole.id,
        permissionVersion: 1,
        initials,
        subscriptionId: acmeSub.id,
        companyId: acmeCompany.id,
      },
    });

    const departmentId = deptName ? (deptMap[deptName] ?? null) : null;
    const designationId = desigName ? (desigMap[desigName] ?? null) : null;

    await prisma.employee.create({
      data: {
        ...empRest,
        email: loginEmail,
        userId: user.id,
        departmentId,
        designationId,
        subscriptionId: acmeSub.id,
        companyId: acmeCompany.id,
      },
    });

    // Seed Leave Quotas
    await prisma.leaveQuota.createMany({
      data: [
        { employeeId: emp.id, leaveType: 'Annual', totalDays: 18, usedDays: 2 },
        { employeeId: emp.id, leaveType: 'Sick', totalDays: 10, usedDays: 1 },
        { employeeId: emp.id, leaveType: 'Casual', totalDays: 8, usedDays: 0 },
        { employeeId: emp.id, leaveType: 'Maternity/Paternity', totalDays: 30, usedDays: 0 },
      ],
    });
  }

  // Set manager relationship: Devon Chen (EMP004) reports to Aarav Sharma (EMP001)
  console.log('Seeding manager reporting hierarchy...');
  await prisma.employee.update({
    where: { id: 'EMP004' },
    data: { managerId: 'EMP001' },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Seed Leave Requests
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding leave requests...');
  const leaveRequests = [
    {
      employeeId: 'EMP003',
      type: 'Annual',
      from: '2026-07-20',
      to: '2026-07-24',
      days: 5,
      reason: 'Family trip to Goa',
      status: 'APPROVED' as any,
      department: 'Sales',
    },
    {
      employeeId: 'EMP004',
      type: 'Sick',
      from: '2026-07-21',
      to: '2026-07-22',
      days: 2,
      reason: 'Fever and cold',
      status: 'PENDING' as any,
      department: 'Engineering',
    },
    {
      employeeId: 'EMP001',
      type: 'Casual',
      from: '2026-07-28',
      to: '2026-07-28',
      days: 1,
      reason: 'Personal urgent work',
      status: 'PENDING' as any,
      department: 'Engineering',
    },
  ];
  for (const lr of leaveRequests) {
    await prisma.leaveRequest.create({
      data: {
        ...lr,
        companyId: acmeCompany.id,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Seed Announcements (scoped to Acme Corp)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding announcements...');
  const announcements = [
    {
      title: 'Corporate Restructuring Updates',
      content: 'FY 2026 internal structural alignments and division changes.',
      date: '2026-07-15',
      author: 'Priya Menon',
      readCount: 38,
      subscriptionId: acmeSub.id,
    },
    {
      title: 'Townhall Meeting Schedule',
      content: 'Join us for the monthly townhall on July 25th at 4:00 PM IST.',
      date: '2026-07-20',
      author: 'Priya Menon',
      readCount: 12,
      subscriptionId: acmeSub.id,
    },
  ];
  for (const ann of announcements) {
    await prisma.announcement.create({ data: ann });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Seed Attendance Logs
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding attendance...');
  const attendanceLogs: any[] = [];
  const today = new Date('2026-07-30T12:00:00Z'); // anchor today to 2026-07-30 to match current context date
  const employeeIds = ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005'];

  for (let i = 84; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const dayOfWeek = d.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

    const dateStr = d.toISOString().slice(0, 10);

    for (const empId of employeeIds) {
      const rand = Math.random();
      let status = 'Present';
      let inTime: string | null = '09:00';
      let outTime: string | null = '18:00';
      let remarks: string | null = 'Ontime clock-in';

      if (empId === 'EMP003' && i <= 7) {
        status = 'On Leave';
        inTime = null;
        outTime = null;
        remarks = 'Approved annual leave';
      } else if (rand < 0.85) {
        status = 'Present';
        const minutes = Math.floor(Math.random() * 30) - 15;
        const hr = minutes < 0 ? 8 : 9;
        const min = minutes < 0 ? 60 + minutes : minutes;
        inTime = `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        outTime = '18:00';
      } else if (rand < 0.92) {
        status = 'Late';
        const min = Math.floor(Math.random() * 25) + 16;
        inTime = `09:${String(min).padStart(2, '0')}`;
        outTime = '18:00';
        remarks = 'Late check-in';
      } else if (rand < 0.96) {
        status = 'Half Day';
        inTime = '09:00';
        outTime = '13:00';
        remarks = 'Half day';
      } else {
        status = 'Absent';
        inTime = null;
        outTime = null;
        remarks = 'Absent without notice';
      }

      attendanceLogs.push({
        employeeId: empId,
        date: dateStr,
        inTime,
        outTime,
        status,
        remarks,
        verified: true,
      });
    }
  }

  for (const att of attendanceLogs) {
    await prisma.attendance.create({ data: att });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Seed Payroll Slips
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding payroll...');
  const payrolls = [
    { employeeId: 'EMP001', month: 'June 2026', payDate: '2026-06-30', basicSalary: 92000 * 0.5, allowances: 92000 * 0.3, deductions: 92000 * 0.1, netSalary: 92000 * 0.7, status: 'PAID' as any, companyId: acmeCompany.id },
    { employeeId: 'EMP002', month: 'June 2026', payDate: '2026-06-30', basicSalary: 78000 * 0.5, allowances: 78000 * 0.3, deductions: 78000 * 0.1, netSalary: 78000 * 0.7, status: 'PAID' as any, companyId: acmeCompany.id },
  ];
  for (const pay of payrolls) {
    await prisma.payroll.create({ data: pay });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Audit Logs — with companyId
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding audit logs...');
  const superAdminUser = await prisma.user.findFirst({ where: { role: 'SuperAdmin' } });
  await prisma.auditLog.create({
    data: {
      actorId: superAdminUser?.id || 'system',
      actorRole: 'SuperAdmin',
      companyId: 'PLATFORM',
      action: 'SETTINGS_UPDATED',
      entityType: 'COMPANY_SETTINGS',
      userName: 'Deepak Bhagat',
      details: JSON.stringify({
        summary: 'Initialized the core database schema and seeded default entities.',
        ip: '127.0.0.1',
        browser: 'System',
      }),
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 13. Invoices & Subscription Events
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding invoices...');
  await prisma.invoice.createMany({
    data: [
      {
        id: 'INV-2026-001',
        type: 'Invoice',
        company: 'Acme Corp',
        date: new Date().toISOString().slice(0, 10),
        amount: 180000,
        status: 'Paid',
      },
    ],
  });

  await (prisma as any).subscriptionEvent.createMany({
    data: [
      {
        subscriptionId: acmeSub.id,
        event: 'Created',
        toPlan: 'PREMIUM',
        toStatus: 'Active',
        performedBy: 'Super Admin',
        note: 'Initial subscription setup for Acme Corp',
      },
      {
        subscriptionId: acmeSub.id,
        event: 'Activated',
        toPlan: 'PREMIUM',
        toStatus: 'Active',
        performedBy: 'Super Admin',
        note: 'Payment verified and subscription activated',
      },
    ],
  });

  await (prisma as any).coupon.createMany({
    data: [
      {
        code: 'WELCOME20',
        description: '20% off for new onboarded companies',
        discountType: 'percent',
        discountValue: 20,
        maxUses: 100,
        usedCount: 1,
        validFrom: '2025-01-01',
        validUntil: '2027-12-31',
        active: true,
      },
      {
        code: 'ANNUAL5000',
        description: 'Flat ₹5,000 off on Annual Premium plan',
        discountType: 'flat',
        discountValue: 5000,
        maxUses: 50,
        usedCount: 0,
        validFrom: '2025-01-01',
        validUntil: '2027-12-31',
        active: true,
      },
    ],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 14. Feature Categories & Feature Library
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Seeding Feature Categories & Features...');
  const catCore = await (prisma as any).featureCategory.create({
    data: { name: 'Core HR', description: 'Employee management, departments, documents', order: 1 },
  });
  const catAtt = await (prisma as any).featureCategory.create({
    data: { name: 'Attendance & Time', description: 'Clock in, geo-fencing, shifts, biometrics', order: 2 },
  });
  const catPay = await (prisma as any).featureCategory.create({
    data: { name: 'Payroll & Compensation', description: 'Salary processing, tax, slip generation', order: 3 },
  });
  const catAdv = await (prisma as any).featureCategory.create({
    data: { name: 'Enterprise & Security', description: 'Audit logs, multi-branch, SSO, API access', order: 4 },
  });

  const featEmp = await (prisma as any).feature.create({
    data: { key: 'CORE_EMPLOYEE', name: 'Employee Directory & Profiles', categoryId: catCore.id, module: 'CORE', icon: 'Users', status: 'Active' },
  });
  const featDoc = await (prisma as any).feature.create({
    data: { key: 'CORE_DOCUMENTS', name: 'Document Management', categoryId: catCore.id, module: 'CORE', icon: 'FileText', status: 'Active' },
  });
  const featAttBase = await (prisma as any).feature.create({
    data: { key: 'ATT_BASIC', name: 'Basic Attendance & Leave', categoryId: catAtt.id, module: 'ATTENDANCE', icon: 'Clock', status: 'Active' },
  });
  const featAttGeo = await (prisma as any).feature.create({
    data: { key: 'ATT_GEO', name: 'Geo-Fencing & Mobile Clock-in', categoryId: catAtt.id, module: 'ATTENDANCE', icon: 'MapPin', status: 'Active' },
  });
  const featAttBio = await (prisma as any).feature.create({
    data: { key: 'ATT_BIOMETRIC', name: 'Biometric Device Integration', categoryId: catAtt.id, module: 'ATTENDANCE', icon: 'Fingerprint', status: 'Active' },
  });
  const featPayBase = await (prisma as any).feature.create({
    data: { key: 'PAY_BASIC', name: 'Payroll & Payslips', categoryId: catPay.id, module: 'PAYROLL', icon: 'DollarSign', status: 'Active' },
  });
  const featPayTax = await (prisma as any).feature.create({
    data: { key: 'PAY_STATUTORY', name: 'PF, ESI & TDS Statutory Tax Compliance', categoryId: catPay.id, module: 'PAYROLL', icon: 'ShieldCheck', status: 'Active' },
  });
  const featAudit = await (prisma as any).feature.create({
    data: { key: 'ADV_AUDIT', name: 'Immutable Audit Logging', categoryId: catAdv.id, module: 'ENTERPRISE', icon: 'History', status: 'Active' },
  });
  const featApi = await (prisma as any).feature.create({
    data: { key: 'ADV_API', name: 'REST API & Webhooks Access', categoryId: catAdv.id, module: 'ENTERPRISE', icon: 'Code', status: 'Active' },
  });
  const featRoleMgmt = await (prisma as any).feature.create({
    data: { key: 'ROLE_MANAGEMENT', name: 'Role & Permission Management', categoryId: catAdv.id, module: 'CORE', icon: 'ShieldAlert', status: 'Active' },
  });

  // Feature Dependencies
  await (prisma as any).featureDependency.create({ data: { featureId: featPayBase.id, requiredFeatureId: featEmp.id } });
  await (prisma as any).featureDependency.create({ data: { featureId: featAttGeo.id, requiredFeatureId: featAttBase.id } });

  // Plans & Versions
  console.log('Seeding SaaS Plans & Versions...');
  const planBasic = await (prisma as any).saaSPlanNew.create({
    data: { name: 'BASIC', code: 'PLAN_BASIC', status: 'Published', currentVersion: 1, isDefault: true },
  });
  const planStd = await (prisma as any).saaSPlanNew.create({
    data: { name: 'STANDARD', code: 'PLAN_STD', status: 'Published', currentVersion: 1 },
  });
  const planPrem = await (prisma as any).saaSPlanNew.create({
    data: { name: 'PREMIUM', code: 'PLAN_PREM', status: 'Published', currentVersion: 1 },
  });

  const vBasic = await (prisma as any).planVersion.create({
    data: {
      planId: planBasic.id, version: 1, status: 'Published',
      monthlyPrice: 0, yearlyPrice: 0, employeeLimit: 10, storageLimitGB: 10, branchLimit: 1, apiCallLimit: 0,
      changelog: 'Initial v1 release of Basic Plan',
    },
  });
  const vStd = await (prisma as any).planVersion.create({
    data: {
      planId: planStd.id, version: 1, status: 'Published',
      monthlyPrice: 5000, yearlyPrice: 60000, employeeLimit: 100, storageLimitGB: 50, branchLimit: 3, apiCallLimit: 5000,
      changelog: 'Initial v1 release of Standard Plan',
    },
  });
  const vPrem = await (prisma as any).planVersion.create({
    data: {
      planId: planPrem.id, version: 1, status: 'Published',
      monthlyPrice: 15000, yearlyPrice: 180000, employeeLimit: 500, storageLimitGB: 100, branchLimit: 10, apiCallLimit: 50000,
      changelog: 'Initial v1 release of Premium Plan',
    },
  });

  await (prisma as any).planFeatureConfig.createMany({
    data: [
      { planVersionId: vBasic.id, featureId: featEmp.id, enabled: true },
      { planVersionId: vBasic.id, featureId: featDoc.id, enabled: true },
      { planVersionId: vBasic.id, featureId: featAttBase.id, enabled: true },
      { planVersionId: vBasic.id, featureId: featPayBase.id, enabled: true },
      { planVersionId: vStd.id, featureId: featEmp.id, enabled: true },
      { planVersionId: vStd.id, featureId: featDoc.id, enabled: true },
      { planVersionId: vStd.id, featureId: featAttBase.id, enabled: true },
      { planVersionId: vStd.id, featureId: featAttGeo.id, enabled: true },
      { planVersionId: vStd.id, featureId: featAttBio.id, enabled: true },
      { planVersionId: vStd.id, featureId: featPayBase.id, enabled: true },
      { planVersionId: vStd.id, featureId: featPayTax.id, enabled: true },
      { planVersionId: vStd.id, featureId: featRoleMgmt.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featEmp.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featDoc.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featAttBase.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featAttGeo.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featAttBio.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featPayBase.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featPayTax.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featAudit.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featApi.id, enabled: true },
      { planVersionId: vPrem.id, featureId: featRoleMgmt.id, enabled: true },
    ],
  });

  await (prisma as any).companyPlanAssignment.create({
    data: {
      company: 'Acme Corp',
      planVersionId: vPrem.id,
      assignedBy: 'Super Admin',
      effectiveDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 15. Add-ons & Plan Audit Logs
  // ─────────────────────────────────────────────────────────────────────────
  await (prisma as any).addOn.createMany({
    data: [
      { name: 'Extra 50 Employee Seats', code: 'ADD_SEATS_50', description: 'Add 50 employee seat capacity to your plan', price: 2000, billingCycle: 'Monthly', unit: 'Seats', maxLimit: 10, active: true },
      { name: 'Extra 50GB Cloud Storage', code: 'ADD_STORAGE_50', description: 'Additional 50GB storage for employee documents', price: 1000, billingCycle: 'Monthly', unit: 'GB', maxLimit: 5, active: true },
      { name: 'AI Assistant Pack (10k Credits)', code: 'ADD_AI_10K', description: '10,000 AI credits for automated resume screening and HR assistance', price: 1500, billingCycle: 'OneTime', unit: 'Credits', maxLimit: 20, active: true },
    ],
  });

  await (prisma as any).planAuditLog.createMany({
    data: [
      { planName: 'PREMIUM', action: 'Published', performedBy: 'Super Admin', details: 'Published Premium Plan v1 with all Enterprise features enabled.' },
      { planName: 'STANDARD', action: 'Published', performedBy: 'Super Admin', details: 'Published Standard Plan v1 with Geo Attendance & Statutory Tax.' },
      { planName: 'BASIC', action: 'Published', performedBy: 'Super Admin', details: 'Published Basic Free Plan v1.' },
    ],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 16. Leave Types, Devices, Geo Zones, Calendar Events
  // ─────────────────────────────────────────────────────────────────────────
  await prisma.leaveType.createMany({
    data: [
      { name: 'Annual', days: 18, tone: 'blue' },
      { name: 'Sick', days: 10, tone: 'red' },
      { name: 'Casual', days: 8, tone: 'green' },
      { name: 'Maternity/Paternity', days: 30, tone: 'purple' },
    ],
  });

  await prisma.biometricDevice.createMany({
    data: [
      { name: 'Main Entrance Biometric', ip: '192.168.1.100', status: 'Online', last: 'Just now' },
      { name: 'Server Room Access Control', ip: '192.168.1.101', status: 'Online', last: '2 mins ago' },
    ],
  });

  await prisma.geoZone.createMany({
    data: [
      { companyId: 'C1', name: 'HQ Office Zone', radiusMeters: 100, latitude: 19.0760, longitude: null, enabled: false },
      { companyId: 'C1', name: 'Tech Park Branch', radiusMeters: 200, latitude: 12.9716, longitude: null, enabled: false },
    ],
  });

  await prisma.calendarEvent.createMany({
    data: [
      { title: 'Independence Day', date: '2026-08-15', type: 'Holiday' },
      { title: 'Mahatma Gandhi Jayanti', date: '2026-10-02', type: 'Holiday' },
      { title: 'Diwali Celebration', date: '2026-11-08', type: 'Holiday' },
    ],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 17. Initial Platform System Notification for SuperAdmin
  // ─────────────────────────────────────────────────────────────────────────
  await (prisma as any).systemNotification.create({
    data: {
      title: 'Platform Initialized',
      message: 'HR Nexa SaaS platform has been initialized successfully. Acme Corp (PREMIUM) is your first active company.',
      severity: 'success',
      category: 'system',
      targetRole: 'SuperAdmin',
      company: 'System',
      reason: 'Database Initialization',
      recommendedAction: 'Review company details and confirm subscription settings.',
      linkUrl: 'saas.companies',
      read: false,
      readBy: '[]',
      timestamp: new Date(),
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 18. Seed Recruitment Data for Acme Corp
  // ─────────────────────────────────────────────────────────────────────────
  const job1 = await (prisma as any).jobRequisition.create({
    data: {
      title: 'Senior Frontend Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-Time',
      applicantsCount: 3,
      status: 'Open',
      subscriptionId: acmeSub.id,
    },
  });

  await (prisma as any).candidate.createMany({
    data: [
      { name: 'Vikram Singh', email: 'vikram@gmail.com', jobId: job1.id, jobTitle: 'Senior Frontend Engineer', stage: 'Interview', experience: '5 Yrs', appliedDate: '2026-07-10', subscriptionId: acmeSub.id },
      { name: 'Sneha Rao', email: 'sneha@gmail.com', jobId: job1.id, jobTitle: 'Senior Frontend Engineer', stage: 'Applied', experience: '4 Yrs', appliedDate: '2026-07-12', subscriptionId: acmeSub.id },
    ],
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('');
  console.log('Demo Login Credentials (password: demo1234):');
  console.log('  Super Admin:  admin@demo.co');
  console.log('  HR Admin:     hr@demo.co');
  console.log('  Manager:      manager@demo.co');
  console.log('  Accountant:   accountant@demo.co');
  console.log('  Employee:     employee@demo.co');
  console.log('  Viewer:       viewer@demo.co');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
