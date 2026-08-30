import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { TenantGuard } from '../../../common/tenant/tenant.guard';
import { Roles } from '../../auth/roles.decorator';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Role } from '../../auth/role.enum';
import { IntegrationCredentialsService } from '../services/integration-credentials.service';
import {
  IntegrationProvider,
  SafeIntegrationCredentialResponse,
} from '../types/integration.types';
import { CreateIntegrationCredentialApiDto } from '../dto/create-integration.dto';
import { UpdateIntegrationCredentialApiDto } from '../dto/update-integration.dto';
import { SetIntegrationStatusApiDto } from '../dto/set-integration-status.dto';

const SUPPORTED_PROVIDERS = [
  IntegrationProvider.RAZORPAY,
  IntegrationProvider.AWS_S3,
  IntegrationProvider.SMTP_EMAIL,
];

@ApiTags('Integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, TenantGuard, PermissionsGuard)
@ApiBearerAuth()
export class IntegrationsController {

  constructor(
    private readonly credentialsService: IntegrationCredentialsService,
  ) {}

  /**
   * Derives trusted server-side companyId scope from authenticated identity.
   * Platform integrations are strictly managed at the Platform Scope (companyId = null) by SuperAdmin.
   */
  private getAuthorizedCompanyId(req: any): string | null {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const isSuperAdmin =
      user.role === Role.SuperAdmin ||
      user.role === 'SuperAdmin' ||
      user.role === 'superadmin';

    if (isSuperAdmin) {
      return null;
    }

    throw new ForbiddenException(
      'Platform cloud integrations are strictly restricted to SuperAdmin platform administrators.',
    );
  }

  /**
   * Validates that an existing credential record belongs to caller's authorized scope.
   */
  private async getValidatedCredentialForScope(
    id: string,
    authorizedCompanyId: string | null,
  ): Promise<SafeIntegrationCredentialResponse> {
    let record: SafeIntegrationCredentialResponse;
    try {
      record = await this.credentialsService.getCredentialById(id);
    } catch (err: any) {
      this.handleServiceError(err);
    }

    if (authorizedCompanyId === null) {
      // SuperAdmin managing platform credential
      if (record.companyId !== null) {
        throw new ForbiddenException(
          'Tenant integration credential cannot be managed through platform credential endpoint',
        );
      }
    } else {
      throw new ForbiddenException(
        'Access to integration credentials is restricted to SuperAdmin platform administrators',
      );
    }

    return record;
  }

  /**
   * Map application/service errors to NestJS HTTP Exceptions
   */
  private handleServiceError(err: any): never {
    const msg = err?.message || 'Integration service error';

    if (
      msg.includes('already exists') ||
      msg.includes('unique constraint') ||
      err?.code === 'P2002'
    ) {
      throw new ConflictException(msg);
    }
    if (
      msg.includes('Security violation') ||
      msg.includes('Missing required') ||
      msg.includes('Unsupported')
    ) {
      throw new BadRequestException(msg);
    }
    if (msg.includes('not found')) {
      throw new NotFoundException(msg);
    }
    if (msg.includes('forbidden') || msg.includes('scope')) {
      throw new ForbiddenException(msg);
    }

    throw new BadRequestException(msg);
  }

  @Get()
  @Roles(Role.SuperAdmin)
  @RequirePermissions(Permission.INTEGRATIONS_VIEW)
  @ApiOperation({ summary: 'List integration credentials in authorized scope' })
  async listCredentials(@Request() req: any) {
    const companyId = this.getAuthorizedCompanyId(req);
    return this.credentialsService.listCredentials(companyId);
  }

  @Get(':id')
  @Roles(Role.SuperAdmin)
  @RequirePermissions(Permission.INTEGRATIONS_VIEW)
  @ApiOperation({ summary: 'Get integration credential by ID' })
  async getCredential(@Param('id') id: string, @Request() req: any) {
    const companyId = this.getAuthorizedCompanyId(req);
    return this.getValidatedCredentialForScope(id, companyId);
  }

  @Post()
  @Roles(Role.SuperAdmin)
  @RequirePermissions(Permission.INTEGRATIONS_MANAGE)
  @ApiOperation({ summary: 'Create integration credential for supported provider' })
  async createCredential(
    @Body() dto: CreateIntegrationCredentialApiDto,
    @Request() req: any,
  ) {
    const companyId = this.getAuthorizedCompanyId(req);

    if (!SUPPORTED_PROVIDERS.includes(dto.provider)) {
      throw new BadRequestException(
        `Unsupported integration provider: ${dto.provider}. Supported providers: RAZORPAY, AWS_S3, SMTP_EMAIL`,
      );
    }

    try {
      return await this.credentialsService.createCredential({
        provider: dto.provider,
        name: dto.name,
        companyId, // Server-side trusted companyId (null for SuperAdmin)
        config: dto.config,
        secrets: dto.secrets || {},
        createdById: req.user?.id || null,
      });
    } catch (err: any) {
      this.handleServiceError(err);
    }
  }

  @Patch(':id')
  @Roles(Role.SuperAdmin)
  @RequirePermissions(Permission.INTEGRATIONS_MANAGE)
  @ApiOperation({ summary: 'Update integration credential configuration or secrets' })
  async updateCredential(
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationCredentialApiDto,
    @Request() req: any,
  ) {
    const companyId = this.getAuthorizedCompanyId(req);
    await this.getValidatedCredentialForScope(id, companyId);

    try {
      return await this.credentialsService.updateCredential(id, {
        name: dto.name,
        config: dto.config,
        secrets: dto.secrets,
      });
    } catch (err: any) {
      this.handleServiceError(err);
    }
  }

  @Patch(':id/status')
  @Roles(Role.SuperAdmin)
  @RequirePermissions(Permission.INTEGRATIONS_MANAGE)
  @ApiOperation({ summary: 'Enable or disable integration credential' })
  async setStatus(
    @Param('id') id: string,
    @Body() dto: SetIntegrationStatusApiDto,
    @Request() req: any,
  ) {
    const companyId = this.getAuthorizedCompanyId(req);
    await this.getValidatedCredentialForScope(id, companyId);

    try {
      return await this.credentialsService.setCredentialStatus(id, dto.enabled);
    } catch (err: any) {
      this.handleServiceError(err);
    }
  }

  @Delete(':id')
  @Roles(Role.SuperAdmin)
  @RequirePermissions(Permission.INTEGRATIONS_MANAGE)
  @ApiOperation({ summary: 'Delete integration credential' })
  async deleteCredential(@Param('id') id: string, @Request() req: any) {
    const companyId = this.getAuthorizedCompanyId(req);
    await this.getValidatedCredentialForScope(id, companyId);

    try {
      await this.credentialsService.deleteCredential(id);
      return {
        success: true,
        message: `Integration credential [${id}] successfully deleted.`,
      };
    } catch (err: any) {
      this.handleServiceError(err);
    }
  }

}

