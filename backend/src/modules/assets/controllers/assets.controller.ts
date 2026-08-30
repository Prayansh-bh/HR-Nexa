import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiQuery, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Role } from '../../auth/role.enum';
import { AssetsService } from '../services/assets.service';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { CreateAssetDto } from '../dto/create-asset.dto';
import { UpdateAssetDto } from '../dto/update-asset.dto';
import { AssignAssetDto } from '../dto/assign-asset.dto';
import { ReturnAssetDto } from '../dto/return-asset.dto';
import { MaintenanceAssetDto, RepairAssetDto } from '../dto/maintenance-asset.dto';
import { RetireAssetDto } from '../dto/retire-asset.dto';

@ApiTags('Assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  private resolveTenantId(req: AuthenticatedRequest): string {
    const tenantId = req.user.companyId || req.user.subscriptionId;
    if (!tenantId) {
      throw new BadRequestException('A valid company context is required for asset operations.');
    }
    return tenantId;
  }

  @Get()
  @RequirePermissions(Permission.ASSETS_VIEW)
  @ApiOperation({ summary: 'Get list of assets with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAssets(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const companyId = req.user.role === Role.SuperAdmin ? null : this.resolveTenantId(req);
    return this.assetsService.getAssets(companyId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get('devices')
  @RequirePermissions(Permission.ASSETS_VIEW)
  @ApiOperation({ summary: 'Get list of company devices' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getDevices(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const companyId = req.user.role === Role.SuperAdmin ? null : this.resolveTenantId(req);
    return this.assetsService.getDevices(companyId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get assets assigned to a specific employee' })
  async getEmployeeAssets(
    @Request() req: AuthenticatedRequest,
    @Param('employeeId') employeeId: string,
  ) {
    const user = req.user;
    const hasAdminView =
      user.role === Role.SuperAdmin ||
      user.permissions?.includes(Permission.ASSETS_VIEW) ||
      user.permissions?.includes('assets:view');

    if (!hasAdminView) {
      const userEmployeeId = user.employee?.id || (user as any).employeeId;
      if (!userEmployeeId || userEmployeeId !== employeeId) {
        throw new ForbiddenException(
          'You can only view your own assigned assets',
        );
      }
    }

    const tenantId = this.resolveTenantId(req);
    return this.assetsService.getEmployeeAssets(tenantId, employeeId);
  }

  @Get(':id')
  @RequirePermissions(Permission.ASSETS_VIEW)
  @ApiOperation({ summary: 'Get single asset details by ID' })
  async getAssetById(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.getAssetById(tenantId, id);
  }

  @Get(':id/history')
  @RequirePermissions(Permission.ASSETS_VIEW)
  @ApiOperation({ summary: 'Get asset custody and lifecycle history' })
  async getAssetHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.getAssetHistory(tenantId, id);
  }

  @Post()
  @RequirePermissions(Permission.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Create a new asset in inventory' })
  async createAsset(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateAssetDto,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.createAsset(tenantId, dto, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Put(':id')
  @RequirePermissions(Permission.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Update asset specifications and metadata' })
  async updateAsset(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.updateAsset(tenantId, id, dto, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Post(':id/assign')
  @RequirePermissions(Permission.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Assign an asset to an employee' })
  async assignAsset(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignAssetDto,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.assignAsset(tenantId, id, dto, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Post(':id/return')
  @RequirePermissions(Permission.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Return an assigned asset back to inventory' })
  async returnAsset(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReturnAssetDto,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.returnAsset(tenantId, id, dto, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Post(':id/maintenance')
  @RequirePermissions(Permission.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Send an asset for maintenance or repair' })
  async sendToMaintenance(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MaintenanceAssetDto,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.sendToMaintenance(tenantId, id, dto, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Post(':id/repair-done')
  @RequirePermissions(Permission.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Complete maintenance and return asset to available inventory' })
  async completeRepair(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RepairAssetDto,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.completeRepair(tenantId, id, dto, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Post(':id/retire')
  @RequirePermissions(Permission.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Decommission/retire an asset' })
  async retireAsset(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RetireAssetDto,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.retireAsset(tenantId, id, dto, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Delete(':id')
  @RequirePermissions(Permission.ASSETS_MANAGE)
  @ApiOperation({ summary: 'Delete an unused asset with no assignment history' })
  async deleteAsset(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const tenantId = this.resolveTenantId(req);
    return this.assetsService.deleteAsset(tenantId, id, {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  }
}
