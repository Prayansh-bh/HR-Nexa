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
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { EmployeesService } from '../services/employees.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { BulkCreateEmployeeDto } from '../dto/bulk-create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { OrgChartEmployeeDto } from '../dto/org-chart-employee.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Public } from '../../auth/public.decorator';

import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions(Permission.EMPLOYEES_LIST_VIEW)
  @ApiOperation({ summary: 'Get all employees (tenant-scoped with pagination)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Employees retrieved successfully' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('status') status?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.employeesService.findAll(
      req.user,
      search,
      department,
      status,
      { page: parsedPage, limit: parsedLimit },
    );
  }

  @Get('orgchart')
  @RequirePermissions(Permission.EMPLOYEES_ORGCHART_VIEW)
  @ApiOperation({ summary: 'Get sanitized employee hierarchy for Org Chart' })
  @ApiResponse({
    status: 200,
    description: 'Org Chart hierarchy retrieved successfully',
    type: [OrgChartEmployeeDto],
  })
  async getOrgChart(
    @Request() req: AuthenticatedRequest,
  ): Promise<OrgChartEmployeeDto[]> {
    return this.employeesService.getOrgChartTree(req.user);
  }

  @Get(':id')
  @RequirePermissions(Permission.EMPLOYEES_PROFILE_VIEW)
  @ApiOperation({ summary: 'Get a specific employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.employeesService.findOne(req.user, id);
  }

  @Post()
  @RequirePermissions(Permission.EMPLOYEES_LIST_CREATE)
  @ApiOperation({ summary: 'Create new employee' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() createEmployeeDto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(req.user, createEmployeeDto);
  }

  @Post('bulk')
  @RequirePermissions(Permission.EMPLOYEES_ONBOARDING_MANAGE)
  @ApiOperation({
    summary:
      'Bulk create employees (Best-effort / Non-atomic with structured reporting)',
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk employee creation results',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async bulkCreate(
    @Request() req: AuthenticatedRequest,
    @Body() bulkCreateEmployeeDto: BulkCreateEmployeeDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') xIdempotencyKey?: string,
  ) {
    const key = idempotencyKey || xIdempotencyKey;
    return this.employeesService.bulkCreate(
      req.user,
      bulkCreateEmployeeDto,
      key,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update employee details' })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    // Self-profile edit or full employee edit permission check
    const hasFullEdit =
      user.permissions?.includes(Permission.EMPLOYEES_LIST_EDIT) ||
      user.permissions?.includes(Permission.EMPLOYEES_UPDATE) ||
      user.permissions?.includes('employees:update');
    if (!hasFullEdit && user.role !== 'SuperAdmin') {
      const userEmployeeId = user.employee?.id || (user as any).employeeId;
      if (!userEmployeeId || userEmployeeId !== id) {
        throw new ForbiddenException(
          'You can only update your own employee record',
        );
      }
    }
    return this.employeesService.update(req.user, id, updateEmployeeDto);
  }

  @Post(':id/avatar')
  @ApiOperation({ summary: 'Upload and persist employee avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No avatar image file provided');
    }
    return this.employeesService.uploadAvatar(req.user, id, file);
  }

  @Public()
  @Get(':id/avatar')
  @ApiOperation({ summary: 'Stream employee avatar image' })
  async getAvatar(
    @Param('id') id: string,
    @Res() res: any,
  ) {
    const result = await this.employeesService.getAvatarStream(id);
    if (!result) {
      return res.status(404).send('Avatar not found');
    }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (Buffer.isBuffer(result.streamOrBuffer)) {
      return res.end(result.streamOrBuffer);
    }
    return (result.streamOrBuffer as any).pipe(res);
  }

  @Delete(':id')
  @RequirePermissions(Permission.EMPLOYEES_LIST_DELETE)
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiResponse({ status: 200, description: 'Employee deleted successfully' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.employeesService.remove(req.user, id);
  }
}
