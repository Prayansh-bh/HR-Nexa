import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboxPublisherService } from '../../../common/queue/outbox-publisher.service';

@Injectable()
export class NotificationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly outboxPublisher?: OutboxPublisherService,
  ) {}

  async createAnnouncement(
    subscriptionId: string | null,
    data: {
      title: string;
      content: string;
      author: string;
      date: string;
      type?: string;
      scheduledFor?: string | Date;
      duration?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ann = await tx.announcement.create({
        data: {
          title: data.title,
          content: data.content,
          author: data.author,
          date: data.date,
          subscriptionId,
          type: data.type || 'Notice',
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
          duration: data.duration || null,
        },
      });

      let targetCompany = 'All Employees';
      if (subscriptionId) {
        const companyRecord = await tx.company.findUnique({
          where: { id: subscriptionId },
        });
        if (companyRecord) {
          targetCompany = companyRecord.name;
        }
      }

      // Map severity according to category
      let severity: string = 'info';
      const normalizedType = (data.type || '').toLowerCase();
      if (normalizedType.includes('security')) {
        severity = 'critical';
      } else if (normalizedType.includes('maintenance')) {
        severity = 'warning';
      } else if (normalizedType.includes('release')) {
        severity = 'info';
      }

      let scheduleInfo = '';
      if (data.scheduledFor) {
        const dt = new Date(data.scheduledFor);
        scheduleInfo = `Scheduled: ${dt.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
        if (data.duration) {
          scheduleInfo += ` (${data.duration})`;
        }
      }

      await (tx as any).systemNotification
        .create({
          data: {
            title: `[${data.type || 'Notice'}] ${data.title}`,
            message: data.content,
            severity,
            category: 'system',
            company: targetCompany,
            reason: `Published by ${data.author}${scheduleInfo ? ` • ${scheduleInfo}` : ''}`,
            recommendedAction: 'View Corporate Announcements',
            linkUrl: 'announcements',
            read: false,
            timestamp: new Date(),
          },
        })
        .catch(() => null);

      if (this.outboxPublisher) {
        await this.outboxPublisher.publishNotification(tx, {
          title: `[${data.type || 'Notice'}] ${data.title}`,
          content: scheduleInfo ? `${scheduleInfo} - ${data.content}` : data.content,
          targetUser: 'All Employees',
          companyId: subscriptionId || 'PLATFORM',
          actor: { id: data.author, role: 'Admin' },
        });
      }

      return ann;
    });
  }

  async findAnnouncements(subscriptionId?: string) {
    return this.prisma.announcement.findMany({
      where: subscriptionId
        ? {
            OR: [{ subscriptionId }, { subscriptionId: null }],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMessage(data: {
    senderId: string;
    receiverId: string;
    companyId: string;
    subject: string;
    body: string;
    timestamp: string;
    read: boolean;
  }) {
    return this.prisma.message.create({ data });
  }

  async findTenantMessages(userId: string, companyId: string) {
    return this.prisma.message.findMany({
      where: {
        companyId,
        OR: [
          { senderId: userId, deletedBySender: false },
          { receiverId: userId, deletedByReceiver: false },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
            initials: true,
            role: true,
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            name: true,
            initials: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findPlatformMessages(userId: string) {
    return this.prisma.message.findMany({
      where: {
        company: { isDemo: false },
        OR: [
          { senderId: userId, deletedBySender: false },
          { receiverId: userId, deletedByReceiver: false },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
            initials: true,
            role: true,
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            name: true,
            initials: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMessages(userId: string, companyId: string) {
    return this.findTenantMessages(userId, companyId);
  }

  async findMessageById(id: string) {
    return this.prisma.message.findUnique({ where: { id } });
  }

  async markMessageRead(id: string) {
    return this.prisma.message.update({
      where: { id },
      data: { read: true },
    });
  }

  async deleteConversation(
    userId: string,
    contactId: string,
    companyId: string,
  ) {
    // 1. Mark sent messages as deletedBySender
    await this.prisma.message.updateMany({
      where: {
        companyId,
        senderId: userId,
        receiverId: contactId,
      },
      data: {
        deletedBySender: true,
      },
    });

    // 2. Mark received messages as deletedByReceiver
    await this.prisma.message.updateMany({
      where: {
        companyId,
        senderId: contactId,
        receiverId: userId,
      },
      data: {
        deletedByReceiver: true,
      },
    });

    // 3. Optional clean up of messages soft-deleted by both participants
    await this.prisma.message.deleteMany({
      where: {
        companyId,
        deletedBySender: true,
        deletedByReceiver: true,
      },
    });

    return { success: true };
  }
}
