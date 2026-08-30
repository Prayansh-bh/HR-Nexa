import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { UsersService } from '../services/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions(Permission.SETTINGS_ROLES_VIEW)
  @ApiOperation({ summary: 'Get registered users (tenant-scoped with pagination)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.usersService.getAllUsers(req.user, {
      page: parsedPage,
      limit: parsedLimit,
      search,
      role,
      status,
    });
  }

  @Put(':id')
  @Permissions(Permission.SETTINGS_ROLES_EDIT)
  @ApiOperation({ summary: 'Update user role or status' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(req.user, id, dto);
  }

  @Post(':id/force-logout')
  @Permissions(Permission.SETTINGS_ROLES_EDIT)
  @ApiOperation({ summary: 'Force logout user and lock account session' })
  @ApiResponse({ status: 200, description: 'User force logged out' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forceLogout(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.forceLogout(req.user, id);
  }

  @Delete(':id')
  @Permissions(Permission.SETTINGS_ROLES_EDIT)
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.deleteUser(req.user, id);
  }
}
