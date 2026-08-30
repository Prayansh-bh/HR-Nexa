import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { TrialRequestsService } from '../services/trial-requests.service';
import { CreateTrialRequestDto } from '../dto/create-trial-request.dto';
import { UpdateTrialRequestStatusDto } from '../dto/update-trial-request-status.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@ApiTags('Trial Requests')
@Controller('trial-requests')
export class TrialRequestsController {
  constructor(private readonly trialRequestsService: TrialRequestsService) {}

  /**
   * Public endpoint to submit a 14-day free trial request.
   * Rate limited to 10 requests per minute per IP to prevent spam.
   */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit a 14-day free trial inquiry (Public)' })
  async create(
    @Body() dto: CreateTrialRequestDto,
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    return this.trialRequestsService.create(dto, { ipAddress, userAgent });
  }

  /**
   * SuperAdmin endpoint to list all trial requests.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all trial requests (SuperAdmin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;

    return this.trialRequestsService.findAll({
      page: parsedPage,
      limit: parsedLimit,
      status,
      search,
    });
  }

  /**
   * SuperAdmin endpoint to update trial lead status and notes.
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update trial request status (SuperAdmin only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTrialRequestStatusDto,
  ) {
    return this.trialRequestsService.updateStatus(id, dto);
  }
}
