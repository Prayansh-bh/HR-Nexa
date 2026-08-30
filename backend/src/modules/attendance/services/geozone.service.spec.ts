import { GeoZoneService } from './geozone.service';
import { ZonesRepository } from '../repositories/zones.repository';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('GeoZoneService', () => {
  let service: GeoZoneService;
  let repositoryMock: any;
  let auditLoggerMock: any;

  const tenantUser = {
    id: 'user-1',
    name: 'HR Admin',
    email: 'admin@acme.com',
    role: 'HRAdmin',
    companyId: 'C1',
  };

  beforeEach(() => {
    repositoryMock = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findActiveValid: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    auditLoggerMock = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };

    service = new GeoZoneService(
      repositoryMock as unknown as ZonesRepository,
      auditLoggerMock as unknown as AuditLoggerService,
    );
  });

  describe('1. create', () => {
    it('creates a zone with valid numeric coordinates and emits an audit event', async () => {
      repositoryMock.findByName.mockResolvedValue(null);
      repositoryMock.create.mockResolvedValue({
        id: 'zone-1',
        name: 'Pune HQ',
        latitude: 18.5204,
        longitude: 73.8567,
        radiusMeters: 150,
        address: 'MG Road',
        enabled: true,
        companyId: 'C1',
      });

      const result = await service.create(tenantUser, {
        name: 'Pune HQ',
        latitude: 18.5204,
        longitude: 73.8567,
        radiusMeters: 150,
        address: 'MG Road',
        enabled: true,
      });

      expect(result.name).toBe('Pune HQ');
      expect(repositoryMock.create).toHaveBeenCalledWith('C1', {
        name: 'Pune HQ',
        latitude: 18.5204,
        longitude: 73.8567,
        radiusMeters: 150,
        address: 'MG Road',
        enabled: true,
      });
      expect(auditLoggerMock.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GEO_ZONE_CREATED', companyId: 'C1' }),
      );
    });

    it('rejects out-of-bounds latitude', async () => {
      await expect(
        service.create(tenantUser, {
          name: 'Invalid Lat',
          latitude: 95.0,
          longitude: 73.8567,
          radiusMeters: 150,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate zone name within same company', async () => {
      repositoryMock.findByName.mockResolvedValue({ id: 'existing-id', name: 'Pune HQ' });

      await expect(
        service.create(tenantUser, {
          name: 'Pune HQ',
          latitude: 18.5204,
          longitude: 73.8567,
          radiusMeters: 150,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('2. update & legacy validation', () => {
    it('prevents enabling an incomplete legacy zone with null longitude', async () => {
      repositoryMock.findById.mockResolvedValue({
        id: 'legacy-1',
        name: 'HQ Office Zone',
        latitude: 19.076,
        longitude: null, // Missing longitude
        radiusMeters: 100,
        enabled: false,
        companyId: 'C1',
      });

      // Attempt to enable without supplying valid longitude
      await expect(
        service.update(tenantUser, 'legacy-1', {
          enabled: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows enabling an incomplete zone once valid longitude is provided', async () => {
      repositoryMock.findById.mockResolvedValue({
        id: 'legacy-1',
        name: 'HQ Office Zone',
        latitude: 19.076,
        longitude: null,
        radiusMeters: 100,
        enabled: false,
        companyId: 'C1',
      });
      repositoryMock.update.mockResolvedValue({
        id: 'legacy-1',
        name: 'HQ Office Zone',
        latitude: 19.076,
        longitude: 72.8777,
        radiusMeters: 100,
        enabled: true,
        companyId: 'C1',
      });

      const updated = await service.update(tenantUser, 'legacy-1', {
        longitude: 72.8777,
        enabled: true,
      });

      expect(updated?.enabled).toBe(true);
      expect(repositoryMock.update).toHaveBeenCalledWith('C1', 'legacy-1', {
        longitude: 72.8777,
        enabled: true,
      });
    });
  });

  describe('3. delete', () => {
    it('deletes zone and logs audit event', async () => {
      repositoryMock.findById.mockResolvedValue({
        id: 'zone-1',
        name: 'Pune HQ',
        companyId: 'C1',
      });

      const res = await service.delete(tenantUser, 'zone-1');
      expect(res.success).toBe(true);
      expect(repositoryMock.delete).toHaveBeenCalledWith('C1', 'zone-1');
      expect(auditLoggerMock.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GEO_ZONE_DELETED' }),
      );
    });

    it('throws NotFoundException if zone does not exist or not owned', async () => {
      repositoryMock.findById.mockResolvedValue(null);

      await expect(service.delete(tenantUser, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
