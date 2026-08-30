import {
  Controller,
  Post,
  Sse,
  MessageEvent,
  Logger,
  UseGuards,
  Request,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, interval } from 'rxjs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { SseTicketService, SseClientContext } from '../services/sse-ticket.service';
import { COMPANY_EVENTS } from '../../../common/events/company.events';
import { EMPLOYEE_EVENTS } from '../../../common/events/employee.events';
import { ATTENDANCE_EVENTS } from '../../../common/events/attendance.events';
import { PLAN_EVENTS } from '../../../common/events/plan.events';
import { PERFORMANCE_EVENTS } from '../../../common/events/performance.events';
import { ROLE_USER_EVENTS } from '../../../common/events/roles-users.events';
import { LEAVE_EVENTS } from '../../../common/events/leave.events';

@Controller('subscriptions')
export class SubscriptionsRealtimeController {
  private readonly logger = new Logger(SubscriptionsRealtimeController.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly sseTicketService: SseTicketService,
  ) {}

  /**
   * Generates a short-lived (60s), single-use SSE ticket for an authenticated user.
   * Keeps the primary 24h JWT out of browser EventSource URLs and server access logs.
   */
  @Post('realtime/ticket')
  @UseGuards(JwtAuthGuard)
  generateSseTicket(@Request() req: AuthenticatedRequest): { ticket: string; expiresIn: number } {
    return this.sseTicketService.generateTicket(req.user);
  }

  /**
   * Realtime SSE Stream.
   * Authenticates by atomically consuming the single-use ticket from query parameters.
   * Enforces server-side tenant isolation so clients only receive events matching their company.
   */
  @Sse('realtime/stream')
  streamEvents(@Query('ticket') ticket?: string): Observable<MessageEvent> {
    const clientContext = this.sseTicketService.consumeTicket(ticket);
    if (!clientContext) {
      throw new UnauthorizedException('Invalid, expired, or missing SSE authentication ticket');
    }

    return new Observable<MessageEvent>((subscriber) => {
      const eventNames = [
        ...Object.values(COMPANY_EVENTS),
        ...Object.values(EMPLOYEE_EVENTS),
        ...Object.values(ATTENDANCE_EVENTS),
        ...Object.values(PLAN_EVENTS),
        ...Object.values(PERFORMANCE_EVENTS),
        ...Object.values(ROLE_USER_EVENTS),
        ...Object.values(LEAVE_EVENTS),
      ];
      const listeners: {
        eventName: string;
        listener: (...args: any[]) => void;
      }[] = [];

      eventNames.forEach((eventName) => {
        const listener = (payload: any) => {
          const delivery = this.evaluateEventDelivery(eventName, payload, clientContext);
          if (delivery.shouldDeliver) {
            subscriber.next({
              data: {
                type: eventName,
                ...(delivery.payload !== undefined ? { payload: delivery.payload } : {}),
                timestamp: new Date().toISOString(),
              },
            });
          }
        };

        this.eventEmitter.on(eventName, listener);
        listeners.push({ eventName, listener });
      });

      this.logger.log(
        `[SubscriptionsRealtimeController] Client connected (User: ${clientContext.userId}, Role: ${clientContext.role}, Company: ${clientContext.companyId})`,
      );

      // Heartbeat interval every 25 seconds to keep connection alive
      const heartbeatSub = interval(25000).subscribe(() => {
        subscriber.next({
          data: {
            type: 'ping',
            timestamp: new Date().toISOString(),
          },
        });
      });

      // Cleanup when connection closes or client disconnects
      return () => {
        this.logger.log(
          `[SubscriptionsRealtimeController] Client disconnected (User: ${clientContext.userId})`,
        );
        heartbeatSub.unsubscribe();
        listeners.forEach(({ eventName, listener }) => {
          this.eventEmitter.off(eventName, listener);
        });
      };
    });
  }

  /**
   * Server-side Tenant Isolation & Payload Sanitization Evaluator.
   * Strictly prevents cross-tenant data leakage in SSE broadcast payloads.
   */
  private evaluateEventDelivery(
    eventName: string,
    payload: any,
    client: SseClientContext,
  ): { shouldDeliver: boolean; payload?: any } {
    // 1. Platform-global plan events: deliver sanitized invalidation signal
    if (eventName.startsWith('plan.')) {
      return {
        shouldDeliver: true,
        payload: payload?.id || payload?.planId ? { id: payload?.id || payload?.planId } : undefined,
      };
    }

    // 2. Extract tenant ownership identifier from event payload
    const eventCompanyId =
      payload?.companyId ||
      payload?.subscriptionId ||
      payload?.tenantId ||
      payload?.company?.id;

    // 3. SuperAdmin clients receive platform & administrative events
    if (client.isPlatform || client.role === Role.SuperAdmin) {
      return { shouldDeliver: true, payload };
    }

    // 4. For tenant users with explicit company ID:
    if (eventCompanyId && typeof eventCompanyId === 'string') {
      const isMatch =
        eventCompanyId === client.companyId ||
        eventCompanyId === client.subscriptionId;

      return {
        shouldDeliver: isMatch,
        payload: isMatch ? payload : undefined,
      };
    }

    // 5. If tenant identity is absent, convert to tenant-neutral invalidation signal
    // (no sensitive raw payload data broadcast)
    return {
      shouldDeliver: true,
      payload: undefined,
    };
  }
}
