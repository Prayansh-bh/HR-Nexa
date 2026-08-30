import { Role } from '../../modules/auth/role.enum';

export interface MessagingUser {
  id: string;
  role: string;
  companyId?: string | null;
  subscriptionId?: string | null;
}

export function canSendMessage(
  sender: MessagingUser,
  receiver: MessagingUser,
): boolean {
  const senderCompany = sender.companyId || sender.subscriptionId;
  const receiverCompany = receiver.companyId || receiver.subscriptionId;

  const isSameTenant = Boolean(
    senderCompany && receiverCompany && senderCompany === receiverCompany,
  );

  const isPlatformSender =
    sender.role === Role.SuperAdmin &&
    (receiver.role === Role.HRAdmin || receiver.role === Role.CompanyOwner);

  const isPlatformReceiver =
    receiver.role === Role.SuperAdmin &&
    (sender.role === Role.HRAdmin || sender.role === Role.CompanyOwner);

  return isSameTenant || isPlatformSender || isPlatformReceiver;
}
