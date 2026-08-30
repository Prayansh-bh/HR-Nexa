import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export const SUPPORT_TICKET_STATUSES = [
  'Open',
  'In Progress',
  'Resolved',
  'Closed',
] as const;

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const ALLOWED_STATUS_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  Open: ['In Progress', 'Resolved', 'Closed'],
  'In Progress': ['Resolved', 'Closed', 'Open'],
  Resolved: ['In Progress', 'Closed'],
  Closed: ['Open', 'In Progress'],
};

export function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  if (currentStatus === newStatus) return true;
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus as SupportTicketStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus as SupportTicketStatus);
}

export class UpdateTicketStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(SUPPORT_TICKET_STATUSES as unknown as string[], {
    message: `Status must be one of: ${SUPPORT_TICKET_STATUSES.join(', ')}`,
  })
  status!: string;
}
