import {
  Controller,
  Get,
  Post,
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
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DepartmentsService } from '../services/departments.service';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { CreateDesignationDto } from '../dto/create-designation.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Role } from '../../auth/role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

@ApiTags('Departments & Designations')
@Controller()
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get('departments')
  @RequirePermissions(Permission.EMPLOYEES_DEPARTMENTS_MANAGE)
  @ApiOperation({ summary: 'Get all departments' })
  @ApiResponse({
    status: 200,
    description: 'Departments retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getDepts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.service.findAllDepartments({ page: parsedPage, limit: parsedLimit });
  }

  @Post('departments')
  @RequirePermissions(Permission.EMPLOYEES_DEPARTMENTS_MANAGE)
  @ApiOperation({ summary: 'Create department' })
  async createDept(@Body() dto: CreateDepartmentDto) {
    return this.service.createDepartment(dto);
  }

  @Delete('departments/:id')
  @RequirePermissions(Permission.EMPLOYEES_DEPARTMENTS_MANAGE)
  @ApiOperation({ summary: 'Delete department' })
  async deleteDept(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const subscriptionId =
      req.user.role === Role.SuperAdmin
        ? undefined
        : req.user.subscriptionId || undefined;
    return this.service.deleteDepartment(id, subscriptionId);
  }

  @Get('designations')
  @RequirePermissions(Permission.EMPLOYEES_DESIGNATIONS_MANAGE)
  @ApiOperation({
    summary: 'Get all designations, optionally filtered by departmentId',
  })
  @ApiResponse({
    status: 200,
    description: 'Designations retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getDesigs(
    @Query('departmentId') departmentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (departmentId) {
      return this.service.findDesignationsByDepartment(departmentId);
    }
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.service.findAllDesignations({ page: parsedPage, limit: parsedLimit });
  }

  @Post('designations')
  @RequirePermissions(Permission.EMPLOYEES_DESIGNATIONS_MANAGE)
  @ApiOperation({ summary: 'Create designation' })
  async createDesig(@Body() dto: CreateDesignationDto) {
    return this.service.createDesignation(dto);
  }

  @Delete('designations/:id')
  @RequirePermissions(Permission.EMPLOYEES_DESIGNATIONS_MANAGE)
  @ApiOperation({ summary: 'Delete designation' })
  async deleteDesig(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const subscriptionId =
      req.user.role === Role.SuperAdmin
        ? undefined
        : req.user.subscriptionId || undefined;
    return this.service.deleteDesignation(id, subscriptionId);
  }
}
