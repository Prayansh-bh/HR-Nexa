import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { CreateDesignationDto } from '../dto/create-designation.dto';
import { DepartmentsRepository } from '../repositories/departments.repository';

@Injectable()
export class DepartmentsService {
  constructor(private departmentsRepository: DepartmentsRepository) {}

  async findAllDepartments(options?: { page?: number; limit?: number }) {
    return this.departmentsRepository.findAllDepartments(options);
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const existing = await this.departmentsRepository.findDepartmentByName(
      dto.name,
    );
    if (existing) {
      throw new ConflictException(
        `Department with name ${dto.name} already exists`,
      );
    }
    return this.departmentsRepository.createDepartment(dto);
  }

  async deleteDepartment(id: string, subscriptionId?: string) {
    const dept = await this.departmentsRepository.findDepartmentById(id);
    if (!dept || (subscriptionId && dept.subscriptionId !== subscriptionId)) {
      throw new NotFoundException(`Department record with ID "${id}" not found`);
    }
    return this.departmentsRepository.deleteDepartment(id);
  }

  async findAllDesignations(options?: { page?: number; limit?: number }) {
    return this.departmentsRepository.findAllDesignations(options);
  }

  async findDesignationsByDepartment(departmentId: string) {
    return this.departmentsRepository.findDesignationsByDepartment(
      departmentId,
    );
  }

  async createDesignation(dto: CreateDesignationDto) {
    const existing = await this.departmentsRepository.findDesignationByName(
      dto.name,
    );
    if (existing) {
      throw new ConflictException(
        `Designation with name ${dto.name} already exists`,
      );
    }
    return this.departmentsRepository.createDesignation(dto);
  }

  async deleteDesignation(id: string, subscriptionId?: string) {
    const desig = await this.departmentsRepository.findDesignationById(id);
    if (!desig || (subscriptionId && desig.subscriptionId !== subscriptionId)) {
      throw new NotFoundException(`Designation record with ID "${id}" not found`);
    }
    return this.departmentsRepository.deleteDesignation(id);
  }
}
