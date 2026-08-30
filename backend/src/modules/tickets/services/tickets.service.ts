import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TicketsRepository } from '../repositories/tickets.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupportTicket } from '@prisma/client';
import {
  SUPPORT_TICKET_STATUSES,
  isValidStatusTransition,
  ALLOWED_STATUS_TRANSITIONS,
  SupportTicketStatus,
} from '../dto/update-ticket-status.dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getAllTickets(companyId?: string | null, options?: { page?: number; limit?: number }) {
    if (!companyId) {
      return this.ticketsRepository.findAll(null, { ...options, isDemo: false });
    }
    return this.ticketsRepository.findAll(companyId, options);
  }

  async findOne(id: string, companyId?: string | null): Promise<SupportTicket> {
    const ticket = await this.ticketsRepository.findById(id, companyId);
    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID "${id}" not found`);
    }
    return ticket;
  }

  async createTicket(data: {
    id?: string;
    company: string;
    subject: string;
    priority?: string;
    assignedTo?: string;
    status?: string;
    attachments?: number;
    date?: string;
  }): Promise<SupportTicket> {
    const id = data.id && data.id.trim() ? data.id.trim() : `T-${Date.now().toString().slice(-6)}`;
    const status = data.status && SUPPORT_TICKET_STATUSES.includes(data.status as any) ? data.status : 'Open';
    const date = data.date || new Date().toISOString().slice(0, 10);
    const priority = data.priority || 'Medium';
    const assignedTo = data.assignedTo || 'Support Team';
    const attachments = data.attachments ?? 0;

    const ticket = await this.ticketsRepository.create({
      id,
      company: data.company,
      subject: data.subject,
      priority,
      assignedTo,
      status,
      attachments,
      date,
    });

    // Seed initial message representing the customer's support request query
    try {
      await this.ticketsRepository.createMessage(
        ticket.id,
        ticket.company,
        `Issue reported: "${ticket.subject || 'Support request description not provided.'}"`,
      );
    } catch (e) {
      console.error('Failed to seed initial support ticket chat message:', e);
    }
    return ticket;
  }

  async updateTicketStatus(
    id: string,
    status: string,
    companyId?: string | null,
    userPermissions: string[] = [],
    isSuperAdmin: boolean = false,
  ): Promise<SupportTicket> {
    if (!status || !SUPPORT_TICKET_STATUSES.includes(status as any)) {
      throw new BadRequestException(
        `Invalid ticket status "${status}". Allowed values: ${SUPPORT_TICKET_STATUSES.join(', ')}`,
      );
    }
    const currentTicket = await this.findOne(id, companyId);

    if (!isValidStatusTransition(currentTicket.status, status)) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[currentTicket.status as SupportTicketStatus] || [];
      throw new BadRequestException(
        `Cannot transition ticket status from "${currentTicket.status}" to "${status}". Allowed next statuses: ${allowed.join(', ')}`,
      );
    }

    // Lifecycle-specific permission authorization checks
    if (status === 'Resolved' && !isSuperAdmin && !userPermissions.includes('support:tickets:resolve')) {
      throw new ForbiddenException('Insufficient permission to resolve support tickets. Required permission: support:tickets:resolve');
    }
    if (status === 'Closed' && !isSuperAdmin && !userPermissions.includes('support:tickets:close')) {
      throw new ForbiddenException('Insufficient permission to close support tickets. Required permission: support:tickets:close');
    }

    return this.ticketsRepository.update(id, { status });
  }

  async deleteTicket(id: string, companyId?: string | null, user?: any) {
    const ticket = await this.findOne(id, companyId);
    const actor = user?.id || user?.email || 'system';
    await this.ticketsRepository.softDelete(id, actor);

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user?.id || null,
          userName: user?.email || user?.name || 'System',
          actorId: actor,
          actorRole: user?.role || 'Employee',
          entityType: 'COMPANY_SETTINGS' as any,
          action: 'TICKET_DELETED' as any,
          companyId: ticket.company,
          details: JSON.stringify({
            ticketId: ticket.id,
            subject: ticket.subject,
            deletedBy: actor,
            deletedAt: new Date().toISOString(),
          }),
        },
      });
    } catch (e) {
      console.error('Failed to record TICKET_DELETED audit log:', e);
    }

    return { success: true, id };
  }

  async getTicketMessages(ticketId: string, companyId?: string | null) {
    await this.findOne(ticketId, companyId);
    return this.ticketsRepository.findMessagesByTicketId(ticketId);
  }

  async addTicketMessage(ticketId: string, sender: string, message: string, companyId?: string | null) {
    await this.findOne(ticketId, companyId);
    return this.ticketsRepository.createMessage(ticketId, sender, message);
  }

  async getTicketStats() {
    return this.ticketsRepository.countStats({ isDemo: false });
  }
}
