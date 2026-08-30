import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { PayrollService } from './services/payroll.service';
import { PayrollController } from './controllers/payroll.controller';
import { PayrollRepository } from './repositories/payroll.repository';
import { PayrollEngineService } from './services/payroll-engine.service';
import { StatutoryRulesService } from './services/statutory-rules.service';
import { SalaryComponentCalculatorService } from './services/salary-component-calculator.service';
import { TaxDeclarationController } from './controllers/tax-declaration.controller';
import { TaxDeclarationService } from './services/tax-declaration.service';
import { TaxDeclarationRepository } from './repositories/tax-declaration.repository';
import { TaxCalculationService } from './services/tax-calculation.service';
import { LopPolicyService } from './services/lop-policy.service';

import { ExpenseClaimController } from './controllers/expense-claim.controller';
import { ExpenseClaimService } from './services/expense-claim.service';
import { ExpensePolicyService } from './services/expense-policy.service';
import { ExpenseClaimRepository } from './repositories/expense-claim.repository';

@Module({
  imports: [AttendanceModule],
  controllers: [PayrollController, TaxDeclarationController, ExpenseClaimController],
  providers: [
    PayrollService,
    PayrollRepository,
    PayrollEngineService,
    LopPolicyService,
    StatutoryRulesService,
    SalaryComponentCalculatorService,
    TaxDeclarationService,
    TaxDeclarationRepository,
    TaxCalculationService,
    ExpenseClaimService,
    ExpensePolicyService,
    ExpenseClaimRepository,
  ],
  exports: [
    PayrollService,
    PayrollRepository,
    PayrollEngineService,
    LopPolicyService,
    StatutoryRulesService,
    SalaryComponentCalculatorService,
    TaxDeclarationService,
    TaxDeclarationRepository,
    TaxCalculationService,
    ExpenseClaimService,
    ExpensePolicyService,
    ExpenseClaimRepository,
  ],
})
export class PayrollModule {}
