import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { ZonesRepository } from '../repositories/zones.repository';
import { CreateGeoZoneDto } from '../dto/create-geozone.dto';
import { UpdateGeoZoneDto } from '../dto/update-geozone.dto';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { isValidCoordinate, isValidRadius } from '../../../common/utils/geo.util';

@Injectable()
export class GeoZoneService {
  constructor(
    private readonly zonesRepository: ZonesRepository,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  private getTenantId(currentUser: any): string {
    const tenantId =
      currentUser?.companyId || currentUser?.subscriptionId || (currentUser?.role === 'SuperAdmin' ? 'C1' : null);
    if (!tenantId) {
      throw new BadRequestException('Tenant context could not be established');
    }
    return tenantId;
  }

  async findAll(currentUser: any) {
    const tenantId = this.getTenantId(currentUser);
    return this.zonesRepository.findAll(tenantId);
  }

  async findById(currentUser: any, id: string) {
    const tenantId = this.getTenantId(currentUser);
    const zone = await this.zonesRepository.findById(tenantId, id);
    if (!zone) {
      throw new NotFoundException(`Geo-fencing zone with ID "${id}" not found`);
    }
    return zone;
  }

  async findActiveValid(tenantId: string) {
    if (!tenantId) return [];
    return this.zonesRepository.findActiveValid(tenantId);
  }

  async create(currentUser: any, dto: CreateGeoZoneDto) {
    const tenantId = this.getTenantId(currentUser);

    // Validate coordinates
    if (!isValidCoordinate(dto.latitude, dto.longitude)) {
      throw new BadRequestException(
        `Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180`,
      );
    }

    // Validate radius
    if (!isValidRadius(dto.radiusMeters)) {
      throw new BadRequestException(
        `Invalid radius: must be a positive number up to 10,000 meters`,
      );
    }

    // Check duplicate name within tenant
    const existing = await this.zonesRepository.findByName(tenantId, dto.name.trim());
    if (existing) {
      throw new ConflictException(
        `A geo-fencing zone with name "${dto.name.trim()}" already exists in your organization`,
      );
    }

    const created = await this.zonesRepository.create(tenantId, {
      name: dto.name.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusMeters: dto.radiusMeters,
      address: dto.address?.trim() ?? null,
      enabled: dto.enabled ?? true,
    });

    if (this.auditLogger) {
      await this.auditLogger.logAction({
        userId: currentUser?.id,
        userName: currentUser?.name || currentUser?.email,
        companyId: tenantId,
        action: 'GEO_ZONE_CREATED',
        newValue: created,
        details: `Created geo-fencing zone "${created.name}" (Radius: ${created.radiusMeters}m)`,
      });
    }

    return created;
  }

  async update(currentUser: any, id: string, dto: UpdateGeoZoneDto) {
    const tenantId = this.getTenantId(currentUser);

    const existing = await this.zonesRepository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Geo-fencing zone with ID "${id}" not found`);
    }

    // If changing name, check duplicate within tenant
    if (dto.name && dto.name.trim() !== existing.name) {
      const duplicate = await this.zonesRepository.findByName(tenantId, dto.name.trim());
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `A geo-fencing zone with name "${dto.name.trim()}" already exists in your organization`,
        );
      }
    }

    const newLat = dto.latitude !== undefined ? dto.latitude : existing.latitude;
    const newLon = dto.longitude !== undefined ? dto.longitude : existing.longitude;
    const newRadius = dto.radiusMeters !== undefined ? dto.radiusMeters : existing.radiusMeters;
    const newEnabled = dto.enabled !== undefined ? dto.enabled : existing.enabled;

    // Enforce that a zone cannot be enabled if coordinates are incomplete or invalid
    if (newEnabled) {
      if (newLat === null || newLon === null || !isValidCoordinate(newLat, newLon)) {
        throw new BadRequestException(
          'Cannot enable geo-fencing zone with incomplete or invalid latitude/longitude coordinates',
        );
      }
      if (!isValidRadius(newRadius)) {
        throw new BadRequestException(
          'Cannot enable geo-fencing zone with invalid radius',
        );
      }
    }

    const updated = await this.zonesRepository.update(tenantId, id, {
      name: dto.name ? dto.name.trim() : undefined,
      latitude: dto.latitude !== undefined ? dto.latitude : undefined,
      longitude: dto.longitude !== undefined ? dto.longitude : undefined,
      radiusMeters: dto.radiusMeters !== undefined ? dto.radiusMeters : undefined,
      address: dto.address !== undefined ? (dto.address ? dto.address.trim() : null) : undefined,
      enabled: dto.enabled !== undefined ? dto.enabled : undefined,
    });

    if (this.auditLogger && updated) {
      await this.auditLogger.logAction({
        userId: currentUser?.id,
        userName: currentUser?.name || currentUser?.email,
        companyId: tenantId,
        action: 'GEO_ZONE_UPDATED',
        oldValue: existing,
        newValue: updated,
        details: `Updated geo-fencing zone "${updated.name}"`,
      });
    }

    return updated;
  }

  async delete(currentUser: any, id: string) {
    const tenantId = this.getTenantId(currentUser);

    const existing = await this.zonesRepository.findById(tenantId, id);
    if (!existing) {
      throw new NotFoundException(`Geo-fencing zone with ID "${id}" not found`);
    }

    await this.zonesRepository.delete(tenantId, id);

    if (this.auditLogger) {
      await this.auditLogger.logAction({
        userId: currentUser?.id,
        userName: currentUser?.name || currentUser?.email,
        companyId: tenantId,
        action: 'GEO_ZONE_DELETED',
        oldValue: existing,
        details: `Deleted geo-fencing zone "${existing.name}"`,
      });
    }

    return { success: true, message: `Geo-fencing zone "${existing.name}" deleted successfully` };
  }
}
