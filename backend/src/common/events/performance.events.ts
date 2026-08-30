/**
 * Performance Domain Events
 */

export const PERFORMANCE_EVENTS = {
  CYCLE_CREATED: 'review_cycle.created',
  CYCLE_UPDATED: 'review_cycle.updated',
  CYCLE_DELETED: 'review_cycle.deleted',
  REVIEW_CREATED: 'performance.review.created',
  REVIEW_UPDATED: 'performance.review.updated',
  REVIEW_COMPLETED: 'performance.review.completed',
  RATING_UPDATED: 'performance.rating.updated',
  ANALYTICS_UPDATED: 'dashboard.analytics.updated',
} as const;

export class PerformanceEvent {
  constructor(
    public readonly type: string,
    public readonly payload: any,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}
