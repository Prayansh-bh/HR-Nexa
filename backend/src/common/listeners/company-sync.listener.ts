import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import {
  EmployeeCreatedEvent,
  EmployeeDeletedEvent,
  EmployeeStatusChangedEvent,
  EMPLOYEE_EVENTS,
} from '../events/employee.events';
import {
  COMPANY_EVENTS,
  EmployeeCountChangedEvent,
} from '../events/company.events';
import { EmployeeCountSyncService } from '../../modules/subscriptions/services/employee-count-sync.service';

/**
 * CompanySyncListener
 *
 * Listens to employee domain events and automatically routes them
 * to the central EmployeeCountSyncService using EmployeeCountChangedEvent.
 */
@Injectable()
export class CompanySyncListener {
  private readonly logger = new Logger(CompanySyncListener.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly employeeCountSyncService: EmployeeCountSyncService,
  ) {}

  @OnEvent(COMPANY_EVENTS.EMPLOYEE_COUNT_CHANGED)
  async handleEmployeeCountChanged(
    event: EmployeeCountChangedEvent,
  ): Promise<void> {
    this.logger.log(
      `[CompanySync] Routing count change sync for company "${event.companyId}" (Source: ${event.source})`,
    );
    this.employeeCountSyncService.syncCompanyDebounced(
      event.companyId,
      event.source,
    );
  }

  @OnEvent(EMPLOYEE_EVENTS.CREATED)
  async handleEmployeeCreated(event: EmployeeCreatedEvent): Promise<void> {
    this.logger.log(
      `[CompanySync] Employee created: ${event.employeeId} (${event.employeeName})`,
    );
    if (event.companyId) {
      this.eventEmitter.emit(
        COMPANY_EVENTS.EMPLOYEE_COUNT_CHANGED,
        new EmployeeCountChangedEvent(event.companyId, 'EmployeeCreatedEvent'),
      );
    } else {
      this.logger.warn(
        `[CompanySync] Skip created event: companyId is missing for employee ${event.employeeId}`,
      );
    }
  }

  @OnEvent(EMPLOYEE_EVENTS.DELETED)
  async handleEmployeeDeleted(event: EmployeeDeletedEvent): Promise<void> {
    this.logger.log(`[CompanySync] Employee deleted: ${event.employeeId}`);
    if (event.companyId) {
      this.eventEmitter.emit(
        COMPANY_EVENTS.EMPLOYEE_COUNT_CHANGED,
        new EmployeeCountChangedEvent(event.companyId, 'EmployeeDeletedEvent'),
      );
    } else {
      this.logger.warn(
        `[CompanySync] Skip deleted event: companyId is missing for employee ${event.employeeId}`,
      );
    }
  }

  @OnEvent(EMPLOYEE_EVENTS.STATUS_CHANGED)
  async handleEmployeeStatusChanged(
    event: EmployeeStatusChangedEvent,
  ): Promise<void> {
    this.logger.log(
      `[CompanySync] Employee status changed: ${event.employeeId} -> ${event.newStatus}`,
    );
    if (event.companyId) {
      this.eventEmitter.emit(
        COMPANY_EVENTS.EMPLOYEE_COUNT_CHANGED,
        new EmployeeCountChangedEvent(
          event.companyId,
          'EmployeeStatusChangedEvent',
        ),
      );
    } else {
      this.logger.warn(
        `[CompanySync] Skip status change event: companyId is missing for employee ${event.employeeId}`,
      );
    }
  }
}
