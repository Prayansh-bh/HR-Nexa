import { ZonesRepository } from './zones.repository';
import { PrismaService } from '../../../prisma/prisma.service';

describe('ZonesRepository (Tenant Isolation)', () => {
  let repository: ZonesRepository;
  let prismaMock: any;

  const tenantA = 'tenant-a-company-id';
  const tenantB = 'tenant-b-company-id';

  beforeEach(() => {
    prismaMock = {
      geoZone: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    repository = new ZonesRepository(prismaMock as unknown as PrismaService);
  });

  describe('1. findAll(companyId)', () => {
    it('strictly filters by companyId', async () => {
      prismaMock.geoZone.findMany.mockResolvedValue([
        { id: 'zone-1', name: 'HQ A', companyId: tenantA },
      ]);

      const result = await repository.findAll(tenantA);

      expect(prismaMock.geoZone.findMany).toHaveBeenCalledWith({
        where: { companyId: tenantA },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('returns empty array if companyId is missing', async () => {
      const result = await repository.findAll('');
      expect(result).toEqual([]);
      expect(prismaMock.geoZone.findMany).not.toHaveBeenCalled();
    });
  });

  describe('2. findById(companyId, id)', () => {
    it('queries with compound where { id, companyId }', async () => {
      prismaMock.geoZone.findFirst.mockResolvedValue({
        id: 'zone-1',
        name: 'HQ A',
        companyId: tenantA,
      });

      const result = await repository.findById(tenantA, 'zone-1');

      expect(prismaMock.geoZone.findFirst).toHaveBeenCalledWith({
        where: { id: 'zone-1', companyId: tenantA },
      });
      expect(result?.companyId).toBe(tenantA);
    });

    it('returns null if zone belongs to a different tenant', async () => {
      prismaMock.geoZone.findFirst.mockResolvedValue(null);

      const result = await repository.findById(tenantB, 'zone-1');
      expect(result).toBeNull();
    });
  });

  describe('3. findActiveValid(companyId)', () => {
    it('filters for enabled: true and non-null coordinates strictly within tenant', async () => {
      prismaMock.geoZone.findMany.mockResolvedValue([
        {
          id: 'zone-1',
          name: 'HQ A',
          companyId: tenantA,
          latitude: 12.9716,
          longitude: 77.5946,
          enabled: true,
        },
      ]);

      const result = await repository.findActiveValid(tenantA);

      expect(prismaMock.geoZone.findMany).toHaveBeenCalledWith({
        where: {
          companyId: tenantA,
          enabled: true,
          latitude: { not: null },
          longitude: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('4. update(companyId, id, data)', () => {
    it('prevents cross-tenant updates by checking ownership first', async () => {
      prismaMock.geoZone.findFirst.mockResolvedValue(null);

      const result = await repository.update(tenantA, 'zone-belonging-to-b', {
        name: 'Hacked Name',
      });

      expect(result).toBeNull();
      expect(prismaMock.geoZone.update).not.toHaveBeenCalled();
    });

    it('updates when tenant owns the zone', async () => {
      prismaMock.geoZone.findFirst.mockResolvedValue({
        id: 'zone-1',
        name: 'Old Name',
        companyId: tenantA,
      });
      prismaMock.geoZone.update.mockResolvedValue({
        id: 'zone-1',
        name: 'New Name',
        companyId: tenantA,
      });

      const result = await repository.update(tenantA, 'zone-1', {
        name: 'New Name',
      });

      expect(prismaMock.geoZone.update).toHaveBeenCalledWith({
        where: { id: 'zone-1' },
        data: expect.objectContaining({ name: 'New Name' }),
      });
      expect(result?.name).toBe('New Name');
    });
  });

  describe('5. delete(companyId, id)', () => {
    it('prevents cross-tenant deletion', async () => {
      prismaMock.geoZone.findFirst.mockResolvedValue(null);

      const result = await repository.delete(tenantA, 'zone-belonging-to-b');

      expect(result).toBe(false);
      expect(prismaMock.geoZone.delete).not.toHaveBeenCalled();
    });

    it('deletes when tenant owns the zone', async () => {
      prismaMock.geoZone.findFirst.mockResolvedValue({
        id: 'zone-1',
        companyId: tenantA,
      });
      prismaMock.geoZone.delete.mockResolvedValue({ id: 'zone-1' });

      const result = await repository.delete(tenantA, 'zone-1');

      expect(prismaMock.geoZone.delete).toHaveBeenCalledWith({
        where: { id: 'zone-1' },
      });
      expect(result).toBe(true);
    });
  });
});
