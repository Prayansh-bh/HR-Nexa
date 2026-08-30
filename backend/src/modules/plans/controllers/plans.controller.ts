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
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { PlansService } from '../services/plans.service';

@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('selectable')
  @Roles(Role.SuperAdmin)
  async getSelectablePlans() {
    return this.plansService.getSelectablePlans();
  }

  @Get()
  @Roles(Role.SuperAdmin)
  async getPlans() {
    return this.plansService.getPlans();
  }

  @Get('stats/dashboard')
  @Roles(Role.SuperAdmin)
  async getEnrichedDashboardStats() {
    return this.plansService.getEnrichedDashboardStats();
  }

  @Get('features/library')
  @Roles(Role.SuperAdmin)
  async getFeatureLibrary() {
    return this.plansService.getFeatureLibrary();
  }

  @Post('features')
  @Roles(Role.SuperAdmin)
  async createFeature(@Body() body: any) {
    return this.plansService.createFeature(body);
  }

  @Post('features/categories')
  @Roles(Role.SuperAdmin)
  async createCategory(@Body() body: any) {
    return this.plansService.createCategory(body);
  }

  @Get('add-ons')
  @Roles(Role.SuperAdmin)
  async getAddOns() {
    return this.plansService.getAddOns();
  }

  @Post('add-ons')
  @Roles(Role.SuperAdmin)
  async createAddOn(@Body() body: any) {
    return this.plansService.createAddOn(body);
  }

  @Get('resolve/:company')
  async resolveCompanyFeatures(
    @Param('company') company: string,
    @Request() req: any,
  ) {
    const user = req.user;
    if (user.role !== Role.SuperAdmin) {
      const userTenant = user.companyId || user.subscriptionId;
      if (!userTenant || userTenant.toLowerCase() !== company.toLowerCase()) {
        throw new NotFoundException(
          `Company features for "${company}" not found`,
        );
      }
    }
    return this.plansService.resolveCompanyFeatures(company);
  }

  @Get('audit-logs')
  @Roles(Role.SuperAdmin)
  async getAuditLogs() {
    return this.plansService.getAuditLogs();
  }

  @Post()
  @Roles(Role.SuperAdmin)
  async createPlan(@Body() body: any) {
    return this.plansService.createPlan(body);
  }

  @Post(':id/publish')
  @Roles(Role.SuperAdmin)
  async publishPlanVersion(
    @Param('id') id: string,
    @Body('changelog') changelog?: string,
  ) {
    return this.plansService.publishPlanVersion(id, changelog);
  }

  @Post(':id/clone')
  @Roles(Role.SuperAdmin)
  async clonePlan(@Param('id') id: string, @Body('name') newName: string) {
    return this.plansService.clonePlan(id, newName);
  }

  @Put(':name')
  @Roles(Role.SuperAdmin)
  async updatePlan(@Param('name') name: string, @Body() body: any) {
    return this.plansService.updatePlan(name, body);
  }

  @Post(':id/archive')
  @Roles(Role.SuperAdmin)
  async archivePlan(@Param('id') id: string) {
    return this.plansService.archivePlan(id);
  }

  @Post(':id/restore')
  @Roles(Role.SuperAdmin)
  async restorePlan(@Param('id') id: string) {
    return this.plansService.restorePlan(id);
  }

  @Delete(':id/permanent')
  @Roles(Role.SuperAdmin)
  async permanentlyDeletePlan(@Param('id') id: string) {
    return this.plansService.permanentlyDeletePlan(id);
  }

  @Delete(':id/draft')
  @Roles(Role.SuperAdmin)
  async deleteDraftPlan(@Param('id') id: string) {
    return this.plansService.deleteDraftPlan(id);
  }

  @Delete(':name')
  @Roles(Role.SuperAdmin)
  async deletePlan(@Param('name') name: string) {
    return this.plansService.deletePlan(name);
  }
}
