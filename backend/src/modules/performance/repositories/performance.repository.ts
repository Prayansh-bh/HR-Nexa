import { Injectable } from '@nestjs/common';

@Injectable()
export class PerformanceRepository {
  async getAppraisals(employeeId?: string) {
    const list = [
      {
        id: 'REV-2026-Q1',
        employeeId: 'EMP001',
        employeeName: 'Aarav Sharma',
        cycle: 'Q1 2026',
        rating: 4.8,
        status: 'Completed',
        submittedDate: '2026-04-05',
      },
      {
        id: 'REV-2026-Q2',
        employeeId: 'EMP002',
        employeeName: 'Priya Menon',
        cycle: 'Q2 2026',
        rating: 4.5,
        status: 'Manager-Reviewed',
        submittedDate: '2026-07-01',
      },
    ];
    if (employeeId)
      return Promise.resolve(list.filter((r) => r.employeeId === employeeId));
    return Promise.resolve(list);
  }

  async getGoals(employeeId?: string) {
    const list = [
      {
        id: 'GOAL-01',
        employeeId: 'EMP001',
        title: 'Migrate backend architecture to modular pattern',
        targetDate: '2026-08-15',
        progressPercentage: 80,
        status: 'In Progress',
      },
      {
        id: 'GOAL-02',
        employeeId: 'EMP002',
        title: 'Redesign employee profile UI',
        targetDate: '2026-07-31',
        progressPercentage: 100,
        status: 'Completed',
      },
    ];
    if (employeeId)
      return Promise.resolve(list.filter((g) => g.employeeId === employeeId));
    return Promise.resolve(list);
  }
}
