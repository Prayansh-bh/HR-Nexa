import { createPaginatedResponse } from './paginated-response.dto';

describe('createPaginatedResponse', () => {
  it('should correctly format standard paginated responses', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const res = createPaginatedResponse(data, 10, 1, 2);
    expect(res).toEqual({
      data,
      total: 10,
      page: 1,
      limit: 2,
      totalPages: 5,
    });
  });

  it('should handle zero total items and return totalPages 0', () => {
    const res = createPaginatedResponse([], 0, 1, 50);
    expect(res).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });
  });

  it('should compute ceiling totalPages accurately on remainder division', () => {
    const data = [{ id: 1 }];
    const res = createPaginatedResponse(data, 21, 3, 10);
    expect(res.totalPages).toBe(3); // ceil(21 / 10) = 3
  });

  it('should sanitize negative or NaN inputs safely', () => {
    const res = createPaginatedResponse(null as any, -5, 0, 0);
    expect(res).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });
  });
});
