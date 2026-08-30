import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Put,
  Param,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../roles.guard';
import { Roles } from '../roles.decorator';
import { Role } from '../role.enum';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import {
  RequestSuperAdminEmailChangeDto,
  VerifySuperAdminEmailChangeDto,
} from '../dto/superadmin-email-change.dto';
import { VerifyOtpDto, ResendOtpDto } from '../dto/otp.dto';
import { ExchangeImpersonationTicketDto } from '../dto/impersonation-ticket.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { RbacService } from '../services/rbac.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private rbacService: RbacService,
  ) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user and return JWT or OTP challenge' })
  @ApiResponse({ status: 200, description: 'Login successful or OTP challenge initiated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(@Request() req: any, @Body() loginDto: LoginDto) {
    const userAgent = req.headers ? req.headers['user-agent'] : undefined;
    const ip = req.ip || (req.headers ? req.headers['x-forwarded-for'] : undefined);
    return this.authService.login(loginDto, userAgent, ip);
  }

  @Post('verify-otp')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA OTP and issue JWT access/refresh token pair' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(@Request() req: any, @Body() dto: VerifyOtpDto) {
    const userAgent = req.headers ? req.headers['user-agent'] : undefined;
    const ip = req.ip || (req.headers ? req.headers['x-forwarded-for'] : undefined);
    return this.authService.verifyOtp(dto, userAgent, ip);
  }

  @Post('resend-otp')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend 2FA OTP and invalidate previous challenge' })
  @ApiResponse({ status: 200, description: 'New OTP dispatched' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile returned successfully' })
  async getProfile(@Request() req: AuthenticatedRequest) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me/permissions')
  @ApiOperation({
    summary: 'Get current authenticated user effective permissions',
  })
  getMyPermissions(@Request() req: AuthenticatedRequest) {
    return {
      role: req.user?.role,
      permissions: (req.user as any)?.permissions ?? [],
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('me/preferences')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  async updateMyPreferences(
    @Request() req: AuthenticatedRequest,
    @Body() body: any,
  ) {
    return this.authService.updatePreferences(req.user.id, body.preferences);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin, Role.HRAdmin)
  @ApiBearerAuth()
  @Get('roles/permissions')
  @ApiOperation({
    summary: 'Get role-permissions matrix with tenant isolation',
  })
  async getRolePermissionsMatrix(
    @Request() req: AuthenticatedRequest,
    @Query('companyId') companyId?: string,
  ) {
    const isSuperAdmin = req.user.role === 'SuperAdmin';

    let targetCompanyId: string | null;
    if (isSuperAdmin) {
      targetCompanyId = companyId || null;
    } else {
      const own = req.user.companyId !== 'PLATFORM' ? req.user.companyId : null;
      if (companyId && companyId !== own) {
        throw new ForbiddenException('Access denied to other company permissions');
      }
      targetCompanyId = own;
    }

    return this.rbacService.getAllRolePermissions(targetCompanyId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin)
  @ApiBearerAuth()
  @Put('roles/:role/permissions')
  @ApiOperation({ summary: 'Update permissions for a role (SuperAdmin only)' })
  updateRolePermissions(
    @Param('role') role: string,
    @Body('permissions') permissions: string[],
  ) {
    const updated = this.rbacService.updateRolePermissions(
      role,
      permissions || [],
      null,
    );
    return {
      role,
      permissions: updated,
      message: `Permissions updated successfully for role ${role}`,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new token pair' })
  async refresh(@Request() req: any, @Body() dto: RefreshTokenDto) {
    const userAgent = req.headers ? req.headers['user-agent'] : undefined;
    const ip = req.ip || (req.headers ? req.headers['x-forwarded-for'] : undefined);
    return this.authService.refresh(dto.refreshToken, userAgent, ip);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke current tokens' })
  async logout(
    @Request() req: AuthenticatedRequest,
    @Body() body?: { refreshToken?: string },
  ) {
    const authHeader = req.headers?.authorization;
    const accessToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : undefined;
    return this.authService.logout(
      accessToken,
      body?.refreshToken,
      req.user?.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'Get all active sessions for current user' })
  async getSessions(@Request() req: AuthenticatedRequest, @Body('refreshToken') bodyToken?: string) {
    return this.authService.getActiveSessions(req.user.id, bodyToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Revoke a specific active session by ID' })
  async revokeSession(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.authService.revokeSession(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('sessions')
  @ApiOperation({ summary: 'Revoke all other active sessions for current user' })
  async revokeOtherSessions(@Request() req: AuthenticatedRequest, @Body('currentRefreshToken') currentRefreshToken?: string) {
    return this.authService.revokeOtherSessions(req.user.id, currentRefreshToken);
  }

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 900000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset token' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for authenticated user' })
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user email with verification token' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('superadmin/email-change')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles(Role.SuperAdmin)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate SuperAdmin email change with OTP challenge' })
  @ApiResponse({ status: 200, description: 'Verification OTP sent to new email address' })
  @ApiResponse({ status: 400, description: 'Invalid email or incorrect current password' })
  @ApiResponse({ status: 403, description: 'Forbidden: SuperAdmin only' })
  @ApiResponse({ status: 409, description: 'Email address already in use' })
  async requestSuperAdminEmailChange(
    @Request() req: AuthenticatedRequest,
    @Body() dto: RequestSuperAdminEmailChangeDto,
  ) {
    const userAgent = req.headers?.['user-agent'] as string | undefined;
    const rawForwarded = req.headers?.['x-forwarded-for'];
    const ip = req.ip || (Array.isArray(rawForwarded) ? rawForwarded[0] : (rawForwarded as string | undefined));
    return this.authService.requestSuperAdminEmailChange(req.user, dto, ip, userAgent);
  }

  @Post('superadmin/email-change/verify')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles(Role.SuperAdmin)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and execute SuperAdmin email change' })
  @ApiResponse({ status: 200, description: 'SuperAdmin email updated and sessions revoked' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 403, description: 'Forbidden: SuperAdmin only' })
  @ApiResponse({ status: 409, description: 'Email address already in use' })
  async verifySuperAdminEmailChange(
    @Request() req: AuthenticatedRequest,
    @Body() dto: VerifySuperAdminEmailChangeDto,
  ) {
    return this.authService.verifySuperAdminEmailChange(req.user, dto);
  }

  @Post('revoke-sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin, Role.HRAdmin)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all refresh sessions for a specific user' })
  revokeUserSessions(@Body('userId') userId: string) {
    return this.authService.revokeUserSessions(userId);
  }

  @Post('impersonate/company/:companyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Impersonate HRAdmin for a specific company (SuperAdmin only)' })
  impersonateCompany(@Param('companyId') companyId: string, @Req() req: any) {
    return this.authService.impersonateCompany(companyId, req.user);
  }

  @Post('impersonate/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a single-use impersonation ticket for a tenant HRAdmin session' })
  exchangeImpersonationTicket(@Body() dto: ExchangeImpersonationTicketDto) {
    return this.authService.exchangeImpersonationTicket(dto.ticket);
  }
}
