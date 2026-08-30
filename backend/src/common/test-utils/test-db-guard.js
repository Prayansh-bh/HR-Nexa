/**
 * Phase 2K Workstreams 3, 4 & 5: Production Database Safety Guard & Test Isolation
 *
 * This module provides hard guards for test scripts:
 * 1. assertSafeDatabaseTarget():
 *    Refuses execution if connected to a production database, if NODE_ENV === 'production',
 *    or if the host is a cloud production instance without explicit test authorization.
 * 2. createTestTracker():
 *    Tracks dynamically created test records and provides a guaranteed try/finally cleanup
 *    method that deletes only specifically tracked IDs.
 */

const { PrismaClient } = require('@prisma/client');

/**
 * Asserts that the current database connection is safe for running mutating tests.
 * Fails loud and exits process if targeting a production database.
 */
function assertSafeDatabaseTarget(options = {}) {
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();

  // 1. Explicit production environment block
  if (nodeEnv === 'production') {
    throw new Error(
      'CRITICAL SAFETY ERROR: Mutating security/adversarial tests are STRICTLY PROHIBITED in NODE_ENV=production. Aborting.'
    );
  }

  // 2. Inspect URL for production keywords or remote host patterns
  const unsafePatterns = [
    /production/i,
    /prod/i,
    /rds\.amazonaws\.com/i,
    /supabase\.co/i,
    /neon\.tech/i,
    /cloudsql/i,
  ];

  for (const pattern of unsafePatterns) {
    if (pattern.test(dbUrl)) {
      // Unless explicitly overridden by a controlled TEST_MODE flag for an approved staging container
      if (process.env.TEST_MODE !== 'true' || process.env.ALLOW_PROD_TEST_DATABASE !== 'true') {
        throw new Error(
          `CRITICAL SAFETY ERROR: DATABASE_URL matches unsafe production pattern "${pattern}". Aborting test execution.`
        );
      }
    }
  }

  // 3. Confirm target database is local, docker, or approved test target
  const isApprovedLocalOrTest =
    dbUrl.includes('localhost') ||
    dbUrl.includes('127.0.0.1') ||
    dbUrl.includes('test') ||
    process.env.TEST_MODE === 'true';

  if (!isApprovedLocalOrTest && !options.allowRemoteDev) {
    throw new Error(
      `CRITICAL SAFETY ERROR: Database target is neither localhost nor explicitly designated as a test database (${dbUrl.replace(/:[^:@]+@/, ':***@')}).`
    );
  }

  return true;
}

/**
 * Creates an in-memory tracker for test-created entities to guarantee cleanup in finally blocks.
 */
function createTestTracker(prismaClient) {
  const prisma = prismaClient || new PrismaClient();
  const createdRoles = new Set();
  const createdUsers = new Set();
  const createdOverrides = new Set();

  return {
    trackRole(id) {
      if (id) createdRoles.add(id);
    },
    trackUser(id) {
      if (id) createdUsers.add(id);
    },
    trackOverride(id) {
      if (id) createdOverrides.add(id);
    },
    getTracked() {
      return {
        roles: Array.from(createdRoles),
        users: Array.from(createdUsers),
        overrides: Array.from(createdOverrides),
      };
    },
    async cleanup() {
      const summary = { deletedRoles: 0, deletedUsers: 0, deletedOverrides: 0, errors: [] };

      // 1. Clean overrides
      for (const id of createdOverrides) {
        try {
          await prisma.tenantFeatureOverride.delete({ where: { id } });
          summary.deletedOverrides++;
        } catch (err) {
          // Ignore if already deleted
        }
      }

      // 2. Clean users
      for (const id of createdUsers) {
        try {
          await prisma.user.delete({ where: { id } });
          summary.deletedUsers++;
        } catch (err) {
          // Ignore if already deleted
        }
      }

      // 3. Clean roles
      for (const id of createdRoles) {
        try {
          await prisma.role.delete({ where: { id } });
          summary.deletedRoles++;
        } catch (err) {
          // Ignore if already deleted
        }
      }

      return summary;
    },
  };
}

module.exports = {
  assertSafeDatabaseTarget,
  createTestTracker,
};
