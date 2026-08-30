export const QUEUE_NAMES = {
  PAYROLL: 'payroll-queue',
  EMAIL: 'email-queue',
  NOTIFICATION: 'notification-queue',
  REPORT: 'report-queue',
  ATTENDANCE_SYNC: 'attendance-sync-queue',
  EMPLOYEE_SYNC: 'employee-sync-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const DLQ_NAMES = {
  PAYROLL: 'payroll-queue-dlq',
  EMAIL: 'email-queue-dlq',
  NOTIFICATION: 'notification-queue-dlq',
  REPORT: 'report-queue-dlq',
  ATTENDANCE_SYNC: 'attendance-sync-queue-dlq',
  EMPLOYEE_SYNC: 'employee-sync-queue-dlq',
} as const;

export type DLQName = (typeof DLQ_NAMES)[keyof typeof DLQ_NAMES];

export const QUEUE_TO_DLQ_MAP: Record<QueueName, DLQName> = {
  [QUEUE_NAMES.PAYROLL]: DLQ_NAMES.PAYROLL,
  [QUEUE_NAMES.EMAIL]: DLQ_NAMES.EMAIL,
  [QUEUE_NAMES.NOTIFICATION]: DLQ_NAMES.NOTIFICATION,
  [QUEUE_NAMES.REPORT]: DLQ_NAMES.REPORT,
  [QUEUE_NAMES.ATTENDANCE_SYNC]: DLQ_NAMES.ATTENDANCE_SYNC,
  [QUEUE_NAMES.EMPLOYEE_SYNC]: DLQ_NAMES.EMPLOYEE_SYNC,
};

export const DEFAULT_BULLMQ_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};
