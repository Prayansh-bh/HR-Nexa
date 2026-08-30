import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';
import * as fs from 'fs';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SystemService } from '../services/system.service';
import { SystemConfigService } from '../services/system-config.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { Roles } from '../../auth/roles.decorator';
import { Permissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions/permissions.constants';
import { Role } from '../../auth/role.enum';

import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { CreateAuditLogDto } from '../dto/create-audit-log.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { UpdateGlobalSettingsDto } from '../dto/update-global-settings.dto';

@ApiTags('System, Audit, Notifications')
@Controller('system')
@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard, PermissionsGuard)
@ApiBearerAuth()
export class SystemController {
  constructor(
    private readonly service: SystemService,
    private readonly configService: SystemConfigService,
  ) {}

  @Get('settings')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Get global system settings (SuperAdmin only)' })
  async getSettings() {
    return this.configService.getGlobalSettings();
  }

  @Get('runtime-settings')
  @ApiOperation({ summary: 'Get safe application runtime settings (Timezone, Currency, DateFormat, Language)' })
  async getRuntimeSettings() {
    return this.configService.getRuntimeSettings();
  }

  @Put('settings')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Update global system settings (SuperAdmin only)' })
  async updateSettings(
    @Body() dto: UpdateGlobalSettingsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';
    return this.configService.updateGlobalSettings(
      dto,
      { id: req.user.id, name: req.user.name, role: req.user.role },
      ip,
      userAgent,
    );
  }

  @Get('metrics')
  @Roles(Role.SuperAdmin, Role.HRAdmin, Role.CompanyOwner)
  @ApiOperation({ summary: 'Get real-time system monitoring metrics' })
  async getMetrics() {
    return this.service.getSystemMetrics();
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Get system announcements' })
  async getAnnouncements(@Request() req: AuthenticatedRequest) {
    return this.service.findAnnouncements(req.user);
  }

  @Post('announcements')
  @Permissions(Permission.SYSTEM_ANNOUNCEMENT_CREATE)
  @ApiOperation({ summary: 'Create new system announcement' })
  async createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.createAnnouncement(req.user, {
      title: dto.title,
      content: dto.content,
      author: req.user.name,
      type: dto.type,
      scheduledFor: dto.scheduledFor,
      duration: dto.duration,
    });
  }

  @Get('audit-logs')
  @Permissions(Permission.SYSTEM_AUDIT_VIEW)
  @ApiOperation({ summary: 'Get system audit logs with server-enforced pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50, max: 100)' })
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.service.findAuditLogs({ page: parsedPage, limit: parsedLimit });
  }


  @Post('audit-logs')
  @ApiOperation({ summary: 'Post a new audit log record' })
  async createAuditLog(
    @Body() dto: CreateAuditLogDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userRole = (req.user?.role || '').toUpperCase();
    const isSuperAdmin = userRole.includes('SUPERADMIN') || userRole === 'SUPER_ADMIN';
    const targetCompanyId = isSuperAdmin
      ? (req.user.companyId || 'PLATFORM')
      : (req.user.companyId || req.user.subscriptionId || 'PLATFORM');

    return this.service.createAuditLog(
      req.user.id,
      req.user.name,
      dto.action,
      dto.details,
      targetCompanyId,
      req.user.role || 'HRAdmin',
    );
  }

  @Get('super-admin/chat-contacts')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Get SuperAdmin cross-tenant messaging contacts (HR Admin & Company Owner only)' })
  async getSuperAdminChatContacts() {
    return this.service.getSuperAdminChatContacts();
  }

  @Get('messages')
  @Permissions(Permission.CHATBOX_ACCESS)
  @ApiOperation({ summary: 'Get direct messages for the current user' })
  async getMessages(@Request() req: AuthenticatedRequest) {
    const companyId = req.user.companyId || req.user.subscriptionId || null;
    return this.service.findMessages(req.user.id, companyId);
  }

  @Post('messages')
  @Permissions(Permission.CHATBOX_ACCESS)
  @ApiOperation({ summary: 'Send direct message' })
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const companyId = req.user.companyId || req.user.subscriptionId || 'PLATFORM';
    return this.service.sendMessage({
      senderId: req.user.id,
      receiverId: dto.receiverId,
      companyId,
      subject: dto.subject,
      body: dto.body,
    });
  }

  @Put('messages/:id/read')
  @Permissions(Permission.CHATBOX_ACCESS)
  @ApiOperation({ summary: 'Mark message as read' })
  async markRead(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const companyId = req.user.companyId || req.user.subscriptionId || null;
    return this.service.markMessageRead(id, req.user.id, companyId);
  }

  @Delete('messages/conversation/:contactId')
  @Permissions(Permission.CHATBOX_ACCESS)
  @ApiOperation({ summary: 'Delete conversation messages with a contact' })
  async deleteConversation(
    @Request() req: AuthenticatedRequest,
    @Param('contactId') contactId: string,
  ) {
    const companyId = req.user.companyId || req.user.subscriptionId || 'PLATFORM';
    return this.service.deleteConversation(req.user.id, contactId, companyId);
  }

  @Post('backups')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Create a database backup snapshot' })
  async createBackup(@Request() req: AuthenticatedRequest) {
    return this.service.createBackup({ id: req.user.id, name: req.user.name });
  }

  @Get('backups')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Get list of database backup snapshots' })
  async getBackups() {
    return this.service.getBackups();
  }

  @Post('backups/restore/:filename')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Restore a database backup snapshot' })
  async restoreBackup(
    @Param('filename') filename: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.restoreBackup(filename, {
      id: req.user.id,
      name: req.user.name,
    });
  }

  @Delete('backups/:filename')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Delete a database backup snapshot' })
  async deleteBackup(
    @Param('filename') filename: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.deleteBackup(filename, {
      id: req.user.id,
      name: req.user.name,
    });
  }

  @Get('backups/download/:filename')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Download a database backup snapshot file' })
  async downloadBackup(
    @Param('filename') filename: string,
  ): Promise<StreamableFile> {
    const filePath = this.service.getBackupFilePath(filename);
    const fileStream = fs.createReadStream(filePath);
    return new StreamableFile(fileStream, {
      disposition: `attachment; filename="${filename}"`,
      type: 'application/octet-stream',
    });
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get system notifications for current user' })
  async getNotifications(@Request() req: AuthenticatedRequest) {
    return this.service.getSystemNotifications(req.user);
  }

  @Post('notifications/broadcast')
  @Roles(Role.SuperAdmin, Role.HRAdmin)
  @ApiOperation({ summary: 'Broadcast global system notification' })
  async broadcastNotification(@Body() body: any) {
    return this.service.broadcastSystemNotification(body);
  }

  @Put('notifications/mark-all-read')
  @ApiOperation({
    summary: 'Mark all system notifications as read for current user',
  })
  async markAllNotificationsRead(@Request() req: AuthenticatedRequest) {
    return this.service.markAllSystemNotificationsRead(req.user.id, req.user);
  }

  @Put('notifications/:id/read')
  @ApiOperation({
    summary: 'Mark a single system notification as read for current user',
  })
  async markNotificationRead(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.markSystemNotificationRead(id, req.user.id);
  }

  @Delete('notifications/:id')
  @Roles(Role.SuperAdmin, Role.HRAdmin)
  @ApiOperation({ summary: 'Delete a system notification' })
  async deleteNotification(@Param('id') id: string) {
    return this.service.deleteSystemNotification(id);
  }
}
