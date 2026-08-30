import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEmployeeDto } from './create-employee.dto';

export class BulkCreateEmployeeDto {
  @ApiProperty({
    type: [CreateEmployeeDto],
    description: 'Array of employee records to create in bulk',
    example: [
      {
        id: 'EMP101',
        name: 'Alice Johnson',
        email: 'alice.johnson@acme.co',
        departmentName: 'Engineering',
        designation: 'Frontend Dev',
        status: 'Active',
        joined: '2026-07-21',
        salary: 85000,
        avatar: 'AJ',
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Employees array must not be empty' })
  @ArrayMaxSize(500, {
    message: 'Cannot bulk import more than 500 employees per request',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeDto)
  employees: CreateEmployeeDto[];
}

export interface BulkEmployeeError {
  row: number; // 1-indexed human-readable row
  index: number; // 0-indexed array position
  id?: string;
  email?: string;
  name?: string;
  reason: string;
  code?: string;
}

export interface BulkCreateResponseDto {
  total: number;
  successful: number;
  failed: number;
  createdEmployees: any[];
  errors: BulkEmployeeError[];
}
