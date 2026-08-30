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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { Roles } from '../../auth/roles.decorator';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Role } from '../../auth/role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { TicketsService } from '../services/tickets.service';

import { UpdateTicketStatusDto } from '../dto/update-ticket-status.dto';

@ApiTags('Support Tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  private resolveAuthenticatedTenantId(req: AuthenticatedRequest): string | null {
    if (req.user.role === Role.SuperAdmin) return null;
    const companyId = req.user.companyId;
    if (!companyId || typeof companyId !== 'string' || companyId.trim().length === 0) {
      throw new ForbiddenException('Tenant context (companyId) is required for this operation');
    }
    return companyId.trim();
  }

  @Get()
  @RequirePermissions(Permission.SUPPORT_TICKETS_VIEW)
  @ApiOperation({ summary: 'Get all support tickets' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllTickets(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const companyId = this.resolveAuthenticatedTenantId(req);
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.ticketsService.getAllTickets(companyId, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Post()
  @RequirePermissions(Permission.SUPPORT_TICKETS_CREATE)
  @ApiOperation({ summary: 'Create a new support ticket' })
  async createTicket(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      id?: string;
      company?: string;
      subject: string;
      priority?: string;
      assignedTo?: string;
      status?: string;
      attachments?: number;
      date?: string;
    },
  ) {
    const companyId = this.resolveAuthenticatedTenantId(req);
    const company = companyId || body.company || 'Tenant Company';
    return this.ticketsService.createTicket({
      ...body,
      company,
    });
  }

  @Put(':id/status')
  @RequirePermissions(Permission.SUPPORT_TICKETS_STATUS)
  @ApiOperation({ summary: 'Update ticket status' })
  async updateStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    const companyId = this.resolveAuthenticatedTenantId(req);
    const userPermissions: string[] = (req.user as any).permissions || [];
    const isSuperAdmin = req.user.role === Role.SuperAdmin;
    return this.ticketsService.updateTicketStatus(
      id,
      dto.status,
      companyId,
      userPermissions,
      isSuperAdmin,
    );
  }

  @Get(':id/messages')
  @RequirePermissions(Permission.SUPPORT_TICKETS_MESSAGE)
  @ApiOperation({ summary: 'Get all chat messages for a ticket' })
  async getMessages(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = this.resolveAuthenticatedTenantId(req);
    return this.ticketsService.getTicketMessages(id, companyId);
  }

  @Post(':id/messages')
  @RequirePermissions(Permission.SUPPORT_TICKETS_MESSAGE)
  @ApiOperation({ summary: 'Add a chat message to a ticket' })
  async addMessage(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { message: string; sender?: string },
  ) {
    const companyId = this.resolveAuthenticatedTenantId(req);
    const sender = (req.user as any).name || req.user.email || 'Support';
    return this.ticketsService.addTicketMessage(id, sender, body.message, companyId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.SUPPORT_TICKETS_DELETE)
  @ApiOperation({ summary: 'Soft delete a support ticket' })
  async deleteTicket(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = this.resolveAuthenticatedTenantId(req);
    return this.ticketsService.deleteTicket(id, companyId, req.user);
  }
}
