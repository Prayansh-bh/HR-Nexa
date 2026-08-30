import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyCheckoutPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'razorpay_order_id is required' })
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  razorpay_order_id!: string;

  @IsString()
  @IsNotEmpty({ message: 'razorpay_payment_id is required' })
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  razorpay_payment_id!: string;

  @IsString()
  @IsNotEmpty({ message: 'razorpay_signature is required' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  razorpay_signature!: string;
}
