import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GeoZone } from '@prisma/client';

export interface CreateGeoZoneData {
  name: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  address?: string | null;
  enabled?: boolean;
}

export interface UpdateGeoZoneData {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
  address?: string | null;
  enabled?: boolean;
}

@Injectable()
export class ZonesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all geo-fencing zones strictly scoped to the given tenant.
   */
  async findAll(companyId: string): Promise<GeoZone[]> {
    if (!companyId) return [];
    return this.prisma.geoZone.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves a single geo-fencing zone by ID with tenant ownership verification.
   */
  async findById(companyId: string, id: string): Promise<GeoZone | null> {
    if (!companyId || !id) return null;
    return this.prisma.geoZone.findFirst({
      where: { id, companyId },
    });
  }

  /**
   * Finds a zone by name within the specific tenant (for uniqueness checks).
   */
  async findByName(companyId: string, name: string): Promise<GeoZone | null> {
    if (!companyId || !name) return null;
    return this.prisma.geoZone.findFirst({
      where: { name, companyId },
    });
  }

  /**
   * Retrieves only active and fully configured (non-null coordinates) zones for a tenant.
   */
  async findActiveValid(companyId: string): Promise<GeoZone[]> {
    if (!companyId) return [];
    return this.prisma.geoZone.findMany({
      where: {
        companyId,
        enabled: true,
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates a new geo-fencing zone strictly linked to the tenant company.
   */
  async create(companyId: string, data: CreateGeoZoneData): Promise<GeoZone> {
    return this.prisma.geoZone.create({
      data: {
        companyId,
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        radiusMeters: data.radiusMeters,
        address: data.address ?? null,
        enabled: data.enabled ?? true,
      },
    });
  }

  /**
   * Updates a geo-fencing zone ensuring tenant isolation.
   */
  async update(
    companyId: string,
    id: string,
    data: UpdateGeoZoneData,
  ): Promise<GeoZone | null> {
    const existing = await this.findById(companyId, id);
    if (!existing) return null;

    return this.prisma.geoZone.update({
      where: { id: existing.id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        latitude: data.latitude !== undefined ? data.latitude : existing.latitude,
        longitude: data.longitude !== undefined ? data.longitude : existing.longitude,
        radiusMeters: data.radiusMeters !== undefined ? data.radiusMeters : existing.radiusMeters,
        address: data.address !== undefined ? data.address : existing.address,
        enabled: data.enabled !== undefined ? data.enabled : existing.enabled,
      },
    });
  }

  /**
   * Deletes a geo-fencing zone ensuring tenant isolation.
   */
  async delete(companyId: string, id: string): Promise<boolean> {
    const existing = await this.findById(companyId, id);
    if (!existing) return false;

    await this.prisma.geoZone.delete({
      where: { id: existing.id },
    });
    return true;
  }
}
