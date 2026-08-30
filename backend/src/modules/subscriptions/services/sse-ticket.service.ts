import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface SseClientContext {
  userId: string;
  role: string;
  companyId: string | null;
  subscriptionId: string | null;
  isPlatform: boolean;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class SseTicketService {
  private readonly logger = new Logger(SseTicketService.name);
  private readonly tickets = new Map<string, SseClientContext>();
  private readonly TICKET_TTL_MS = 60 * 1000; // 60 seconds TTL

  constructor() {
    // Periodic garbage collection for expired tickets every 30 seconds
    const intervalId = setInterval(() => this.cleanupExpiredTickets(), 30000);
    if (intervalId.unref) {
      intervalId.unref();
    }
  }

  /**
   * Generates a cryptographically secure, single-use, short-lived ticket
   * bound strictly to the authenticated user identity and tenant context.
   */
  generateTicket(user: {
    id: string;
    role: string;
    companyId?: string | null;
    subscriptionId?: string | null;
  }): { ticket: string; expiresIn: number } {
    const ticket = `sse_tkt_${randomBytes(32).toString('hex')}`;
    const now = Date.now();
    const isPlatform = user.role === 'SuperAdmin';
    const companyId = isPlatform ? 'PLATFORM' : (user.companyId || null);
    const subscriptionId = isPlatform ? null : (user.subscriptionId || null);

    const context: SseClientContext = {
      userId: user.id,
      role: user.role,
      companyId,
      subscriptionId,
      isPlatform,
      createdAt: now,
      expiresAt: now + this.TICKET_TTL_MS,
    };

    this.tickets.set(ticket, context);
    return { ticket, expiresIn: 60 };
  }

  /**
   * Atomically validates and consumes the ticket on first use.
   * Replay attempts or expired tickets immediately return null.
   */
  consumeTicket(ticket: string | null | undefined): SseClientContext | null {
    if (!ticket || typeof ticket !== 'string' || !ticket.startsWith('sse_tkt_')) {
      return null;
    }

    // Atomic retrieve & single-use delete
    const context = this.tickets.get(ticket);
    this.tickets.delete(ticket);

    if (!context) {
      return null;
    }

    if (Date.now() > context.expiresAt) {
      return null;
    }

    return context;
  }

  /**
   * Active in-memory ticket count for diagnostics and telemetry.
   */
  getActiveTicketCount(): number {
    return this.tickets.size;
  }

  private cleanupExpiredTickets(): void {
    const now = Date.now();
    for (const [key, ctx] of this.tickets.entries()) {
      if (now > ctx.expiresAt) {
        this.tickets.delete(key);
      }
    }
  }
}
