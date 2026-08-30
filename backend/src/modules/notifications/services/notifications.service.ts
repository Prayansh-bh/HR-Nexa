import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from '../repositories/notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  async createAnnouncement(
    subscriptionId: string | null,
    data: {
      title: string;
      content: string;
      author: string;
      type?: string;
      scheduledFor?: string;
      duration?: string;
    },
  ) {
    const todayStr = new Date().toISOString().slice(0, 10);
    return this.notificationsRepository.createAnnouncement(subscriptionId, {
      title: data.title,
      content: data.content,
      author: data.author,
      date: todayStr,
      type: data.type,
      scheduledFor: data.scheduledFor,
      duration: data.duration,
    });
  }

  async findAnnouncements(subscriptionId?: string) {
    return this.notificationsRepository.findAnnouncements(subscriptionId);
  }

  async sendMessage(data: {
    senderId: string;
    receiverId: string;
    companyId: string;
    subject: string;
    body: string;
  }) {
    return this.notificationsRepository.createMessage({
      senderId: data.senderId,
      receiverId: data.receiverId,
      companyId: data.companyId,
      subject: data.subject,
      body: data.body,
      timestamp: new Date().toISOString(),
      read: false,
    });
  }

  async findTenantMessages(userId: string, companyId: string) {
    return this.notificationsRepository.findTenantMessages(userId, companyId);
  }

  async findPlatformMessages(userId: string) {
    return this.notificationsRepository.findPlatformMessages(userId);
  }

  async findMessages(userId: string, companyId: string) {
    return this.notificationsRepository.findMessages(userId, companyId);
  }

  async markMessageRead(id: string) {
    const msg = await this.notificationsRepository.findMessageById(id);
    if (!msg) {
      throw new NotFoundException(`Message record with ID "${id}" not found`);
    }
    return this.notificationsRepository.markMessageRead(id);
  }

  async deleteConversation(
    userId: string,
    contactId: string,
    companyId: string,
  ) {
    return this.notificationsRepository.deleteConversation(
      userId,
      contactId,
      companyId,
    );
  }
}
