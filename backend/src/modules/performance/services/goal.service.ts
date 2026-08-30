import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalRepository } from '../repositories/goal.repository';

@Injectable()
export class GoalService {
  constructor(private readonly repository: GoalRepository) {}

  async create(companyId: string, companyName: string, data: any) {
    return this.repository.create(companyId, companyName, {
      employeeId: data.employeeId,
      title: data.title,
      description: data.description || '',
      targetDate: data.targetDate,
      progress: data.progress || 0.0,
      status: data.status || 'In Progress',
    });
  }

  async findAll(
    companyId?: string | null,
    employeeId?: string,
    options?: { page?: number; limit?: number },
  ) {
    return this.repository.findMany(companyId, employeeId, options);
  }

  async findById(id: string, companyId?: string | null) {
    const goal = await this.repository.findById(id, companyId);
    if (!goal) {
      throw new NotFoundException(`Goal with ID "${id}" not found`);
    }
    return goal;
  }

  async update(id: string, companyId: string | null, data: any) {
    const goal = await this.repository.findById(id, companyId);
    if (!goal) {
      throw new NotFoundException(`Goal with ID "${id}" not found`);
    }

    return this.repository.update(id, {
      title: data.title !== undefined ? data.title : goal.title,
      description:
        data.description !== undefined ? data.description : goal.description,
      targetDate:
        data.targetDate !== undefined ? data.targetDate : goal.targetDate,
      progress: data.progress !== undefined ? data.progress : goal.progress,
      status: data.status !== undefined ? data.status : goal.status,
    });
  }

  async delete(id: string, companyId?: string | null) {
    const goal = await this.repository.findById(id, companyId);
    if (!goal) {
      throw new NotFoundException(`Goal with ID "${id}" not found`);
    }
    return this.repository.delete(id);
  }
}
