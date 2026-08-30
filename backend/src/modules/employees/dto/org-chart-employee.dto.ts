import { ApiProperty } from '@nestjs/swagger';

export class OrgChartEmployeeDto {
  @ApiProperty({ example: 'emp-001', description: 'Employee ID' })
  id: string;

  @ApiProperty({ example: 'Aarav Sharma', description: 'Employee Full Name' })
  name: string;

  @ApiProperty({ example: 'AS', nullable: true, description: 'Avatar initials or image URL' })
  avatar: string | null;

  @ApiProperty({ example: 'emp-000', nullable: true, description: 'Manager Employee ID' })
  managerId: string | null;

  @ApiProperty({ example: 'Software Engineer', nullable: true, description: 'Designation Name' })
  designation: string | null;

  @ApiProperty({ example: 'Engineering', nullable: true, description: 'Department Name' })
  department: string | null;
}
