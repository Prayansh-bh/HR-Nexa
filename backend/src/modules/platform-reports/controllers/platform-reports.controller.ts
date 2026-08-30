import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { PlatformReportsService } from '../services/platform-reports.service';
import { ReportQueryDto } from '../dto/report-query.dto';

@ApiTags('SuperAdmin Platform Reports')
@Controller('platform/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin)
@ApiBearerAuth()
export class PlatformReportsController {
  constructor(private readonly reportsService: PlatformReportsService) {}

  @Get('types')
  @ApiOperation({ summary: 'Get list of available platform report types' })
  getReportTypes() {
    return this.reportsService.getReportTypes();
  }

  @Get('generate')
  @ApiOperation({
    summary: 'Generate JSON platform report data with filters and pagination',
  })
  async generateReport(
    @Query() query: ReportQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';
    return this.reportsService.generateReport(
      query,
      { id: req.user.id, name: req.user.name, role: req.user.role },
      ip,
      userAgent,
    );
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export platform report file (CSV, Excel, PDF/HTML)',
  })
  async exportReport(
    @Query() query: ReportQueryDto,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';

    const result = await this.reportsService.exportReport(
      query,
      { id: req.user.id, name: req.user.name, role: req.user.role },
      ip,
      userAgent,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    return res.send(result.buffer);
  }
}
