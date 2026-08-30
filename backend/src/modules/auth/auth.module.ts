import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { UserRepository } from './repositories/user.repository';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';

import { RefreshTokenService } from './services/refresh-token.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerificationService } from './services/email-verification.service';

import { RbacService } from './services/rbac.service';
import { PermissionsGuard } from './permissions.guard';
import { SubscriptionGuard } from './subscription.guard';
import { RolesController } from './controllers/roles.controller';

import { TokenHashService } from './services/token-hash.service';
import { UserAgentParserService } from './services/user-agent.parser';
import { AuthCleanupService } from './services/auth-cleanup.service';

import { PermissionResolver } from './services/permission-resolver.service';

import { SystemModule } from '../system/system.module';
import { EmailModule } from '../../email/email.module';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { RoleProvisioningService } from './services/role-provisioning.service';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') ||
          process.env.JWT_SECRET ||
          'hrms_super_secret_jwt_key_2026_go_deepmind',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRATION') ||
            process.env.JWT_EXPIRATION ||
            '15m') as any,
        },
      }),
      inject: [ConfigService],
    }),
    SystemModule,
    EmailModule,
  ],
  providers: [
    AuthService,
    UserRepository,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    SubscriptionGuard,
    RbacService,
    PermissionResolver,
    RoleProvisioningService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    TokenBlacklistService,
    PasswordResetService,
    EmailVerificationService,
    TokenHashService,
    UserAgentParserService,
    AuthCleanupService,
  ],
  controllers: [AuthController, RolesController],
  exports: [
    AuthService,
    UserRepository,
    PasswordService,
    JwtStrategy,
    PassportModule,
    RolesGuard,
    PermissionsGuard,
    SubscriptionGuard,
    RbacService,
    PermissionResolver,
    RoleProvisioningService,
    TokenBlacklistService,
    RefreshTokenService,
    PasswordResetService,
    TokenHashService,
    UserAgentParserService,
  ],
})
export class AuthModule {}
