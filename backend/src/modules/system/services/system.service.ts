import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { canSendMessage } from '../../../common/auth/messaging-auth.helper';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';

@Injectable()
export class SystemService {
  constructor(
    private auditLogsRepository: AuditLogsRepository,
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  private getDatabaseProvider(): 'postgresql' | 'sqlite' {
    const dbUrl = (process.env.DATABASE_URL || '').trim().toLowerCase();
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      return 'postgresql';
    }
    return 'sqlite';
  }

  private getPgBinary(binaryName: 'pg_dump' | 'psql'): string | null {
    const ext = process.platform === 'win32' ? '.exe' : '';
    const fullName = `${binaryName}${ext}`;

    // 1. Explicit PG_BIN_DIR configuration
    const envBinDir = process.env.PG_BIN_DIR?.trim();
    if (envBinDir) {
      const candidate = path.join(envBinDir, fullName);
      if (fs.existsSync(candidate)) {
        try {
          const res = spawnSync(candidate, ['--version'], { stdio: 'pipe' });
          if (res.status === 0) return candidate;
        } catch {}
      }
    }

    // 2. Existing PATH resolution
    try {
      const res = spawnSync(binaryName, ['--version'], { stdio: 'pipe' });
      if (res.status === 0) return binaryName;
    } catch {}

    // 3. Dynamically discovered standard PostgreSQL installation locations
    const candidates: string[] = [];

    if (process.platform === 'win32') {
      const rootDirs = [
        process.env['ProgramFiles']
          ? path.join(process.env['ProgramFiles'], 'PostgreSQL')
          : 'C:\\Program Files\\PostgreSQL',
        process.env['ProgramFiles(x86)']
          ? path.join(process.env['ProgramFiles(x86)'], 'PostgreSQL')
          : 'C:\\Program Files (x86)\\PostgreSQL',
        process.env['LOCALAPPDATA']
          ? path.join(process.env['LOCALAPPDATA'], 'Programs', 'PostgreSQL')
          : null,
      ].filter(Boolean) as string[];

      for (const root of rootDirs) {
        if (fs.existsSync(root)) {
          try {
            const entries = fs.readdirSync(root, { withFileTypes: true });
            const versionDirs = entries
              .filter((e) => e.isDirectory())
              .map((e) => e.name)
              .sort((a, b) => {
                const numA = parseFloat(a) || 0;
                const numB = parseFloat(b) || 0;
                return numB - numA;
              });

            for (const vDir of versionDirs) {
              candidates.push(path.join(root, vDir, 'bin', fullName));
            }
          } catch {}
        }
      }
    } else {
      // Unix-like systems (Linux / macOS)
      const pgRoot = '/usr/lib/postgresql';
      if (fs.existsSync(pgRoot)) {
        try {
          const entries = fs.readdirSync(pgRoot, { withFileTypes: true });
          const versionDirs = entries
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort((a, b) => {
              const numA = parseFloat(a) || 0;
              const numB = parseFloat(b) || 0;
              return numB - numA;
            });

          for (const vDir of versionDirs) {
            candidates.push(path.join(pgRoot, vDir, 'bin', fullName));
          }
        } catch {}
      }

      candidates.push(
        `/usr/local/bin/${fullName}`,
        `/opt/homebrew/bin/${fullName}`,
        `/usr/bin/${fullName}`,
      );
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const res = spawnSync(candidate, ['--version'], { stdio: 'pipe' });
          if (res.status === 0) return candidate;
        } catch {}
      }
    }

    return null;
  }

  private isPgDumpAvailable(): boolean {
    return this.getPgBinary('pg_dump') !== null;
  }

  private isPsqlAvailable(): boolean {
    return this.getPgBinary('psql') !== null;
  }

  private getCleanPgConnectionUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      parsed.searchParams.delete('schema');
      return parsed.toString();
    } catch {
      return rawUrl.replace(/([?&])schema=[^&]+(&|$)/, (match, p1, p2) => (p1 === '?' && p2 ? '?' : ''));
    }
  }

  private sanitizeDbErrorMessage(errorMsg: string): string {
    if (!errorMsg) return 'Execution failure';
    return errorMsg
      .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***:***@')
      .replace(/postgres:\/\/[^@]+@/gi, 'postgres://***:***@')
      .replace(/password=[^\s]+/gi, 'password=***');
  }

  private validateSafeBackupFilename(filename: string): string {
    const safeFilename = path.basename(filename);
    if (
      !safeFilename ||
      safeFilename === '.' ||
      safeFilename === '..' ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      throw new BadRequestException('Invalid backup filename specified.');
    }
    if (!safeFilename.endsWith('.sql') && !safeFilename.endsWith('.db') && !safeFilename.endsWith('.dump')) {
      throw new BadRequestException('Invalid backup file extension.');
    }
    return safeFilename;
  }

  // Backups
  async createBackup(user?: { id?: string; name?: string }) {
    const prismaDir = path.join(process.cwd(), 'prisma');
    const backupsDir = path.join(prismaDir, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const provider = this.getDatabaseProvider();
    const timestamp = Date.now();
    const dateObj = new Date(timestamp);
    const dateFormatted = dateObj
      .toISOString()
      .replace('T', ' ')
      .substring(0, 16);
    const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '_');

    let backupFileName: string;
    let backupPath: string;

    if (provider === 'postgresql') {
      const pgDumpBin = this.getPgBinary('pg_dump');
      if (!pgDumpBin) {
        throw new BadRequestException(
          'PostgreSQL database provider detected, but the "pg_dump" CLI utility is not installed in this environment. ' +
          'In production, automated PostgreSQL backups and point-in-time recovery are managed by your cloud database provider ' +
          '(e.g., Render, AWS RDS, Neon, Supabase), or configure PG_BIN_DIR / install postgresql-client CLI tools.',
        );
      }

      backupFileName = `backup_${dateStr}_${timestamp}.sql`;
      backupPath = path.join(backupsDir, backupFileName);

      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new BadRequestException('DATABASE_URL environment variable is missing.');
      }

      const cleanDbUrl = this.getCleanPgConnectionUrl(dbUrl);

      const result = spawnSync(pgDumpBin, ['--dbname=' + cleanDbUrl, '--clean', '--if-exists', '-f', backupPath], {
        stdio: 'pipe',
        env: { ...process.env },
      });

      if (result.status !== 0) {
        if (fs.existsSync(backupPath)) {
          try { fs.unlinkSync(backupPath); } catch {}
        }
        const errorMsg = result.stderr ? result.stderr.toString().trim() : 'Unknown pg_dump execution failure';
        const sanitizedError = this.sanitizeDbErrorMessage(errorMsg);
        throw new Error(`PostgreSQL backup failed: ${sanitizedError}`);
      }
    } else {
      // SQLite local development fallback
      const dbPath = path.join(prismaDir, 'dev.db');
      if (!fs.existsSync(dbPath)) {
        throw new NotFoundException('SQLite database file not found at ' + dbPath);
      }
      backupFileName = `backup_${dateStr}_${timestamp}.db`;
      backupPath = path.join(backupsDir, backupFileName);
      fs.copyFileSync(dbPath, backupPath);
    }

    const stat = fs.statSync(backupPath);
    if (stat.size === 0) {
      if (fs.existsSync(backupPath)) {
        try { fs.unlinkSync(backupPath); } catch {}
      }
      throw new Error('PostgreSQL backup failed: Generated backup snapshot is empty (0 bytes).');
    }
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(1);
    const formattedSize =
      stat.size >= 1024 * 1024 * 1024
        ? `${(stat.size / (1024 * 1024 * 1024)).toFixed(1)} GB`
        : `${sizeMb} MB`;

    // 1. Log Audit Log Record
    await this.createAuditLog(
      user?.id || null,
      user?.name || 'SuperAdmin',
      'DATABASE_BACKUP_CREATED',
      `Created database backup snapshot: ${backupFileName} (${formattedSize})`,
    ).catch(() => null);

    // 2. Create System Notification for SuperAdmin
    await (this.prisma as any).systemNotification
      .create({
        data: {
          title: 'Backup completed successfully',
          message: `Database snapshot ${backupFileName} (${formattedSize}) generated.`,
          severity: 'success',
          category: 'backup',
          targetRole: 'SuperAdmin',
          company: 'System',
          reason: 'Manual Snapshot Creation',
          recommendedAction: 'No action required',
          linkUrl: 'saas.backup',
          read: false,
          readBy: '[]',
          timestamp: new Date(),
        },
      })
      .catch(() => null);

    // 3. Enforce Retention Policy (Max 30 backups)
    await this.enforceRetentionPolicy(backupsDir, 30);

    return {
      id: `BKP-${timestamp}`,
      name: backupFileName.replace(/\.(db|sql|dump)$/, ''),
      d: dateFormatted,
      date: dateObj.toISOString(),
      s: formattedSize,
      rawSizeBytes: stat.size,
      t: 'Manual',
      st: 'Completed',
      status: 'Completed',
      filename: backupFileName,
    };
  }

  private async enforceRetentionPolicy(backupsDir: string, maxBackups = 30) {
    try {
      if (!fs.existsSync(backupsDir)) return;
      const files = fs
        .readdirSync(backupsDir)
        .filter((f) => f.startsWith('backup') && (f.endsWith('.db') || f.endsWith('.sql') || f.endsWith('.dump')));
      if (files.length <= maxBackups) return;

      const fileStats = files.map((file) => {
        const filePath = path.join(backupsDir, file);
        return { file, filePath, ctime: fs.statSync(filePath).ctimeMs };
      });

      fileStats.sort((a, b) => a.ctime - b.ctime); // oldest first

      const toDeleteCount = fileStats.length - maxBackups;
      for (let i = 0; i < toDeleteCount; i++) {
        fs.unlinkSync(fileStats[i].filePath);
      }
    } catch (err) {
      console.error('Retention policy cleanup error:', err);
    }
  }

  async getBackups() {
    const prismaDir = path.join(process.cwd(), 'prisma');
    const backupsDir = path.join(prismaDir, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const files = fs.readdirSync(backupsDir);
    const backups = files
      .filter((file) => file.startsWith('backup') && (file.endsWith('.db') || file.endsWith('.sql') || file.endsWith('.dump')))
      .map((file) => {
        const filePath = path.join(backupsDir, file);
        const stat = fs.statSync(filePath);
        const match = file.match(/(\d{13})/);
        const timestamp = match ? parseInt(match[1], 10) : stat.ctimeMs;
        const dateObj = new Date(timestamp);
        const dateFormatted = dateObj
          .toISOString()
          .replace('T', ' ')
          .substring(0, 16);
        const sizeMb = (stat.size / (1024 * 1024)).toFixed(1);
        const formattedSize =
          stat.size >= 1024 * 1024 * 1024
            ? `${(stat.size / (1024 * 1024 * 1024)).toFixed(1)} GB`
            : `${sizeMb} MB`;

        return {
          id: `BKP-${timestamp}`,
          name: file.replace(/\.(db|sql|dump)$/, ''),
          d: dateFormatted,
          date: dateObj.toISOString(),
          s: formattedSize,
          rawSizeBytes: stat.size,
          t: 'Manual',
          st: 'Completed',
          status: 'Completed',
          filename: file,
        };
      });

    return backups.sort((a, b) => b.filename.localeCompare(a.filename));
  }

  async restoreBackup(filename: string, user?: { id?: string; name?: string }) {
    const prismaDir = path.join(process.cwd(), 'prisma');
    const backupsDir = path.join(prismaDir, 'backups');
    const safeFilename = this.validateSafeBackupFilename(filename);
    const backupPath = path.join(backupsDir, safeFilename);
    if (!fs.existsSync(backupPath)) {
      throw new NotFoundException('Backup snapshot file not found: ' + safeFilename);
    }

    const provider = this.getDatabaseProvider();

    if (provider === 'postgresql') {
      const psqlBin = this.getPgBinary('psql');
      if (!psqlBin) {
        throw new BadRequestException(
          'PostgreSQL database provider detected, but the "psql" CLI utility is not installed on this server. ' +
          'To restore a PostgreSQL snapshot safely, configure PG_BIN_DIR or apply the SQL backup file directly against your database.',
        );
      }

      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new BadRequestException('DATABASE_URL environment variable is missing.');
      }

      const cleanDbUrl = this.getCleanPgConnectionUrl(dbUrl);

      const result = spawnSync(psqlBin, ['--dbname=' + cleanDbUrl, '-f', backupPath], {
        stdio: 'pipe',
        env: { ...process.env },
      });

      if (result.status !== 0) {
        const errorMsg = result.stderr ? result.stderr.toString().trim() : 'Unknown psql restore execution failure';
        const sanitizedError = this.sanitizeDbErrorMessage(errorMsg);
        throw new Error(`PostgreSQL restore failed: ${sanitizedError}`);
      }
    } else {
      // SQLite local development fallback
      const dbPath = path.join(prismaDir, 'dev.db');
      fs.copyFileSync(backupPath, dbPath);
    }

    // Audit log
    await this.createAuditLog(
      user?.id || null,
      user?.name || 'SuperAdmin',
      'DATABASE_RESTORED',
      `Restored database from snapshot: ${safeFilename}`,
    ).catch(() => null);

    // Notification
    await (this.prisma as any).systemNotification
      .create({
        data: {
          title: 'Database Restored',
          message: `Database successfully restored from snapshot ${safeFilename}.`,
          severity: 'warning',
          category: 'backup',
          targetRole: 'SuperAdmin',
          company: 'System',
          reason: 'Manual Database Snapshot Restore',
          recommendedAction: 'Verify system data integrity',
          linkUrl: 'saas.backup',
          read: false,
          readBy: '[]',
          timestamp: new Date(),
        },
      })
      .catch(() => null);

    return { message: `Database restored successfully from ${safeFilename}` };
  }

  async deleteBackup(filename: string, user?: { id?: string; name?: string }) {
    const prismaDir = path.join(process.cwd(), 'prisma');
    const backupsDir = path.join(prismaDir, 'backups');
    const safeFilename = this.validateSafeBackupFilename(filename);
    const backupPath = path.join(backupsDir, safeFilename);
    if (!fs.existsSync(backupPath)) {
      throw new NotFoundException('Backup snapshot file not found: ' + safeFilename);
    }
    fs.unlinkSync(backupPath);

    // Audit log
    await this.createAuditLog(
      user?.id || null,
      user?.name || 'SuperAdmin',
      'DATABASE_BACKUP_DELETED',
      `Deleted database backup snapshot: ${safeFilename}`,
    ).catch(() => null);

    // Notification
    await (this.prisma as any).systemNotification
      .create({
        data: {
          title: 'Database Backup Deleted',
          message: `Snapshot ${safeFilename} deleted.`,
          severity: 'info',
          category: 'backup',
          targetRole: 'SuperAdmin',
          company: 'System',
          reason: 'Manual Purge',
          recommendedAction: 'Review retention logs',
          linkUrl: 'saas.backup',
          read: false,
          readBy: '[]',
          timestamp: new Date(),
        },
      })
      .catch(() => null);

    return { message: `Database backup ${safeFilename} deleted successfully` };
  }

  getBackupFilePath(filename: string) {
    const prismaDir = path.join(process.cwd(), 'prisma');
    const backupsDir = path.join(prismaDir, 'backups');
    const safeFilename = this.validateSafeBackupFilename(filename);
    const backupPath = path.join(backupsDir, safeFilename);
    if (!fs.existsSync(backupPath)) {
      throw new NotFoundException('Backup snapshot file not found: ' + safeFilename);
    }
    return backupPath;
  }

  // Announcements
  async createAnnouncement(
    currentUser: any,
    data: {
      title: string;
      content: string;
      author: string;
      type?: string;
      scheduledFor?: string;
      duration?: string;
    },
  ) {
    const subscriptionId =
      currentUser?.subscriptionId || null;
    return this.notificationsService.createAnnouncement(subscriptionId, data);
  }

  async findAnnouncements(currentUser: any) {
    const subscriptionId =
      currentUser?.subscriptionId || undefined;
    return this.notificationsService.findAnnouncements(subscriptionId);
  }

  // Audit Logs
  async createAuditLog(
    userId: string | null,
    userName: string,
    action: string,
    details: string,
    companyId: string = 'PLATFORM',
    actorRole: string = 'HRAdmin',
  ) {
    const validActions = [
      'PAYROLL_CALCULATED',
      'PAYROLL_APPROVED',
      'PAYROLL_LOCKED',
      'PAYROLL_PAID',
      'PAYROLL_UNLOCKED',
      'HOLIDAY_ADDED',
      'HOLIDAY_DELETED',
      'TIMING_UPDATED',
      'SETTINGS_UPDATED',
      'LEAVE_STATUS_UPDATED',
      'RESIGNATION_SUBMITTED',
      'RESIGNATION_APPROVED',
      'RESIGNATION_REJECTED',
    ];
    const safeAction = validActions.includes(action) ? action : 'SETTINGS_UPDATED';

    return this.auditLogsRepository.create({
      userId,
      userName,
      actorId: userId || 'system',
      actorRole: actorRole || 'HRAdmin',
      entityType: 'COMPANY_SETTINGS',
      companyId: companyId || 'PLATFORM',
      action: safeAction as any,
      details,
    });
  }

  async findAuditLogs(options?: { page?: number; limit?: number }) {
    return this.auditLogsRepository.findMany(options);
  }

  // Messages
  async getSuperAdminChatContacts() {
    const adminUsers = await this.prisma.user.findMany({
      where: {
        role: { in: ['HRAdmin', 'CompanyOwner'] },
        status: { in: ['Active', 'Logged Out'] },
        OR: [
          { company: { isDemo: false } },
          { subscription: { companyRelation: { isDemo: false } } },
        ],
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            isDemo: true,
          },
        },
        subscription: {
          select: {
            id: true,
            company: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return adminUsers.map((u) => {
      const companyName = u.company?.name || u.subscription?.company || 'Company';
      const companyId = u.companyId || u.subscriptionId || '';
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        companyId,
        companyName,
        avatar: u.initials || u.name.slice(0, 2).toUpperCase(),
        status: u.status,
      };
    });
  }

  async sendMessage(data: {
    senderId: string;
    receiverId: string;
    companyId: string;
    subject: string;
    body: string;
  }) {
    // 1. Sender validation
    const sender = await this.prisma.user.findUnique({
      where: { id: data.senderId },
    });
    if (!sender) {
      throw new UnauthorizedException('Sender account does not exist');
    }

    // 2. Receiver validation
    const receiver = await this.prisma.user.findUnique({
      where: { id: data.receiverId },
    });
    if (!receiver) {
      throw new BadRequestException('Receiver account does not exist');
    }
    if (receiver.status !== 'Active' && receiver.status !== 'Logged Out') {
      throw new BadRequestException(
        'Cannot message an inactive or disabled user',
      );
    }

    // 3. Prevent self-messaging
    if (data.senderId === data.receiverId) {
      throw new BadRequestException('Self-messaging is not permitted');
    }

    // 4. Authorization check via reusable helper
    const allowed = canSendMessage(
      {
        id: sender.id,
        role: sender.role,
        companyId: sender.companyId,
        subscriptionId: sender.subscriptionId,
      },
      {
        id: receiver.id,
        role: receiver.role,
        companyId: receiver.companyId,
        subscriptionId: receiver.subscriptionId,
      },
    );

    const senderCompany = sender.companyId || sender.subscriptionId || 'PLATFORM';
    const receiverCompany = receiver.companyId || receiver.subscriptionId || 'PLATFORM';

    if (!allowed) {
      await this.auditLogsRepository
        .create({
          userId: sender.id,
          userName: sender.name,
          actorId: sender.id || 'system',
          actorRole: sender.role || 'Employee',
          entityType: 'COMPANY_SETTINGS',
          companyId: senderCompany,
          action: 'SETTINGS_UPDATED',
          details: JSON.stringify({
            event: 'SECURITY_CROSS_TENANT_CHAT_BLOCKED',
            senderId: sender.id,
            receiverId: receiver.id,
            senderRole: sender.role,
            receiverRole: receiver.role,
            senderCompany,
            receiverCompany,
            timestamp: new Date().toISOString(),
          }),
        })
        .catch(() => null);

      throw new ForbiddenException('Cannot message users from another company');
    }

    const targetCompanyId =
      data.companyId && data.companyId !== 'PLATFORM'
        ? data.companyId
        : (senderCompany !== 'PLATFORM' ? senderCompany : receiverCompany);

    const createdMessage = await this.notificationsService.sendMessage({
      senderId: data.senderId,
      receiverId: data.receiverId,
      companyId: targetCompanyId,
      subject: data.subject,
      body: data.body,
    });

    // 5. Audit log for platform messages
    if (sender.role === 'SuperAdmin' || receiver.role === 'SuperAdmin') {
      await this.auditLogsRepository
        .create({
          userId: sender.id,
          userName: sender.name,
          actorId: sender.id,
          actorRole: sender.role,
          entityType: 'COMPANY_SETTINGS',
          companyId: receiverCompany,
          action: 'SETTINGS_UPDATED',
          details: JSON.stringify({
            event: 'PLATFORM_MESSAGE',
            messageId: createdMessage.id,
            senderId: sender.id,
            receiverId: receiver.id,
            senderRole: sender.role,
            receiverRole: receiver.role,
            senderCompany,
            receiverCompany,
            timestamp: new Date().toISOString(),
          }),
        })
        .catch(() => null);
    }

    return createdMessage;
  }

  async findMessages(userId: string, companyId?: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && user.role === 'SuperAdmin') {
      return this.notificationsService.findPlatformMessages(userId);
    }
    const resolvedCompanyId = companyId || user?.companyId || user?.subscriptionId || 'C1';
    return this.notificationsService.findTenantMessages(userId, resolvedCompanyId);
  }

  async markMessageRead(id: string, userId?: string, companyId?: string | null) {
    const msg = await (this.prisma as any).message.findUnique({ where: { id } });
    if (!msg) {
      throw new NotFoundException(`Message record with ID "${id}" not found`);
    }
    if (companyId && msg.companyId !== companyId) {
      throw new NotFoundException(`Message record with ID "${id}" not found`);
    }
    if (userId && msg.receiverId !== userId && msg.senderId !== userId) {
      throw new NotFoundException(`Message record with ID "${id}" not found`);
    }
    return this.notificationsService.markMessageRead(id);
  }

  async deleteConversation(
    userId: string,
    contactId: string,
    companyId: string,
  ) {
    return this.notificationsService.deleteConversation(
      userId,
      contactId,
      companyId,
    );
  }

  // System Metrics
  async getSystemMetrics() {
    const startTime = process.hrtime();

    // CPU
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    let cpuPercent = 0;
    if (
      loadAvg &&
      loadAvg[0] !== undefined &&
      loadAvg[0] > 0 &&
      cpus.length > 0
    ) {
      cpuPercent = Math.min(100, Math.round((loadAvg[0] / cpus.length) * 100));
    }
    if (cpuPercent === 0 && cpus.length > 0) {
      const totalTicks = cpus.reduce((acc, cpu) => {
        return acc + Object.values(cpu.times).reduce((a, b) => a + b, 0);
      }, 0);
      const idleTicks = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
      cpuPercent =
        totalTicks > 0
          ? Math.round(((totalTicks - idleTicks) / totalTicks) * 100)
          : 0;
    }
    const cpuStatus =
      cpuPercent > 80 ? 'High' : cpuPercent > 50 ? 'Elevated' : 'Normal';

    // 1. Node.js Process Memory (V8 Heap & RSS)
    const memUsage = process.memoryUsage();
    const processHeapUsedMb = (memUsage.heapUsed / (1024 * 1024)).toFixed(1);
    const processHeapTotalMb = (memUsage.heapTotal / (1024 * 1024)).toFixed(1);
    const processRssMb = (memUsage.rss / (1024 * 1024)).toFixed(1);
    const processHeapPercent =
      memUsage.heapTotal > 0
        ? Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        : 0;
    const processMemoryFormatted = `${processHeapUsedMb} MB / ${processHeapTotalMb} MB`;
    const processMemoryStatus =
      processHeapPercent > 85
        ? 'High Heap'
        : processHeapPercent > 70
          ? 'Elevated'
          : 'Normal';

    // 2. Host Physical Memory (Underlying Host OS / VM)
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const hostTotalRamGb = (totalMemBytes / (1024 * 1024 * 1024)).toFixed(1);
    const hostUsedRamGb = (usedMemBytes / (1024 * 1024 * 1024)).toFixed(1);
    const hostRamPercent =
      totalMemBytes > 0 ? (usedMemBytes / totalMemBytes) * 100 : 0;
    const hostRamStatus =
      hostRamPercent > 85
        ? 'High'
        : hostRamPercent > 65
          ? 'Elevated'
          : 'Normal';
    const hostMemoryFormatted = `${hostUsedRamGb} GB / ${hostTotalRamGb} GB`;

    // Real Database Size Calculation (PostgreSQL or SQLite)
    let dbSizeBytes = 0;
    const dbStatus = 'Optimized';
    try {
      // 1. Try PostgreSQL raw query if running on PostgreSQL
      const pgResult = await this.prisma.$queryRaw<
        Array<{ size: bigint | number }>
      >`
        SELECT pg_database_size(current_database()) AS size;
      `.catch(() => null);

      if (pgResult && pgResult.length > 0 && pgResult[0]?.size !== undefined) {
        dbSizeBytes = Number(pgResult[0].size);
      } else {
        // 2. Try SQLite PRAGMA query
        const sqliteResult = await this.prisma.$queryRaw<
          Array<{ page_count: bigint | number; page_size: bigint | number }>
        >`
          SELECT pragma_page_count() AS page_count, pragma_page_size() AS page_size;
        `.catch(() => null);

        if (
          sqliteResult &&
          sqliteResult.length > 0 &&
          sqliteResult[0]?.page_count
        ) {
          dbSizeBytes =
            Number(sqliteResult[0].page_count) *
            Number(sqliteResult[0].page_size);
        } else {
          // 3. Fallback: inspect SQLite dev.db file size if it exists
          const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
          if (fs.existsSync(dbPath)) {
            dbSizeBytes = fs.statSync(dbPath).size;
          }
        }
      }
    } catch {
      // Fallback if query error
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
      if (fs.existsSync(dbPath)) {
        dbSizeBytes = fs.statSync(dbPath).size;
      }
    }

    let dbSizeFormatted = '0.0 MB';
    if (dbSizeBytes > 1024 * 1024 * 1024) {
      dbSizeFormatted = `${(dbSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (dbSizeBytes > 0) {
      dbSizeFormatted = `${(dbSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      // If DB size is tiny/zero in dev memory mode, calculate size from total record count
      const totalRecords = await Promise.all([
        this.prisma.user.count().catch(() => 0),
        this.prisma.employee.count().catch(() => 0),
        this.prisma.auditLog.count().catch(() => 0),
        this.prisma.message.count().catch(() => 0),
      ])
        .then((counts) => counts.reduce((a, b) => a + b, 0))
        .catch(() => 0);

      const estimatedBytes = totalRecords * 1024 + 512 * 1024; // 512KB base
      dbSizeFormatted = `${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    // Real Asynchronous Outbox Queue
    let outboxQueueCount = 0;
    let outboxQueueStatus = 'Empty queue';
    try {
      outboxQueueCount = await (this.prisma as any).outboxEvent.count({
        where: { status: 'PENDING' },
      }).catch(() => 0);
      outboxQueueStatus =
        outboxQueueCount > 0
          ? `${outboxQueueCount} pending events`
          : 'Processing normally';
    } catch {
      outboxQueueCount = 0;
      outboxQueueStatus = 'Empty queue';
    }

    // Process Uptime
    const uptimeSec = Math.floor(process.uptime());
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    let uptimeFormatted = `${seconds}s uptime`;
    if (days > 0) uptimeFormatted = `${days}d ${hours}h uptime`;
    else if (hours > 0) uptimeFormatted = `${hours}h ${minutes}m uptime`;
    else if (minutes > 0) uptimeFormatted = `${minutes}m ${seconds}s uptime`;

    // Resource Health based on CPU, Host RAM, and Process Heap
    const resourceHealth =
      cpuPercent < 90 && hostRamPercent < 90 && processHeapPercent < 90
        ? 'Healthy'
        : 'Degraded';

    // Storage Capacity (Disk Storage)
    let storageUsed: string | null = null;
    let storageTotal: string | null = null;
    let storageStatus = 'Unavailable';
    try {
      if (typeof (fs as any).statfsSync === 'function') {
        const stats = (fs as any).statfsSync(process.cwd());
        if (stats && stats.bsize > 0 && stats.blocks > 0) {
          const totalDisk = stats.bsize * stats.blocks;
          const freeDisk = stats.bsize * stats.bfree;
          const usedDisk = totalDisk - freeDisk;
          storageUsed = `${(usedDisk / (1024 * 1024 * 1024)).toFixed(1)} GB`;
          storageTotal = `${(totalDisk / (1024 * 1024 * 1024)).toFixed(1)} GB`;
          const diskPercent = totalDisk > 0 ? (usedDisk / totalDisk) * 100 : 0;
          storageStatus = diskPercent > 85 ? 'Low disk space' : 'Plenty of space';
        }
      }
    } catch {
      storageUsed = null;
      storageTotal = null;
      storageStatus = 'Unavailable';
    }

    // Metrics Execution Duration
    const elapsed = process.hrtime(startTime);
    const metricsDurationMs = Math.max(
      1,
      Math.round(elapsed[0] * 1000 + elapsed[1] / 1e6),
    );

    const storageUsedNum = storageUsed ? parseFloat(storageUsed) : 0;
    const storageTotalNum = storageTotal ? parseFloat(storageTotal) : 0;
    const hostUsedRamNum = parseFloat(hostUsedRamGb) || 0;
    const hostTotalRamNum = parseFloat(hostTotalRamGb) || 0;

    return {
      cpuUsage: `${cpuPercent}%`,
      cpuUsageNumeric: cpuPercent,
      cpuStatus,
      // Node.js Process Memory
      processMemory: processMemoryFormatted,
      processHeapUsed: `${processHeapUsedMb} MB`,
      processHeapTotal: `${processHeapTotalMb} MB`,
      processRss: `${processRssMb} MB`,
      processMemoryStatus,
      // Host Physical Memory
      hostMemory: hostMemoryFormatted,
      hostMemoryUsed: `${hostUsedRamGb} GB`,
      hostMemoryTotal: `${hostTotalRamGb} GB`,
      hostMemoryStatus: hostRamStatus,
      memoryUsedGb: hostUsedRamNum,
      memoryTotalGb: hostTotalRamNum,
      // Backward compatibility fields
      ramUsage: `${hostUsedRamGb} GB`,
      ramTotal: `${hostTotalRamGb} GB`,
      ramStatus: hostRamStatus,
      dbSize: dbSizeFormatted,
      dbStatus,
      serverHealth: resourceHealth,
      serverUptime: uptimeFormatted,
      uptimeSeconds: uptimeSec,
      errorRate: 0.02,
      // Outbox Event Queue
      outboxQueue: outboxQueueCount,
      outboxQueueStatus,
      emailQueue: outboxQueueCount,
      emailQueueStatus: outboxQueueStatus,
      smsQueue: null,
      smsQueueStatus: 'Unavailable',
      apiStatus: 'Operational',
      apiLatency: `${metricsDurationMs}ms`,
      metricsDuration: `${metricsDurationMs}ms`,
      storageUsed,
      storageTotal,
      storageUsedGb: storageUsedNum,
      storageTotalGb: storageTotalNum,
      storageStatus,
      timestamp: new Date().toISOString(),
    };
  }

  private normalizeRoleString(roleStr?: string): string {
    if (!roleStr) return '';
    const s = roleStr.toUpperCase().replace(/[^A-Z]/g, '');
    if (s.includes('SUPER')) return 'SUPERADMIN';
    if (s.includes('HR')) return 'HRADMIN';
    if (s.includes('MANAGER')) return 'MANAGER';
    if (s.includes('EMPLOYEE')) return 'EMPLOYEE';
    if (s.includes('ACCOUNT')) return 'ACCOUNTANT';
    return s;
  }

  // System Notifications
  async getSystemNotifications(user?: {
    id?: string;
    name?: string;
    role?: string;
    email?: string;
    company?: string;
  }) {
    const allNotifications = await (
      this.prisma as any
    ).systemNotification.findMany({
      orderBy: { timestamp: 'desc' },
    });

    let notifications = allNotifications;
    const userRoleNorm = this.normalizeRoleString(user?.role);
    if (user?.role && userRoleNorm === 'SUPERADMIN') {
      const demoCompanies = await this.prisma.company.findMany({
        where: { isDemo: true },
        select: { id: true, name: true },
      });
      const demoIdentifiers = new Set<string>();
      demoCompanies.forEach((c) => {
        if (c.id) demoIdentifiers.add(c.id.toLowerCase());
        if (c.name) demoIdentifiers.add(c.name.toLowerCase());
      });
      notifications = allNotifications.filter(
        (n: any) => !n.company || !demoIdentifiers.has(n.company.toLowerCase()),
      );
    } else if (user?.role) {
      notifications = allNotifications.filter((n: any) => {
        // 1. Direct Recipient ID check
        if (n.recipientId) {
          return user?.id && n.recipientId === user.id;
        }

        // 2. Target Role Filter (using normalized comparison)
        const targetNormRole = this.normalizeRoleString(n.targetRole || 'ALL');
        if (
          targetNormRole !== 'ALL' &&
          targetNormRole !== 'EVERYONE' &&
          targetNormRole !== userRoleNorm
        ) {
          return false;
        }

        // 3. Target Company Filter
        if (
          n.company &&
          n.company !== 'System' &&
          n.company !== 'Infrastructure' &&
          n.company !== 'Security Gateway' &&
          n.company !== 'File Storage' &&
          n.company !== 'All Companies' &&
          n.company !== 'Everyone'
        ) {
          const userCompany =
            (user as any).subscription?.company ||
            user.company ||
            (user as any).employee?.companyName;
          if (
            userCompany &&
            n.company.toLowerCase() !== userCompany.toLowerCase()
          ) {
            return false;
          }
        }

        return true;
      });
    }

    // Per-user read tracking evaluation
    const userId = user?.id;
    notifications = notifications.map((n: any) => {
      let readByList: string[] = [];
      try {
        readByList = JSON.parse(n.readBy || '[]');
      } catch {
        readByList = [];
      }
      const isReadForUser = userId ? readByList.includes(userId) : n.read;
      return {
        ...n,
        read: isReadForUser,
      };
    });

    const unreadCount = notifications.filter((n: any) => !n.read).length;
    return { notifications, unreadCount };
  }

  async broadcastSystemNotification(data: {
    title: string;
    message: string;
    severity?: string;
    category?: string;
    targetRole?: string;
    company?: string;
    reason?: string;
    recommendedAction?: string;
    linkUrl?: string;
  }) {
    const created = await (this.prisma as any).systemNotification.create({
      data: {
        title: data.title,
        message: data.message,
        severity: data.severity || 'info',
        category: data.category || 'system',
        targetRole: data.targetRole || 'ALL',
        company: data.company || null,
        reason: data.reason || null,
        recommendedAction: data.recommendedAction || null,
        linkUrl: data.linkUrl || null,
        read: false,
        readBy: '[]',
        timestamp: new Date(),
      },
    });

    await this.createAuditLog(
      null,
      'SuperAdmin',
      'BROADCAST_NOTIFICATION_CREATED',
      `Broadcast notification sent to ${data.targetRole || 'ALL'}: ${data.title}`,
    ).catch(() => null);

    return created;
  }

  async markSystemNotificationRead(id: string, userId?: string) {
    if (!userId) {
      return (this.prisma as any).systemNotification.update({
        where: { id },
        data: { read: true },
      });
    }

    const n = await (this.prisma as any).systemNotification.findUnique({
      where: { id },
    });
    if (!n) return null;

    let readByList: string[] = [];
    try {
      readByList = JSON.parse(n.readBy || '[]');
    } catch {
      readByList = [];
    }

    if (!readByList.includes(userId)) {
      readByList.push(userId);
    }

    return (this.prisma as any).systemNotification.update({
      where: { id },
      data: {
        readBy: JSON.stringify(readByList),
        read: true,
      },
    });
  }

  async markAllSystemNotificationsRead(userId?: string, userContext?: any) {
    if (!userId) {
      return (this.prisma as any).systemNotification.updateMany({
        data: { read: true },
      });
    }

    const { notifications } = await this.getSystemNotifications(userContext);
    for (const n of notifications) {
      let readByList: string[] = [];
      try {
        readByList = JSON.parse(n.readBy || '[]');
      } catch {
        readByList = [];
      }
      if (!readByList.includes(userId)) {
        readByList.push(userId);
        await (this.prisma as any).systemNotification
          .update({
            where: { id: n.id },
            data: {
              readBy: JSON.stringify(readByList),
              read: true,
            },
          })
          .catch(() => null);
      }
    }
    return { success: true };
  }

  async deleteSystemNotification(id: string) {
    return (this.prisma as any).systemNotification.delete({
      where: { id },
    });
  }
}
