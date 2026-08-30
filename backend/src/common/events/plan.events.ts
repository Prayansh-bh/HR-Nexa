/**
 * Plan Domain Events
 */

export class PlanCreatedEvent {
  constructor(
    public readonly planId: string,
    public readonly planName: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class PlanUpdatedEvent {
  constructor(
    public readonly planId: string,
    public readonly planName: string,
    public readonly changes?: Record<string, any>,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class PlanDeletedEvent {
  constructor(
    public readonly planId: string,
    public readonly planName: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export const PLAN_EVENTS = {
  CREATED: 'plan.created',
  UPDATED: 'plan.updated',
  DELETED: 'plan.deleted',
} as const;
