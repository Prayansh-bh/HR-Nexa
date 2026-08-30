import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

export const PLATFORM_CORE_PERMISSIONS = new Set<string>([
  'settings:company:view',
  'settings:company:edit',
  'settings:fiscal:view',
  'settings:fiscal:manage',
  'settings:roles:view',
  'settings:roles:edit',
  'system:announcement:create',
  'system:audit:view',
  'system:audit:read',
]);

export const permissionToFeatureKey: Record<string, string> = {
  // 1. CORE_HR
  'employees:list:view': 'CORE_HR',
  'employees:list:create': 'CORE_HR',
  'employees:list:edit': 'CORE_HR',
  'employees:list:delete': 'CORE_HR',
  'employees:list:export': 'CORE_HR',
  'employees:list:import': 'CORE_HR',
  'employees:profile:view': 'CORE_HR',
  'employees:profile:edit': 'CORE_HR',
  'employees:salary:view': 'CORE_HR',
  'employees:salary:edit': 'CORE_HR',
  'employees:salary:approve': 'CORE_HR',
  'employees:salary:delete': 'CORE_HR',
  'employees:departments:manage': 'CORE_HR',
  'employees:designations:manage': 'CORE_HR',
  'employees:onboarding:manage': 'CORE_HR',
  'employees:orgchart:view': 'CORE_HR',
  'employees:read': 'CORE_HR',
  'employees:create': 'CORE_HR',
  'employees:update': 'CORE_HR',
  'employees:delete': 'CORE_HR',
  'departments:manage': 'CORE_HR',
  'departments:read': 'CORE_HR',
  'settings:roles:view': 'CORE_HR',
  'settings:roles:edit': 'CORE_HR',

  // 2. CORE_DOCUMENTS
  'employees:profile:docs:upload': 'CORE_DOCUMENTS',
  'employees:profile:docs:download': 'CORE_DOCUMENTS',
  'employees:profile:docs:delete': 'CORE_DOCUMENTS',
  'documents:verify': 'CORE_DOCUMENTS',
  'documents:read': 'CORE_DOCUMENTS',
  'documents:write': 'CORE_DOCUMENTS',
  'documents:delete': 'CORE_DOCUMENTS',

  // 3. ATTENDANCE_BASIC
  'employees:attendance:view': 'ATTENDANCE_BASIC',
  'employees:attendance:edit': 'ATTENDANCE_BASIC',
  'employees:attendance:regularize': 'ATTENDANCE_BASIC',
  'employees:attendance:verify': 'ATTENDANCE_BASIC',
  'employees:attendance:clock': 'ATTENDANCE_BASIC',
  'attendance:clock': 'ATTENDANCE_BASIC',
  'attendance:read': 'ATTENDANCE_BASIC',
  'attendance:verify': 'ATTENDANCE_BASIC',
  'leaves:approve': 'ATTENDANCE_BASIC',
  'leaves:create': 'ATTENDANCE_BASIC',
  'leaves:policy:manage': 'ATTENDANCE_BASIC',
  'reports:attendance:view': 'ATTENDANCE_BASIC',
  'reports:attendance:export': 'ATTENDANCE_BASIC',

  // 4. ATTENDANCE_GEO
  'attendance:geo:config': 'ATTENDANCE_GEO',
  'attendance:geo:bypass': 'ATTENDANCE_GEO',

  // 5. ATTENDANCE_BIOMETRIC
  'attendance:devices:manage': 'ATTENDANCE_BIOMETRIC',
  'attendance:devices:sync': 'ATTENDANCE_BIOMETRIC',

  // 6. PAYROLL_BASIC
  'payroll:process:view': 'PAYROLL_BASIC',
  'payroll:process:generate': 'PAYROLL_BASIC',
  'payroll:process:run': 'PAYROLL_BASIC',
  'payroll:process:lock': 'PAYROLL_BASIC',
  'payroll:process:reopen': 'PAYROLL_BASIC',
  'payroll:slips:view': 'PAYROLL_BASIC',
  'payroll:slips:download': 'PAYROLL_BASIC',
  'payroll:slips:email': 'PAYROLL_BASIC',
  'reports:payroll:view': 'PAYROLL_BASIC',
  'reports:payroll:export:pdf': 'PAYROLL_BASIC',
  'reports:payroll:export:excel': 'PAYROLL_BASIC',

  // 7. PAYROLL_STATUTORY
  'payroll:statutory:view': 'PAYROLL_STATUTORY',
  'payroll:statutory:calculate': 'PAYROLL_STATUTORY',
  'payroll:statutory:export': 'PAYROLL_STATUTORY',

  // 8. TAX_DECLARATIONS
  'tax:declarations:view': 'TAX_DECLARATIONS',
  'tax:declarations:submit': 'TAX_DECLARATIONS',
  'tax:declarations:manage': 'TAX_DECLARATIONS',

  // 9. EXPENSE_CLAIMS
  'expenses:view': 'EXPENSE_CLAIMS',
  'expenses:submit': 'EXPENSE_CLAIMS',
  'expenses:approve': 'EXPENSE_CLAIMS',
  'expenses:manage': 'EXPENSE_CLAIMS',
  'expenses:pay': 'EXPENSE_CLAIMS',

  // 10. MODULE_RECRUITMENT
  'recruitment:jobs:view': 'MODULE_RECRUITMENT',
  'recruitment:jobs:create': 'MODULE_RECRUITMENT',
  'recruitment:jobs:edit': 'MODULE_RECRUITMENT',
  'recruitment:candidates:view': 'MODULE_RECRUITMENT',
  'recruitment:candidates:add': 'MODULE_RECRUITMENT',
  'recruitment:candidates:movestage': 'MODULE_RECRUITMENT',
  'recruitment:candidates:hire': 'MODULE_RECRUITMENT',

  // 11. MODULE_PERFORMANCE
  'performance:reviews:view': 'MODULE_PERFORMANCE',
  'performance:cycles:manage': 'MODULE_PERFORMANCE',

  // 12. MODULE_DPR
  'dpr:view': 'MODULE_DPR',
  'dpr:submit': 'MODULE_DPR',
  'dpr:approve': 'MODULE_DPR',
  'dpr:manage': 'MODULE_DPR',

  // 13. MODULE_ASSETS
  'assets:view': 'MODULE_ASSETS',
  'assets:manage': 'MODULE_ASSETS',

  // 14. MODULE_EXIT
  'exit:view': 'MODULE_EXIT',
  'exit:submit': 'MODULE_EXIT',
  'exit:approve': 'MODULE_EXIT',
  'exit:manage': 'MODULE_EXIT',
  'exit:settle': 'MODULE_EXIT',

  // 15. MODULE_HELPDESK
  'support:tickets:view': 'MODULE_HELPDESK',
  'support:tickets:create': 'MODULE_HELPDESK',
  'support:tickets:message': 'MODULE_HELPDESK',
  'support:tickets:status': 'MODULE_HELPDESK',
  'support:tickets:resolve': 'MODULE_HELPDESK',
  'support:tickets:close': 'MODULE_HELPDESK',
  'support:tickets:delete': 'MODULE_HELPDESK',

  // 16. MODULE_MESSAGING
  'chatbox:access': 'MODULE_MESSAGING',

  // 17. ADVANCED_AUDIT
  'system:audit:view': 'ADVANCED_AUDIT',
  'system:audit:delete': 'ADVANCED_AUDIT',
  'system:audit:read': 'ADVANCED_AUDIT',
};

