/**
 * Enterprise Employee Identity Resolution Utility
 *
 * Resolves the true Employee record ID from JWT user context.
 * For non-administrative users, the authenticated employee record is strictly authoritative.
 */
export function resolveEmployeeId(
  requestedId: string | undefined | null,
  currentUser: any,
): string | undefined {
  const selfEmployeeId = currentUser?.employee?.id || currentUser?.employeeId;

  // Administrative override check (SuperAdmin or HRAdmin role)
  const isAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.role === 'HRAdmin';

  if (!isAdmin && selfEmployeeId) {
    return selfEmployeeId;
  }

  if (
    !requestedId ||
    requestedId === currentUser?.id ||
    requestedId === currentUser?.employeeId
  ) {
    return selfEmployeeId || (requestedId || undefined);
  }

  return requestedId;
}
