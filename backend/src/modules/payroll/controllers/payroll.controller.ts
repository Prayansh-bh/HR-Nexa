import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PayrollService } from '../services/payroll.service';
import { BatchProcessPayrollDto } from '../dto/batch-process-payroll.dto';
import { GeneratePayrollDto } from '../dto/generate-payroll.dto';
import { PeriodLockDto } from '../dto/period-lock.dto';
import { UpdatePayrollStatusDto } from '../dto/update-payroll-status.dto';
import { MarkPayrollPaidDto } from '../dto/mark-payroll-paid.dto';
import { UpdatePayrollInputDto } from '../dto/payroll-input.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { createPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@ApiTags('Payroll')
@Controller('payroll')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @RequirePermissions(Permission.PAYROLL_SLIPS_VIEW)
  @ApiOperation({ summary: 'Get payroll slips (tenant-scoped with pagination)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: String })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('month') month?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    const user = req.user;
    // Employees can only fetch their own slips
    if (user.role === 'Employee') {
      if (!user.employee) {
        return createPaginatedResponse([], 0, parsedPage || 1, parsedLimit || 50);
      }
      return this.payrollService.findAll(user, month, user.employee.id, {
        page: parsedPage,
        limit: parsedLimit,
      });
    }
    return this.payrollService.findAll(user, month, employeeId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Post('generate')
  @RequirePermissions(Permission.PAYROLL_PROCESS_GENERATE)
  @ApiOperation({ summary: 'Generate and persist draft payroll slips for a month (HR Admin)' })
  async generate(
    @Request() req: AuthenticatedRequest,
    @Body() dto: GeneratePayrollDto,
  ) {
    return this.payrollService.generateDraftBatch(dto, req.user);
  }

  @Post('calculate')
  @RequirePermissions(Permission.PAYROLL_PROCESS_VIEW)
  @ApiOperation({ summary: 'Calculate/Preview payroll before processing' })
  async calculate(
    @Request() req: AuthenticatedRequest,
    @Body() dto: BatchProcessPayrollDto,
  ) {
    return this.payrollService.calculate(req.user, dto);
  }

  @Post('process')
  @RequirePermissions(Permission.PAYROLL_PROCESS_RUN)
  @ApiOperation({ summary: 'Process or save batch payroll slips' })
  async process(
    @Request() req: AuthenticatedRequest,
    @Body() dto: BatchProcessPayrollDto,
  ) {
    return this.payrollService.processBatch(dto, req.user);
  }

  @Put('period/lock')
  @RequirePermissions(Permission.PAYROLL_PROCESS_LOCK)
  @ApiOperation({ summary: 'Lock a payroll period' })
  async lockPeriod(
    @Request() req: AuthenticatedRequest,
    @Body() dto: PeriodLockDto,
  ) {
    return this.payrollService.lockPeriod(dto.month, req.user);
  }

  @Put('period/unlock')
  @RequirePermissions(Permission.PAYROLL_PROCESS_REOPEN)
  @ApiOperation({ summary: 'Unlock a payroll period' })
  async unlockPeriod(
    @Request() req: AuthenticatedRequest,
    @Body() dto: PeriodLockDto,
  ) {
    return this.payrollService.unlockPeriod(dto.month, req.user);
  }

  @Put(':id/status')
  @RequirePermissions(Permission.PAYROLL_PROCESS_RUN)
  @ApiOperation({ summary: 'Update status of payroll record' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.payrollService.updateStatus(id, dto.status, req.user);
  }

  @Post('mark-paid')
  @RequirePermissions(Permission.PAYROLL_PROCESS_RUN)
  @ApiOperation({ summary: 'Mark entire monthly payroll batch as PAID after disbursement' })
  async markMonthPaid(
    @Request() req: AuthenticatedRequest,
    @Body() dto: MarkPayrollPaidDto,
  ) {
    return this.payrollService.markMonthAsPaid(dto, req.user);
  }

  @Get('summary')
  @RequirePermissions(Permission.REPORTS_PAYROLL_VIEW)
  @ApiOperation({ summary: 'Get payroll summary by month' })
  @ApiQuery({ name: 'month', required: true, type: String })
  async getSummary(
    @Request() req: AuthenticatedRequest,
    @Query('month') month: string,
  ) {
    return this.payrollService.getSummary(req.user, month);
  }

  @Get('inputs')
  @RequirePermissions(Permission.PAYROLL_PROCESS_VIEW)
  @ApiOperation({ summary: 'Get persistent payroll inputs for a month' })
  @ApiQuery({ name: 'month', required: false, type: String })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  async getPayrollInputs(
    @Request() req: AuthenticatedRequest,
    @Query('month') month?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.payrollService.getPayrollInputs(req.user, month, employeeId);
  }

  @Put('inputs/:employeeId')
  @RequirePermissions(Permission.EMPLOYEES_SALARY_EDIT)
  @ApiOperation({ summary: 'Create or update persistent payroll input override for an employee/month' })
  async upsertPayrollInput(
    @Request() req: AuthenticatedRequest,
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdatePayrollInputDto,
  ) {
    return this.payrollService.upsertPayrollInput(req.user, employeeId, dto);
  }

  @Get('components')
  @RequirePermissions(Permission.PAYROLL_PROCESS_VIEW)
  @ApiOperation({ summary: 'Get custom salary components' })
  async getComponents(@Request() req: AuthenticatedRequest) {
    const user = req.user;
    const tenantId =
      user.role === 'SuperAdmin'
        ? null
        : user.companyId || user.subscriptionId || null;
    return this.payrollService.getComponents(tenantId);
  }

  @Post('components')
  @RequirePermissions(Permission.EMPLOYEES_SALARY_EDIT)
  @ApiOperation({ summary: 'Create a custom salary component' })
  async createComponent(
    @Request() req: AuthenticatedRequest,
    @Body() body: any,
  ) {
    const user = req.user;
    const tenantId = user.companyId || user.subscriptionId;
    return this.payrollService.createComponent(tenantId, body);
  }

  @Delete('components/:id')
  @RequirePermissions(Permission.EMPLOYEES_SALARY_DELETE)
  @ApiOperation({ summary: 'Delete a custom salary component' })
  async deleteComponent(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const user = req.user;
    const tenantId =
      user.role === 'SuperAdmin'
        ? null
        : user.companyId || user.subscriptionId || null;
    return this.payrollService.deleteComponent(tenantId, id);
  }

  @Put(':id')
  @RequirePermissions(Permission.EMPLOYEES_SALARY_EDIT)
  @ApiOperation({ summary: 'Update specific payroll slip values manually' })
  async updateSlip(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const user = req.user;
    const tenantId =
      user.role === 'SuperAdmin'
        ? null
        : user.companyId || user.subscriptionId || null;
    return this.payrollService.updateSlip(tenantId, id, body);
  }
}
