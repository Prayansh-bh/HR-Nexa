import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import {
  EffectiveFeatureService,
  SetTenantOverrideDto,
} from '../services/effective-feature.service';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

@ApiTags('Tenant Feature Overrides')
@Controller('companies/:companyId/feature-overrides')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantFeatureOverridesController {
  constructor(
    private readonly effectiveFeatureService: EffectiveFeatureService,
  ) {}

  /**
   * Get detailed feature overview (Plan, Override, Effective) for a specific company
   */
  @Get()
  @Roles(Role.SuperAdmin)
  @ApiOperation({
    summary:
      'Get tenant feature overview with plan defaults, overrides and effective states',
  })
  async getCompanyFeatures(@Param('companyId') companyId: string) {
    const features =
      await this.effectiveFeatureService.getDetailedFeatureOverview(companyId);
    return { companyId, features };
  }

  /**
   * Get effective features map { [featureKey]: boolean } for the company
   */
  @Get('effective')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Get effective feature map for a company' })
  async getEffectiveFeaturesMap(@Param('companyId') companyId: string) {
    const map =
      await this.effectiveFeatureService.getEffectiveFeatures(companyId);
    const obj: Record<string, boolean> = {};
    map.forEach((val, key) => {
      obj[key] = val;
    });
    return { companyId, effectiveFeatures: obj };
  }

  /**
   * Set or update a feature override for a specific company
   */
  @Put(':featureKey')
  @Roles(Role.SuperAdmin)
  @ApiOperation({
    summary: 'Set or update a tenant feature override (SuperAdmin only)',
  })
  async setOverride(
    @Param('companyId') companyId: string,
    @Param('featureKey') featureKey: string,
    @Body() body: SetTenantOverrideDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const override = await this.effectiveFeatureService.setTenantOverride(
      companyId,
      featureKey,
      body,
      req.user,
    );
    return { success: true, override };
  }

  /**
   * Remove a feature override to restore Plan inheritance
   */
  @Delete(':featureKey')
  @Roles(Role.SuperAdmin)
  @ApiOperation({
    summary: 'Remove a tenant feature override and restore plan default',
  })
  async removeOverride(
    @Param('companyId') companyId: string,
    @Param('featureKey') featureKey: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.effectiveFeatureService.removeTenantOverride(
      companyId,
      featureKey,
      req.user,
    );
    return { success: true, message: 'Override removed. Restored plan default.' };
  }
}
