import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type ExpenseClaimStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PAYABLE'
  | 'PAID'
  | 'REJECTED'
  | 'CORRECTION_REQUIRED'
  | 'CANCELLED';

export type ExpensePaymentStatus = 'UNPAID' | 'PROCESSING' | 'PAID';
export type ExpensePaymentMethod = 'PAYROLL' | 'BANK_TRANSFER' | 'OFF_CYCLE';
export type ExpenseTaxTreatment = 'TAXABLE' | 'NON_TAXABLE';

export class CreateExpenseCategoryDto {
  @ApiProperty({ example: 'Travel & Conveyance', description: 'Category display name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'TRAVEL_LOCAL', description: 'Unique category code' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiPropertyOptional({ example: 'Local travel, taxi, auto, and train tickets for business trips', description: 'Category details' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 5000, description: 'Optional maximum limit per claim item' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLimit?: number;

  @ApiPropertyOptional({ example: true, description: 'Require proof receipt document' })
  @IsOptional()
  @IsBoolean()
  requireReceipt?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Whether payouts in this category are taxable' })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;
}

export class UpdateExpenseCategoryDto {
  @ApiPropertyOptional({ example: 'Travel & Conveyance' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLimit?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requireReceipt?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ExpenseClaimItemDto {
  @ApiProperty({ example: 'cat-uuid-123', description: 'Category ID' })
  @IsNotEmpty()
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 1250.5, description: 'Expense amount in INR' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-07-16', description: 'Date expense was incurred' })
  @IsNotEmpty()
  @IsString()
  expenseDate: string;

  @ApiPropertyOptional({ example: 'Uber India', description: 'Merchant name' })
  @IsOptional()
  @IsString()
  merchant?: string;

  @ApiPropertyOptional({ example: 'Taxi to client office meeting', description: 'Itemized description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'doc-uuid-123', description: 'Linked receipt document ID' })
  @IsOptional()
  @IsString()
  receiptDocumentId?: string;

  @ApiPropertyOptional({ example: 'Bill attached', description: 'Remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateExpenseClaimDto {
  @ApiProperty({ example: 'fy-uuid-123', description: 'Fiscal Year ID' })
  @IsNotEmpty()
  @IsString()
  fiscalYearId: string;

  @ApiProperty({ example: 'Q2 Client Onsite Visit Expenses', description: 'Claim Title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Expenses incurred during client visit in Mumbai', description: 'Claim description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [ExpenseClaimItemDto], description: 'Itemized expense line items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseClaimItemDto)
  items: ExpenseClaimItemDto[];
}

export class UpdateExpenseClaimDto {
  @ApiPropertyOptional({ example: 'Updated Title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [ExpenseClaimItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseClaimItemDto)
  items?: ExpenseClaimItemDto[];
}

export class ReviewItemApprovalDto {
  @ApiProperty({ example: 'item-uuid-123' })
  @IsNotEmpty()
  @IsString()
  itemId: string;

  @ApiProperty({ example: 1250.5 })
  @IsNumber()
  @Min(0)
  approvedAmount: number;

  @ApiPropertyOptional({ example: 'TAXABLE', enum: ['TAXABLE', 'NON_TAXABLE'] })
  @IsOptional()
  @IsEnum(['TAXABLE', 'NON_TAXABLE'])
  taxTreatment?: 'TAXABLE' | 'NON_TAXABLE';

  @ApiPropertyOptional({ example: 'Verified' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ReviewExpenseClaimDto {
  @ApiProperty({ example: 'APPROVED', enum: ['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'] })
  @IsEnum(['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'])
  decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED';

  @ApiPropertyOptional({ example: 'All receipts verified according to policy' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ type: [ReviewItemApprovalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemApprovalDto)
  itemApprovals?: ReviewItemApprovalDto[];
}

export class PayExpenseClaimDto {
  @ApiProperty({ example: 'BANK_TRANSFER', enum: ['PAYROLL', 'BANK_TRANSFER', 'OFF_CYCLE'] })
  @IsEnum(['PAYROLL', 'BANK_TRANSFER', 'OFF_CYCLE'])
  paymentMethod: 'PAYROLL' | 'BANK_TRANSFER' | 'OFF_CYCLE';

  @ApiPropertyOptional({ example: 'NEFT-20260716-9921', description: 'Bank transaction reference or check number' })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({ example: 'Disbursed via bank transfer' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