// Canonical Category and Feature definitions
export const CANONICAL_CATEGORIES = [
  { name: 'Core HR', description: 'Core personnel, directory, and document records', order: 1 },
  { name: 'Attendance & Time', description: 'Time tracking, shifts, geofencing, and biometric sync', order: 2 },
  { name: 'Payroll & Compensation', description: 'Payroll execution, statutory tax, declarations, and expenses', order: 3 },
  { name: 'Talent & Operations', description: 'Recruitment, appraisals, daily tasks, assets, and helpdesk', order: 4 },
  { name: 'Enterprise & Security', description: 'Custom roles and immutable audit logs', order: 5 },
];

export const CANONICAL_FEATURES = [
  { key: 'CORE_HR', name: 'Core Employee & Org Directory', category: 'Core HR', module: 'CORE', description: 'Employee master records, profiles, org chart, departments & designations' },
  { key: 'CORE_DOCUMENTS', name: 'Employee Document Vault', category: 'Core HR', module: 'CORE', description: 'Digital document category repository, uploads, and compliance verification' },
  { key: 'ATTENDANCE_BASIC', name: 'Basic Attendance & Leave', category: 'Attendance & Time', module: 'ATTENDANCE', description: 'Web clock-in, regularization, monthly matrix grid, and leave workflows' },
  { key: 'ATTENDANCE_GEO', name: 'Geo-Fencing & Mobile Clock-in', category: 'Attendance & Time', module: 'ATTENDANCE', description: 'GPS-restricted mobile clock-in and radius validation' },
  { key: 'ATTENDANCE_BIOMETRIC', name: 'Biometric Device Integration', category: 'Attendance & Time', module: 'ATTENDANCE', description: 'Hardware biometric machine sync and IoT device registry' },
  { key: 'PAYROLL_BASIC', name: 'Core Payroll & Payslips', category: 'Payroll & Compensation', module: 'PAYROLL', description: '1-click batch payroll execution, slip generation, and email distribution' },
  { key: 'PAYROLL_STATUTORY', name: 'Statutory Tax Compliance', category: 'Payroll & Compensation', module: 'PAYROLL', description: 'PF, ESI, Professional Tax, and TDS compliance deductions and reports' },
  { key: 'TAX_DECLARATIONS', name: 'Income Tax Declarations', category: 'Payroll & Compensation', module: 'PAYROLL', description: 'Employee investment proof submissions (80C, 80D) and HR verification' },
  { key: 'EXPENSE_CLAIMS', name: 'Reimbursements & Expenses', category: 'Payroll & Compensation', module: 'PAYROLL', description: 'Expense claims, multi-receipt attachments, and finance approval/payout' },
  { key: 'MODULE_RECRUITMENT', name: 'Recruitment & ATS Pipeline', category: 'Talent & Operations', module: 'RECRUITMENT', description: 'Job openings, candidate pipelines, scorecards, and offer letter generation' },
  { key: 'MODULE_PERFORMANCE', name: 'Performance & 360 Reviews', category: 'Talent & Operations', module: 'PERFORMANCE', description: 'Appraisal review cycles, 360 feedback, OKRs, and KPI goal tracking' },
  { key: 'MODULE_DPR', name: 'Daily Progress Reports (DPR)', category: 'Talent & Operations', module: 'DPR', description: 'Daily task logging, blocker alerts, and manager rating oversight' },
  { key: 'MODULE_ASSETS', name: 'Company Asset Management', category: 'Talent & Operations', module: 'ASSETS', description: 'Hardware/laptop inventory registry, allocation tracking, and status' },
  { key: 'MODULE_EXIT', name: 'Offboarding & Exit Management', category: 'Talent & Operations', module: 'EXIT', description: 'Resignation workflows, clearance checklists, and F&F settlement engine' },
  { key: 'MODULE_HELPDESK', name: 'Helpdesk & Support Tickets', category: 'Talent & Operations', module: 'SUPPORT', description: 'Internal employee support ticketing, resolution, and threaded messages' },
  { key: 'MODULE_MESSAGING', name: 'Internal Chatbox', category: 'Talent & Operations', module: 'MESSAGING', description: 'Encrypted real-time peer-to-peer messaging channel across employees' },
  { key: 'ADVANCED_AUDIT', name: 'Immutable Audit Logging', category: 'Enterprise & Security', module: 'ENTERPRISE', description: 'Immutable administrative audit trail and security compliance records' },
];

