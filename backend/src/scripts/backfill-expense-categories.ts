import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DefaultExpenseCategoryTemplate,
} from '../modules/subscriptions/services/subscription-provisioning.service';

export interface BackfillSummary {
  eligibleCompanies: number;
  companiesAlreadyComplete: number;
  companiesBackfilled: number;
  categoriesCreated: number;
  categoriesSkipped: number;
  categoryBreakdown: Record<string, number>;
  companyResults: Array<{
    companyId: string;
    companyName: string;
    createdCount: number;
    skippedCount: number;
    totalCategoriesAfter: number;
  }>;
}

export async function backfillExpenseCategories(
  prismaClient: PrismaClient,
  options?: { dryRun?: boolean },
): Promise<BackfillSummary> {
  const isDryRun = options?.dryRun ?? false;
  const companies = await prismaClient.company.findMany({
    include: {
      expenseCategories: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const summary: BackfillSummary = {
    eligibleCompanies: companies.length,
    companiesAlreadyComplete: 0,
    companiesBackfilled: 0,
    categoriesCreated: 0,
    categoriesSkipped: 0,
    categoryBreakdown: {},
    companyResults: [],
  };

  for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
    summary.categoryBreakdown[cat.code] = 0;
  }

  for (const company of companies) {
    const existingCodes = new Set(company.expenseCategories.map((c) => c.code));
    const allDefaultsPresent = DEFAULT_EXPENSE_CATEGORIES.every((c) =>
      existingCodes.has(c.code),
    );

    if (allDefaultsPresent) {
      summary.companiesAlreadyComplete++;
    } else {
      summary.companiesBackfilled++;
    }

    let companyCreated = 0;
    let companySkipped = 0;

    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      if (existingCodes.has(cat.code)) {
        companySkipped++;
        summary.categoriesSkipped++;
      } else {
        if (!isDryRun) {
          await prismaClient.expenseCategory.upsert({
            where: {
              companyId_code: {
                companyId: company.id,
                code: cat.code,
              },
            },
            update: {}, // Idempotent: Never overwrite existing tenant configuration
            create: {
              companyId: company.id,
              name: cat.name,
              code: cat.code,
              description: cat.description,
              maxLimit: cat.maxLimit,
              requireReceipt: cat.requireReceipt,
              isTaxable: cat.isTaxable,
              isActive: true,
            },
          });
        }
        companyCreated++;
        summary.categoriesCreated++;
        summary.categoryBreakdown[cat.code] =
          (summary.categoryBreakdown[cat.code] || 0) + 1;
      }
    }

    summary.companyResults.push({
      companyId: company.id,
      companyName: company.name,
      createdCount: companyCreated,
      skippedCount: companySkipped,
      totalCategoriesAfter: company.expenseCategories.length + companyCreated,
    });
  }

  return summary;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('===========================================================');
    console.log('HR NEXA — PRODUCTION EXPENSE CATEGORY BACKFILL RUNNER');
    console.log('===========================================================');

    const summary = await backfillExpenseCategories(prisma);

    console.log(`Eligible companies found: ${summary.eligibleCompanies}`);
    console.log(
      `Companies already complete: ${summary.companiesAlreadyComplete}`,
    );
    console.log(`Companies backfilled: ${summary.companiesBackfilled}`);
    console.log(`Total categories created: ${summary.categoriesCreated}`);
    console.log(
      `Total existing categories preserved (skipped): ${summary.categoriesSkipped}`,
    );
    console.log('\nBreakdown by Category Code:');
    for (const [code, count] of Object.entries(summary.categoryBreakdown)) {
      console.log(`  - ${code.padEnd(18)} : ${count} created`);
    }

    console.log('\nPer-Company Results:');
    for (const r of summary.companyResults) {
      console.log(
        `  • [${r.companyId}] "${r.companyName}" -> Created: ${r.createdCount}, Preserved: ${r.skippedCount}, Total Active: ${r.totalCategoriesAfter}`,
      );
    }
    console.log('===========================================================');
    console.log('BACKFILL COMPLETED SUCCESSFULLY');
    console.log('===========================================================');
  } catch (error) {
    console.error('Fatal error during expense category backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
