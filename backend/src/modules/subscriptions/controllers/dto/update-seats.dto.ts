import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSeatsDto {
  @ApiProperty({
    description: 'Total purchased seat capacity for the company',
    example: 50,
    minimum: 1,
  })
  @IsInt({ message: 'Purchased seats must be an integer.' })
  @Min(1, { message: 'Purchased seats must be at least 1.' })
  seats: number;
}
