import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export interface StatusUser {
  id?: string;
  email?: string;
  status?: string | null;
}

/**
 * Asserts that a user account status is eligible for normal authentication (login / OTP / refresh token rotation).
 * Rejects Locked, Disabled, or Inactive status with 401 Unauthorized.
 */
export function assertUserCanAuthenticate(user: StatusUser | null | undefined): asserts user is StatusUser {
  if (!user) {
    throw new UnauthorizedException('User not found');
  }

  const status = (user.status || '').trim();

  if (status === 'Locked' || status === 'Disabled' || status === 'Inactive') {
    throw new UnauthorizedException('Account is locked or disabled');
  }
}

/**
 * Asserts that a target HRAdmin account status is eligible for impersonation by SuperAdmin.
 * Rejects Locked, Disabled, Inactive, or Suspended status with 403 Forbidden.
 */
export function assertUserCanImpersonate(
  user: StatusUser | null | undefined,
  companyName?: string,
): asserts user is StatusUser {
  if (!user) {
    throw new ForbiddenException(
      `No HRAdmin user found for company${companyName ? `: ${companyName}` : ''}`,
    );
  }

  const status = (user.status || '').trim();
  const label = companyName ? `HRAdmin account for ${companyName}` : 'Target HRAdmin account';

  if (
    status === 'Locked' ||
    status === 'Disabled' ||
    status === 'Inactive' ||
    status === 'Suspended'
  ) {
    throw new ForbiddenException(`${label} is currently ${status || 'unavailable'}`);
  }
}
