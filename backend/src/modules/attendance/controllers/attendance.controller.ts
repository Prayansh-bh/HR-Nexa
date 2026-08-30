import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AttendanceService } from '../services/attendance.service';
import { AttendanceMatrixService } from '../services/attendance-matrix.service';
import { GeoZoneService } from '../services/geozone.service';
import { ClockInDto } from '../dto/clock-in.dto';
import { CreateGeoZoneDto } from '../dto/create-geozone.dto';
import { UpdateGeoZoneDto } from '../dto/update-geozone.dto';
import { RegularizeAttendanceDto } from '../dto/regularize-attendance.dto';
import { CreateRegularizationRequestDto } from '../dto/create-regularization-request.dto';
import { ReviewRegularizationRequestDto } from '../dto/review-regularization-request.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';

@ApiTags('Attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly matrixService: AttendanceMatrixService,
    private readonly geoZoneService: GeoZoneService,
  ) {}

  @Post('clock')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_CLOCK)
  @ApiOperation({ summary: 'Clock-in or Clock-out for the day' })
  async clock(@Req() req: any, @Body() dto: ClockInDto) {
    return this.attendanceService.clockInOrOut(req.user, dto);
  }

  @Get('matrix')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Get monthly attendance matrix grid for employees' })
  @ApiQuery({
    name: 'month',
    required: true,
    type: String,
    example: 'July 2026',
  })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getMatrix(
    @Req() req: any,
    @Query('month') month: string,
    @Query('department') department?: string,
    @Query('search') search?: string,
  ) {
    return this.matrixService.getMatrix(month, department, search, req.user);
  }

  @Get()
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Get all attendance logs (tenant-scoped with pagination)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getLogs(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('employeeId') employeeId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.attendanceService.findAll(
      req.user,
      employeeId,
      date,
      status,
      { page: parsedPage, limit: parsedLimit, search },
    );
  }

  @Post('regularize-requests')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_REGULARIZE)
  @ApiOperation({ summary: 'Submit attendance regularization request' })
  async createRegularizationRequest(
    @Req() req: any,
    @Body() dto: CreateRegularizationRequestDto,
  ) {
    return this.attendanceService.createRegularizationRequest(req.user, dto);
  }

  @Get('regularize-requests')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'List attendance regularization requests (tenant-scoped)' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRegularizationRequests(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.attendanceService.getRegularizationRequests(req.user, {
      status,
      employeeId,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  @Put('regularize-requests/:id/approve')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_VERIFY)
  @ApiOperation({ summary: 'Approve an attendance regularization request' })
  async approveRegularizationRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewRegularizationRequestDto,
  ) {
    return this.attendanceService.approveRegularizationRequest(req.user, id, dto);
  }

  @Put('regularize-requests/:id/reject')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_VERIFY)
  @ApiOperation({ summary: 'Reject an attendance regularization request' })
  async rejectRegularizationRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewRegularizationRequestDto,
  ) {
    return this.attendanceService.rejectRegularizationRequest(req.user, id, dto);
  }

  @Put(':id/regularize')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_EDIT)
  @ApiOperation({ summary: 'Administrative manual attendance update' })
  async regularize(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RegularizeAttendanceDto,
  ) {
    return this.attendanceService.regularize(req.user, id, dto);
  }

  @Put(':id/verify')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_VERIFY)
  @ApiOperation({ summary: 'Approve/Verify attendance record' })
  async verify(@Req() req: any, @Param('id') id: string) {
    return this.attendanceService.verify(req.user, id);
  }

  // ── Biometric Devices ───────────────────────────────────────────────────
  @Get('devices')
  @RequirePermissions(Permission.ATTENDANCE_DEVICES_MANAGE)
  @ApiOperation({ summary: 'Get biometric devices' })
  async getDevices(@Req() req: any) {
    return this.attendanceService.getDevices(req.user);
  }

  @Post('devices')
  @RequirePermissions(Permission.ATTENDANCE_DEVICES_MANAGE)
  @ApiOperation({ summary: 'Register a biometric device' })
  async createDevice(@Req() req: any, @Body() body: { name: string; ip: string }) {
    return this.attendanceService.createDevice(req.user, body);
  }

  @Post('devices/:id/sync')
  @RequirePermissions(Permission.ATTENDANCE_DEVICES_SYNC)
  @ApiOperation({ summary: 'Sync a biometric device' })
  async syncDevice(@Req() req: any, @Param('id') id: string) {
    return this.attendanceService.syncDevice(req.user, id);
  }

  @Delete('devices/:id')
  @RequirePermissions(Permission.ATTENDANCE_DEVICES_MANAGE)
  @ApiOperation({ summary: 'Delete a biometric device' })
  async deleteDevice(@Req() req: any, @Param('id') id: string) {
    return this.attendanceService.deleteDevice(req.user, id);
  }


  // ── Geo-Fencing Zones ───────────────────────────────────────────────────
  @Get('zones')
  @RequirePermissions(Permission.ATTENDANCE_GEO_CONFIG)
  @ApiOperation({ summary: 'Get all geo-fencing zones for the authenticated tenant' })
  async getZones(@Req() req: any) {
    return this.geoZoneService.findAll(req.user);
  }

  @Get('zones/:id')
  @RequirePermissions(Permission.ATTENDANCE_GEO_CONFIG)
  @ApiOperation({ summary: 'Get a single geo-fencing zone by ID' })
  async getZoneById(@Req() req: any, @Param('id') id: string) {
    return this.geoZoneService.findById(req.user, id);
  }

  @Post('zones')
  @RequirePermissions(Permission.ATTENDANCE_GEO_CONFIG)
  @ApiOperation({ summary: 'Create a geo-fencing zone for the authenticated tenant' })
  async createZone(
    @Req() req: any,
    @Body() dto: CreateGeoZoneDto,
  ) {
    return this.geoZoneService.create(req.user, dto);
  }

  @Put('zones/:id')
  @RequirePermissions(Permission.ATTENDANCE_GEO_CONFIG)
  @ApiOperation({ summary: 'Update a geo-fencing zone' })
  async updateZone(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateGeoZoneDto,
  ) {
    return this.geoZoneService.update(req.user, id, dto);
  }

  @Delete('zones/:id')
  @RequirePermissions(Permission.ATTENDANCE_GEO_CONFIG)
  @ApiOperation({ summary: 'Delete a geo-fencing zone by ID' })
  async deleteZone(@Req() req: any, @Param('id') id: string) {
    return this.geoZoneService.delete(req.user, id);
  }


  // ── Attendance Settings ─────────────────────────────────────────────────
  @Get('settings')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_VIEW)
  @ApiOperation({ summary: 'Get attendance settings' })
  async getSettings(@Req() req: any) {
    return this.attendanceService.getSettings(req.user);
  }

  @Post('settings')
  @RequirePermissions(Permission.EMPLOYEES_ATTENDANCE_EDIT)
  @ApiOperation({ summary: 'Update attendance settings' })
  async updateSettings(@Req() req: any, @Body() body: any) {
    return this.attendanceService.updateSettings(req.user, body);
  }
}
