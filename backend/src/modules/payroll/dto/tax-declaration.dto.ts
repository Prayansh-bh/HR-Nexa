import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TaxDeclarationItemDto {
  @ApiProperty({ example: '80C', description: 'Tax section code' })
  @IsNotEmpty()
  @IsString()
  section: string;

  @ApiProperty({ example: 'PPF', description: 'Investment sub-category' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ example: 150000, description: 'Declared investment amount' })
  @IsNumber()
  @Min(0)
  declaredAmount: number;

  @ApiPropertyOptional({ example: 'doc-uuid-123', description: 'Linked document proof ID' })
  @IsOptional()
  @IsString()
  proofDocumentId?: string;

  @ApiPropertyOptional({ example: 'Public Provident Fund annual deposit receipt', description: 'Item notes' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateTaxDeclarationDto {
  @ApiProperty({ example: 'fy-uuid-123', description: 'Fiscal Year ID' })
  @IsNotEmpty()
  @IsString()
  fiscalYearId: string;

  @ApiProperty({ example: 'OLD', enum: ['OLD', 'NEW'], description: 'Chosen tax regime' })
  @IsEnum(['OLD', 'NEW'])
  regime: 'OLD' | 'NEW';

  @ApiProperty({ type: [TaxDeclarationItemDto], description: 'Itemized section investment declarations' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxDeclarationItemDto)
  items: TaxDeclarationItemDto[];
}

export class ItemApprovalDto {
  @ApiProperty({ example: 'item-uuid-123', description: 'Item ID' })
  @IsNotEmpty()
  @IsString()
  itemId: string;

  @ApiProperty({ example: 150000, description: 'Approved amount for this item' })
  @IsNumber()
  @Min(0)
  approvedAmount: number;

  @ApiPropertyOptional({ example: 'Verified receipt', description: 'Reviewer remark' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class AuditTaxDeclarationDto {
  @ApiProperty({ example: 'APPROVED', enum: ['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'] })
  @IsEnum(['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'])
  decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED';

  @ApiPropertyOptional({ example: 'All investment proofs verified successfully', description: 'Overall audit remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ type: [ItemApprovalDto], description: 'Itemized approved amounts' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemApprovalDto)
  itemApprovals?: ItemApprovalDto[];
}
