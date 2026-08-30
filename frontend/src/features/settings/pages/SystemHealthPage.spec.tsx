import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { SystemHealthPage } from './SystemHealthPage';
import axiosInstance from '../../../api/axios';
import { ENDPOINTS } from '../../../constants/endpoints';

vi.mock('../../../api/axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('SystemHealthPage (F-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('polls /system/metrics and renders live telemetry successfully', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: {
        cpuUsage: '22%',
        cpuUsageNumeric: 22,
        hostMemoryUsed: '4.5 GB',
        hostMemoryTotal: '16.0 GB',
        memoryUsedGb: 4.5,
        memoryTotalGb: 16.0,
        storageUsedGb: 28.5,
        storageTotalGb: 200,
        uptimeSeconds: 7200,
        errorRate: 0.01,
        apiStatus: 'Operational',
      },
    });

    render(<SystemHealthPage />);

    expect(screen.getByText('System Health Dashboard')).toBeInTheDocument();

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith(ENDPOINTS.SYSTEM.METRICS);
      expect(screen.getByText('22%')).toBeInTheDocument();
      expect(screen.getByText('28.5 GB')).toBeInTheDocument();
    });
  });
});