export const CANONICAL_PLAN_MATRIX: Record<string, string[]> = {
  BASIC: [
    'CORE_HR',
    'CORE_DOCUMENTS',
    'ATTENDANCE_BASIC',
    'PAYROLL_BASIC',
  ],
  STANDARD: [
    'CORE_HR',
    'CORE_DOCUMENTS',
    'ATTENDANCE_BASIC',
    'ATTENDANCE_GEO',
    'ATTENDANCE_BIOMETRIC',
    'PAYROLL_BASIC',
    'PAYROLL_STATUTORY',
    'TAX_DECLARATIONS',
    'EXPENSE_CLAIMS',
    'MODULE_RECRUITMENT',
    'MODULE_PERFORMANCE',
    'MODULE_DPR',
    'MODULE_ASSETS',
    'MODULE_EXIT',
    'MODULE_HELPDESK',
    'MODULE_MESSAGING',
  ],
  PREMIUM: [
    'CORE_HR',
    'CORE_DOCUMENTS',
    'ATTENDANCE_BASIC',
    'ATTENDANCE_GEO',
    'ATTENDANCE_BIOMETRIC',
    'PAYROLL_BASIC',
    'PAYROLL_STATUTORY',
    'TAX_DECLARATIONS',
    'EXPENSE_CLAIMS',
    'MODULE_RECRUITMENT',
    'MODULE_PERFORMANCE',
    'MODULE_DPR',
    'MODULE_ASSETS',
    'MODULE_EXIT',
    'MODULE_HELPDESK',
    'MODULE_MESSAGING',
    'ADVANCED_AUDIT',
  ],
};


