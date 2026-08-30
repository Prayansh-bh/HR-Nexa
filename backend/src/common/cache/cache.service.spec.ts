import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  it('should store and retrieve value', () => {
    cacheService.set('test_key', { data: 123 }, 60);
    const result = cacheService.get<{ data: number }>('test_key');
    expect(result).toEqual({ data: 123 });
  });

  it('should return null for expired key', () => {
    cacheService.set('expired_key', 'val', -1);
    const result = cacheService.get<string>('expired_key');
    expect(result).toBeNull();
  });

  it('should invalidate keys by pattern', () => {
    cacheService.set('dashboard:1', 'd1');
    cacheService.set('dashboard:2', 'd2');
    cacheService.set('reports:1', 'r1');

    cacheService.delByPattern('dashboard:*');

    expect(cacheService.get('dashboard:1')).toBeNull();
    expect(cacheService.get('dashboard:2')).toBeNull();
    expect(cacheService.get('reports:1')).toBe('r1');
  });
});
