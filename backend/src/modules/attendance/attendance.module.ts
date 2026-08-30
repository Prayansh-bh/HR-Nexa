import { Module } from '@nestjs/common';
import { AttendanceService } from './services/attendance.service';
import { AttendanceMatrixService } from './services/attendance-matrix.service';
import { GeoZoneService } from './services/geozone.service';
import { AttendanceController } from './controllers/attendance.controller';
import { AttendanceRepository } from './repositories/attendance.repository';
import { DevicesRepository } from './repositories/devices.repository';
import { ZonesRepository } from './repositories/zones.repository';
import { AttendanceSettingsRepository } from './repositories/settings.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceMatrixService,
    GeoZoneService,
    AttendanceRepository,
    DevicesRepository,
    ZonesRepository,
    AttendanceSettingsRepository,
  ],
  exports: [
    AttendanceService,
    AttendanceMatrixService,
    GeoZoneService,
    AttendanceRepository,
    DevicesRepository,
    ZonesRepository,
    AttendanceSettingsRepository,
  ],
})
export class AttendanceModule {}