export async function syncCanonicalEntitlements(prismaClient: PrismaClient): Promise<{
  categoriesSynced: number;
  featuresSynced: number;
  permissionsSynced: number;
  plansSynced: number;
}> {
  // 1. Seed / Upsert Feature Categories
  const categoryMap: Record<string, string> = {};
  for (const cat of CANONICAL_CATEGORIES) {
    const record = await prismaClient.featureCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description, order: cat.order },
      create: { name: cat.name, description: cat.description, order: cat.order },
    });
    categoryMap[cat.name] = record.id;
  }

  // 2. Seed / Upsert all 19 Canonical Features
  const featureMap: Record<string, string> = {};
  for (const feat of CANONICAL_FEATURES) {
    const categoryId = categoryMap[feat.category] || null;
    const record = await prismaClient.feature.upsert({
      where: { key: feat.key },
      update: {
        name: feat.name,
        categoryId,
        module: feat.module,
        description: feat.description,
        status: 'Active',
      },
      create: {
        key: feat.key,
        name: feat.name,
        categoryId,
        module: feat.module,
        description: feat.description,
        status: 'Active',
      },
    });
    featureMap[feat.key] = record.id;
  }

  // Legacy feature key alias support: point legacy keys to their canonical IDs if legacy rows exist
  const legacyAliases: Record<string, string> = {
    CORE_EMPLOYEE: 'CORE_HR',
    ATT_BASIC: 'ATTENDANCE_BASIC',
    ATT_GEO: 'ATTENDANCE_GEO',
    ATT_BIOMETRIC: 'ATTENDANCE_BIOMETRIC',
    PAY_BASIC: 'PAYROLL_BASIC',
    PAY_STATUTORY: 'PAYROLL_STATUTORY',
    ADV_AUDIT: 'ADVANCED_AUDIT',
  };


  for (const [legacyKey, canonicalKey] of Object.entries(legacyAliases)) {
    const targetId = featureMap[canonicalKey];
    if (targetId) {
      featureMap[legacyKey] = targetId;
    }
  }

  // 3. Seed / Upsert Permission -> Feature mappings
  let permissionsSynced = 0;
  for (const [permKey, featureKey] of Object.entries(permissionToFeatureKey)) {
    const featureId = featureMap[featureKey];
    if (!featureId) {
      continue;
    }
    await (prismaClient as any).permission.upsert({
      where: { key: permKey },
      update: { featureId },
      create: { key: permKey, featureId },
    });
    permissionsSynced++;
  }

  // 4. Configure PlanFeatureConfig for all published versions of BASIC, STANDARD, PREMIUM
  let plansSynced = 0;
  const plans = await prismaClient.saaSPlanNew.findMany({
    include: { versions: true },
  });

  for (const plan of plans) {
    const planNameUpper = plan.name.toUpperCase();
    const enabledFeatureKeys = new Set(CANONICAL_PLAN_MATRIX[planNameUpper] || []);

    for (const version of plan.versions) {
      for (const feat of CANONICAL_FEATURES) {
        const featureId = featureMap[feat.key];
        if (!featureId) continue;

        const isEnabled = enabledFeatureKeys.has(feat.key);

        await prismaClient.planFeatureConfig.upsert({
          where: {
            planVersionId_featureId: {
              planVersionId: version.id,
              featureId,
            },
          },
          update: {
            enabled: isEnabled,
          },
          create: {
            planVersionId: version.id,
            featureId,
            enabled: isEnabled,
          },
        });
      }
      plansSynced++;
    }
  }

  return {
    categoriesSynced: CANONICAL_CATEGORIES.length,
    featuresSynced: CANONICAL_FEATURES.length,
    permissionsSynced,
    plansSynced,
  };
}

export async function syncPermissions(prismaClient: PrismaClient): Promise<{ count: number }> {
  const res = await syncCanonicalEntitlements(prismaClient);
  return { count: res.permissionsSynced };
}

async function main() {
  console.log('Seeding Canonical 19 SaaS Entitlements & Permissions...');
  const result = await syncCanonicalEntitlements(prisma);
  console.log('Successfully synced canonical entitlement architecture:');
  console.log(`  Categories: ${result.categoriesSynced}`);
  console.log(`  Features: ${result.featuresSynced}`);
  console.log(`  Permissions: ${result.permissionsSynced}`);
  console.log(`  Plan Versions Configured: ${result.plansSynced}`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('Error seeding permissions:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}


