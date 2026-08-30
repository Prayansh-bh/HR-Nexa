import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExpenseClaimService } from '../services/expense-claim.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { TenantContext } from '../../../common/tenant/tenant-context.util';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
  CreateExpenseClaimDto,
  UpdateExpenseClaimDto,
  ReviewExpenseClaimDto,
  PayExpenseClaimDto,
  ExpenseClaimStatus,
  ExpensePaymentStatus,
} from '../dto/expense-claim.dto';

@ApiTags('Reimbursements & Expense Claims')
@Controller('expense-claims')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class ExpenseClaimController {
  constructor(private readonly expenseClaimService: ExpenseClaimService) {}

  // --- Categories ---
  @Get('categories')
  @RequirePermissions(Permission.EXPENSES_VIEW)
  @ApiOperation({ summary: 'Get active expense categories for current tenant' })
  async getCategories(@Request() req: AuthenticatedRequest) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.getCategories(scope, true);
  }

  @Post('categories')
  @RequirePermissions(Permission.EXPENSES_MANAGE)
  @ApiOperation({ summary: 'Create new tenant expense category' })
  async createCategory(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateExpenseCategoryDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.createCategory(scope, body);
  }

  @Put('categories/:id')
  @RequirePermissions(Permission.EXPENSES_MANAGE)
  @ApiOperation({ summary: 'Update tenant expense category policy settings' })
  async updateCategory(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateExpenseCategoryDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.updateCategory(id, scope, body);
  }

  // --- Employee Self-Service ---
  @Get('my')
  @RequirePermissions(Permission.EXPENSES_VIEW)
  @ApiOperation({ summary: 'Get current employee expense claims' })
  @ApiQuery({ name: 'fiscalYearId', required: false, type: String })
  async getMyClaims(
    @Request() req: AuthenticatedRequest,
    @Query('fiscalYearId') fiscalYearId?: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.getMyClaims(req.user, scope, fiscalYearId);
  }

  @Post('my')
  @RequirePermissions(Permission.EXPENSES_SUBMIT)
  @ApiOperation({ summary: 'Create initial expense claim draft for current employee' })
  async createMyClaim(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateExpenseClaimDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.createMyClaim(req.user, scope, body);
  }

  @Put('my/:id')
  @RequirePermissions(Permission.EXPENSES_SUBMIT)
  @ApiOperation({ summary: 'Update draft expense claim items for current employee' })
  async updateMyClaimDraft(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateExpenseClaimDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.updateMyClaimDraft(req.user, scope, id, body);
  }

  @Post('my/:id/submit')
  @RequirePermissions(Permission.EXPENSES_SUBMIT)
  @ApiOperation({ summary: 'Submit expense claim draft for review' })
  async submitMyClaim(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.submitMyClaim(req.user, scope, id);
  }

  // --- Accountant Management ---
  @Get()
  @RequirePermissions(Permission.EXPENSES_MANAGE)
  @ApiOperation({ summary: 'Get tenant expense claims for accountant audit' })
  @ApiQuery({ name: 'fiscalYearId', required: false, type: String })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'paymentStatus', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTenantClaims(
    @Request() req: AuthenticatedRequest,
    @Query('fiscalYearId') fiscalYearId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: ExpenseClaimStatus,
    @Query('paymentStatus') paymentStatus?: ExpensePaymentStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.expenseClaimService.getTenantClaims(scope, {
      fiscalYearId,
      employeeId,
      status,
      paymentStatus,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get(':id')
  @RequirePermissions(Permission.EXPENSES_VIEW)
  @ApiOperation({ summary: 'Get single expense claim details' })
  async getClaimById(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.getClaimById(id, scope);
  }

  @Post(':id/review')
  @RequirePermissions(Permission.EXPENSES_APPROVE)
  @ApiOperation({ summary: 'Review decision (Approve / Reject / Request Correction) on expense claim' })
  async reviewClaim(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: ReviewExpenseClaimDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.reviewClaim(id, scope, req.user, body);
  }

  @Post(':id/pay')
  @RequirePermissions(Permission.EXPENSES_PAY)
  @ApiOperation({ summary: 'Execute disbursement payment for an approved/payable expense claim' })
  async payClaim(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: PayExpenseClaimDto,
  ) {
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.expenseClaimService.payClaim(id, scope, req.user, body);
  }
}
