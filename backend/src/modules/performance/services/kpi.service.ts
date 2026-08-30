import { Injectable, NotFoundException } from '@nestjs/common';
import { KpiRepository } from '../repositories/kpi.repository';

@Injectable()
export class KpiService {
  constructor(private readonly repository: KpiRepository) {}

  async create(companyId: string, companyName: string, data: any) {
    return this.repository.create(companyId, companyName, {
      name: data.name,
      department: data.department || 'All',
      weight: data.weight || 1.0,
      measurementType: data.measurementType || 'Manual',
      target: data.target || 100.0,
      currentValue: data.currentValue || 0.0,
      active: data.active !== undefined ? data.active : true,
    });
  }

  async findAll(companyId?: string | null, department?: string) {
    return this.repository.findMany(companyId, department);
  }

  async findById(id: string, companyId?: string | null) {
    const kpi = await this.repository.findById(id, companyId);
    if (!kpi) {
      throw new NotFoundException(`KPI definition with ID "${id}" not found`);
    }
    return kpi;
  }

  async update(id: string, companyId: string | null, data: any) {
    const kpi = await this.repository.findById(id, companyId);
    if (!kpi) {
      throw new NotFoundException(`KPI definition with ID "${id}" not found`);
    }

    return this.repository.update(id, {
      name: data.name !== undefined ? data.name : kpi.name,
      department:
        data.department !== undefined ? data.department : kpi.department,
      weight: data.weight !== undefined ? data.weight : kpi.weight,
      measurementType:
        data.measurementType !== undefined
          ? data.measurementType
          : kpi.measurementType,
      target: data.target !== undefined ? data.target : kpi.target,
      currentValue:
        data.currentValue !== undefined ? data.currentValue : kpi.currentValue,
      active: data.active !== undefined ? data.active : kpi.active,
    });
  }

  async delete(id: string, companyId?: string | null) {
    const kpi = await this.repository.findById(id, companyId);
    if (!kpi) {
      throw new NotFoundException(`KPI definition with ID "${id}" not found`);
    }
    return this.repository.delete(id);
  }
}
