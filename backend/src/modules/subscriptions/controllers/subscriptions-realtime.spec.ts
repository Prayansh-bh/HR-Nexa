import { EventEmitter2 } from '@nestjs/event-emitter';
import { UnauthorizedException } from '@nestjs/common';
import { SubscriptionsRealtimeController } from './subscriptions-realtime.controller';
import { SseTicketService, SseClientContext } from '../services/sse-ticket.service';
import { Role } from '../../auth/role.enum';
import { EMPLOYEE_EVENTS } from '../../../common/events/employee.events';
import { PLAN_EVENTS } from '../../../common/events/plan.events';
import { take } from 'rxjs/operators';

describe('SubscriptionsRealtimeController & SseTicketService (Security-First Realtime SSE)', () => {
  let controller: SubscriptionsRealtimeController;
  let sseTicketService: SseTicketService;
  let eventEmitter: EventEmitter2;

  beforeEach(() => {
    eventEmitter = new EventEmitter2();
    sseTicketService = new SseTicketService();
    controller = new SubscriptionsRealtimeController(eventEmitter, sseTicketService);
  });

  describe('SseTicketService Security Invariants', () => {
    it('1. should generate a cryptographically random ticket with 60s expiration', () => {
      const res = sseTicketService.generateTicket({
        id: 'user-123',
        role: Role.HRAdmin,
        companyId: 'C1',
        subscriptionId: 'C1',
      });

      expect(res.ticket).toBeDefined();
      expect(res.ticket.startsWith('sse_tkt_')).toBe(true);
      expect(res.expiresIn).toBe(60);
    });

    it('2. should atomically consume ticket on first use (single-use replay prevention)', () => {
      const { ticket } = sseTicketService.generateTicket({
        id: 'user-123',
        role: Role.HRAdmin,
        companyId: 'C1',
      });

      const firstConsumption = sseTicketService.consumeTicket(ticket);
      expect(firstConsumption).toBeDefined();
      expect(firstConsumption?.userId).toBe('user-123');
      expect(firstConsumption?.companyId).toBe('C1');

      // Replay attempt MUST return null
      const replayAttempt = sseTicketService.consumeTicket(ticket);
      expect(replayAttempt).toBeNull();
    });

    it('3. should reject expired tickets', () => {
      const { ticket } = sseTicketService.generateTicket({
        id: 'user-123',
        role: Role.HRAdmin,
        companyId: 'C1',
      });

      // Manually simulate expiration
      const internalContext = (sseTicketService as any).tickets.get(ticket);
      if (internalContext) {
        internalContext.expiresAt = Date.now() - 5000;
      }

      const res = sseTicketService.consumeTicket(ticket);
      expect(res).toBeNull();
    });

    it('4. should reject malformed or unknown tickets', () => {
      expect(sseTicketService.consumeTicket('')).toBeNull();
      expect(sseTicketService.consumeTicket(null as any)).toBeNull();
      expect(sseTicketService.consumeTicket('invalid_token')).toBeNull();
      expect(sseTicketService.consumeTicket('sse_tkt_unknown')).toBeNull();
    });
  });

  describe('SubscriptionsRealtimeController Stream & Tenant Isolation', () => {
    it('5. should reject SSE connection without ticket or with invalid ticket with 401 Unauthorized', () => {
      expect(() => controller.streamEvents(undefined)).toThrow(UnauthorizedException);
      expect(() => controller.streamEvents('sse_tkt_fake')).toThrow(UnauthorizedException);
    });

    it('6. should allow connection with valid ticket', (done) => {
      const { ticket } = sseTicketService.generateTicket({
        id: 'user-c1',
        role: Role.HRAdmin,
        companyId: 'C1',
      });

      const observable = controller.streamEvents(ticket);
      expect(observable).toBeDefined();

      const sub = observable.subscribe((event) => {
        expect(event).toBeDefined();
      });

      sub.unsubscribe();
      done();
    });

    it('7. should deliver C1 employee events ONLY to C1 client and NOT to BGJV client', (done) => {
      const ticketC1 = sseTicketService.generateTicket({
        id: 'user-c1',
        role: Role.HRAdmin,
        companyId: 'C1',
      }).ticket;

      const ticketBGJV = sseTicketService.generateTicket({
        id: 'user-bgjv',
        role: Role.HRAdmin,
        companyId: '9fb74c19-e26e-44f3-9e21-d47fca983f3b',
      }).ticket;

      let c1Received = false;
      let bgjvReceived = false;

      const subC1 = controller.streamEvents(ticketC1).subscribe((msg: any) => {
        if (msg.data.type === EMPLOYEE_EVENTS.CREATED) {
          c1Received = true;
        }
      });

      const subBGJV = controller.streamEvents(ticketBGJV).subscribe((msg: any) => {
        if (msg.data.type === EMPLOYEE_EVENTS.CREATED) {
          bgjvReceived = true;
        }
      });

      // Emit event for tenant C1
      eventEmitter.emit(EMPLOYEE_EVENTS.CREATED, {
        employeeId: 'emp-1',
        companyId: 'C1',
        name: 'Demo Employee',
      });

      setTimeout(() => {
        subC1.unsubscribe();
        subBGJV.unsubscribe();

        expect(c1Received).toBe(true);
        expect(bgjvReceived).toBe(false); // BGJV MUST NOT receive C1 event!
        done();
      }, 50);
    });

    it('8. should deliver BGJV employee events ONLY to BGJV client and NOT to C1 client', (done) => {
      const ticketC1 = sseTicketService.generateTicket({
        id: 'user-c1',
        role: Role.HRAdmin,
        companyId: 'C1',
      }).ticket;

      const ticketBGJV = sseTicketService.generateTicket({
        id: 'user-bgjv',
        role: Role.HRAdmin,
        companyId: '9fb74c19-e26e-44f3-9e21-d47fca983f3b',
      }).ticket;

      let c1Received = false;
      let bgjvReceived = false;

      const subC1 = controller.streamEvents(ticketC1).subscribe((msg: any) => {
        if (msg.data.type === EMPLOYEE_EVENTS.CREATED) {
          c1Received = true;
        }
      });

      const subBGJV = controller.streamEvents(ticketBGJV).subscribe((msg: any) => {
        if (msg.data.type === EMPLOYEE_EVENTS.CREATED) {
          bgjvReceived = true;
        }
      });

      // Emit event for tenant BGJV
      eventEmitter.emit(EMPLOYEE_EVENTS.CREATED, {
        employeeId: 'emp-2',
        companyId: '9fb74c19-e26e-44f3-9e21-d47fca983f3b',
        name: 'BGJV Employee',
      });

      setTimeout(() => {
        subC1.unsubscribe();
        subBGJV.unsubscribe();

        expect(c1Received).toBe(false); // C1 MUST NOT receive BGJV event!
        expect(bgjvReceived).toBe(true);
        done();
      }, 50);
    });

    it('9. should deliver platform plan events to SuperAdmin', (done) => {
      const ticketSuperAdmin = sseTicketService.generateTicket({
        id: 'super-admin-id',
        role: Role.SuperAdmin,
        companyId: null,
      }).ticket;

      let received = false;

      const sub = controller.streamEvents(ticketSuperAdmin).subscribe((msg: any) => {
        if (msg.data.type === PLAN_EVENTS.CREATED) {
          received = true;
        }
      });

      eventEmitter.emit(PLAN_EVENTS.CREATED, {
        planId: 'plan-enterprise',
        planName: 'Enterprise Plan',
      });

      setTimeout(() => {
        sub.unsubscribe();
        expect(received).toBe(true);
        done();
      }, 50);
    });

    it('10. should prevent EventEmitter listener memory leaks over 10 reconnect cycles', () => {
      const initialListenerCount = eventEmitter.listenerCount(EMPLOYEE_EVENTS.CREATED);

      for (let i = 0; i < 10; i++) {
        const ticket = sseTicketService.generateTicket({
          id: `user-${i}`,
          role: Role.HRAdmin,
          companyId: 'C1',
        }).ticket;

        const observable = controller.streamEvents(ticket);
        const subscription = observable.subscribe();
        // Immediately disconnect/reconnect
        subscription.unsubscribe();
      }

      const finalListenerCount = eventEmitter.listenerCount(EMPLOYEE_EVENTS.CREATED);
      expect(finalListenerCount).toBe(initialListenerCount); // Clean zero leak!
    });
  });
});
