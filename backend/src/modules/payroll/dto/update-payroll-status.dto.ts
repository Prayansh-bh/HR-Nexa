import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdatePayrollStatusDto {
  @ApiProperty({
    example: 'PAYMENT_INITIATED',
    enum: ['APPROVED', 'LOCKED', 'PAYMENT_INITIATED', 'PAID', 'Draft', 'Processed', 'Paid'],
    description: 'Updated payroll slip status',
  })
  @IsNotEmpty({ message: 'status is required' })
  @IsString({ message: 'status must be a string' })
  @IsIn([
    'APPROVED',
    'LOCKED',
    'PAYMENT_INITIATED',
    'PAID',
    'DRAFT',
    'CALCULATED',
    'Draft',
    'Processed',
    'Paid',
  ])
  status: string;
}
