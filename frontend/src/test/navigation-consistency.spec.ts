import { describe, it, expect } from "vitest";
import { FEATURE_REGISTRY, FeatureDefinition } from "../lib/feature-registry";
import { resolveNavigationForUser } from "../hooks/useNavigation";
import { PERMISSIONS } from "../auth/permissions";
import { AuthUser } from "../types";

describe("Navigation Architecture Remediation & Consistency Specs", () => {
  describe("1. Registry Integrity & Metadata Verification", () => {
    const discoverableFeatures = Object.values(FEATURE_REGISTRY).filter(
      (f) => f.navigation?.discoverable === true,
    );

    it("ensures every discoverable feature has a valid, non-empty route", () => {
      discoverableFeatures.forEach((feat) => {
        expect(feat.route).toBeDefined();
        expect(feat.route.trim().length).toBeGreaterThan(0);
        expect(feat.route.startsWith("/")).toBe(true);
      });
    });

    it("ensures every discoverable feature has a valid category", () => {
      const validCategories = new Set([
        "general",
        "employees",
        "recruitment",
        "attendance",
        "leave",
        "performance",
        "payroll",
        "documents",
        "settings",
      ]);

      discoverableFeatures.forEach((feat) => {
        const cat = feat.navigation?.category || feat.category;
        expect(validCategories.has(cat)).toBe(true);
      });
    });

    it("ensures performance features are discoverable and correctly categorized", () => {
      const performanceKeys = [
        "performance.my-reviews",
        "performance.team-reviews",
        "performance.cycles",
      ];

      performanceKeys.forEach((key) => {
        const feat = FEATURE_REGISTRY[key];
        expect(feat).toBeDefined();
        expect(feat.navigation?.discoverable).toBe(true);
        expect(feat.category).toBe("performance");
        expect(feat.permission).toBeDefined();
      });
    });

    it("ensures viewer.verification, exit.resignation, hr.analytics, and self.helpdesk are discoverable", () => {
      const remediatedKeys = [
        "viewer.verification",
        "exit.resignation",
        "hr.analytics",
        "self.helpdesk",
      ];

      remediatedKeys.forEach((key) => {
        const feat = FEATURE_REGISTRY[key];
        expect(feat).toBeDefined();
        expect(feat.navigation?.discoverable).toBe(true);
        expect(feat.permission).toBeDefined();
      });
    });
  });

  describe("2. Intentional Non-Discoverable Destinations", () => {
    it("ensures header-only destinations remain non-discoverable", () => {
      expect(FEATURE_REGISTRY["notifications"]?.navigation?.discoverable).toBeFalsy();
      expect(FEATURE_REGISTRY["profile"]?.navigation?.discoverable).toBeFalsy();
    });

    it("ensures route aliases like self.expenses remain non-discoverable in dynamic nav", () => {
      expect(FEATURE_REGISTRY["self.expenses"]?.navigation?.discoverable).toBeFalsy();
    });
  });

  describe("3. Dynamic Navigation Resolution for Custom & Operational Roles", () => {
    it("renders performance features dynamically for a custom role with performance permissions", () => {
      const customUser: AuthUser = {
        id: "usr-custom-1",
        email: "custom@example.com",
        name: "Custom User",
        role: "CustomRole" as any,
        initials: "CU",
        permissions: [
          PERMISSIONS.PERFORMANCE_REVIEWS_VIEW,
          PERMISSIONS.PERFORMANCE_CYCLES_MANAGE,
          PERMISSIONS.CHATBOX_ACCESS,
        ],
      };

      const nav = resolveNavigationForUser(customUser);

      // Find performance category or items
      const perfGroup = nav.find((item) => item.id === "cat.performance" || item.id === "performance");
      expect(perfGroup).toBeDefined();
      expect(perfGroup?.children).toBeDefined();

      const childIds = perfGroup?.children?.map((c) => c.id) || [];
      expect(childIds).toContain("performance.my-reviews");
      expect(childIds).toContain("performance.team-reviews");
      expect(childIds).toContain("performance.cycles");
    });

    it("does NOT render performance features for a custom role WITHOUT performance permissions", () => {
      const customUserNoPerf: AuthUser = {
        id: "usr-custom-2",
        email: "custom2@example.com",
        name: "Custom User No Perf",
        role: "CustomRole" as any,
        initials: "CP",
        permissions: [
          PERMISSIONS.EMPLOYEES_LIST_VIEW,
          PERMISSIONS.LEAVES_REQUESTS_CREATE,
        ],
      };

      const nav = resolveNavigationForUser(customUserNoPerf);
      const allIds = nav.flatMap((item) => [item.id, ...(item.children?.map((c) => c.id) || [])]);

      expect(allIds).not.toContain("performance.my-reviews");
      expect(allIds).not.toContain("performance.team-reviews");
      expect(allIds).not.toContain("performance.cycles");
      expect(allIds).not.toContain("cat.performance");
    });

    it("renders Exit, Helpdesk, and Doc Verification when permitted for custom roles", () => {
      const customUserOps: AuthUser = {
        id: "usr-custom-3",
        email: "ops@example.com",
        name: "Ops Specialist",
        role: "OperationsLead" as any,
        initials: "OL",
        permissions: [
          PERMISSIONS.EXIT_VIEW,
          PERMISSIONS.SUPPORT_TICKETS_VIEW,
          PERMISSIONS.DOCUMENTS_VERIFY,
        ],
      };

      const nav = resolveNavigationForUser(customUserOps);
      const allIds = nav.flatMap((item) => [item.id, ...(item.children?.map((c) => c.id) || [])]);

      expect(allIds).toContain("exit.resignation");
      expect(allIds).toContain("self.helpdesk");
      expect(allIds).toContain("viewer.verification");
    });

    it("dynamically resolves Recruiter role purely via permissions without hardcoding", () => {
      const recruiterUser: AuthUser = {
        id: "usr-recruiter-1",
        email: "recruiter@example.com",
        name: "Recruiter Alice",
        role: "Recruiter" as any,
        initials: "RA",
        permissions: [
          PERMISSIONS.RECRUITMENT_CANDIDATES_VIEW,
          PERMISSIONS.RECRUITMENT_JOBS_VIEW,
          PERMISSIONS.CHATBOX_ACCESS,
        ],
      };

      const nav = resolveNavigationForUser(recruiterUser);
      const allIds = nav.flatMap((item) => [item.id, ...(item.children?.map((c) => c.id) || [])]);

      expect(allIds).toContain("recruitment.pipeline");
      expect(allIds).toContain("inbox");
      expect(allIds).toContain("dashboard");
    });

    it("ensures no duplicate navigation IDs or routes are generated", () => {
      const fullPermUser: AuthUser = {
        id: "usr-full",
        email: "full@example.com",
        name: "Full Custom Admin",
        role: "CustomSuperAdmin" as any,
        initials: "FA",
        permissions: Object.values(PERMISSIONS),
      };

      const nav = resolveNavigationForUser(fullPermUser);
      const allChildIds = nav.flatMap((item) => item.children?.map((c) => c.id) || [item.id]);

      const seen = new Set<string>();
      allChildIds.forEach((id) => {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      });
    });
  });

  describe("4. Static Persona Curated Navigation Invariants", () => {
    it("preserves HRAdmin baseline navigation", () => {
      const hrAdmin: AuthUser = {
        id: "usr-hr",
        email: "hr@example.com",
        name: "HR Admin",
        role: "HRAdmin",
        initials: "HA",
        permissions: Object.values(PERMISSIONS),
      };

      const nav = resolveNavigationForUser(hrAdmin);
      const topIds = nav.map((item) => item.id);

      expect(topIds).toContain("dashboard");
      expect(topIds).toContain("employees");
      expect(topIds).toContain("attendance");
      expect(topIds).toContain("leave");
      expect(topIds).toContain("performance");
      expect(topIds).toContain("payroll");
      expect(topIds).toContain("documents");
    });

    it("preserves Manager curated navigation and performance reviews", () => {
      const manager: AuthUser = {
        id: "usr-mgr",
        email: "mgr@example.com",
        name: "Manager Bob",
        role: "Manager",
        initials: "MB",
        permissions: [
          PERMISSIONS.PERFORMANCE_REVIEWS_VIEW,
          PERMISSIONS.EMPLOYEES_LIST_VIEW,
          PERMISSIONS.LEAVES_REQUESTS_APPROVE,
        ],
      };

      const nav = resolveNavigationForUser(manager);
      const perfGroup = nav.find((item) => item.id === "performance");

      expect(perfGroup).toBeDefined();
      const perfChildren = perfGroup?.children?.map((c) => c.id) || [];
      expect(perfChildren).toContain("performance.my-reviews");
      expect(perfChildren).toContain("performance.team-reviews");
      expect(perfChildren).not.toContain("performance.cycles");
    });

    it("preserves Employee self-service navigation and my reviews (with team reviews if permitted, but never cycles)", () => {
      const employee: AuthUser = {
        id: "usr-emp",
        email: "emp@example.com",
        name: "Employee Charlie",
        role: "Employee",
        initials: "EC",
        permissions: [PERMISSIONS.PERFORMANCE_REVIEWS_VIEW],
      };

      const nav = resolveNavigationForUser(employee);
      const perfGroup = nav.find((item) => item.id === "performance");

      expect(perfGroup).toBeDefined();
      const perfChildren = perfGroup?.children?.map((c) => c.id) || [];
      expect(perfChildren).toContain("performance.my-reviews");
      expect(perfChildren).not.toContain("performance.cycles");
    });

    it("overlays performance for Accountant or Viewer dynamically if granted without duplicating", () => {
      const viewerWithPerf: AuthUser = {
        id: "usr-view",
        email: "view@example.com",
        name: "Viewer Dan",
        role: "Viewer",
        initials: "VD",
        permissions: [
          PERMISSIONS.EMPLOYEES_LIST_VIEW,
          PERMISSIONS.DOCUMENTS_VERIFY,
          PERMISSIONS.PERFORMANCE_REVIEWS_VIEW,
        ],
      };

      const nav = resolveNavigationForUser(viewerWithPerf);
      const allIds = nav.flatMap((item) => [item.id, ...(item.children?.map((c) => c.id) || [])]);

      expect(allIds).toContain("viewer.verification");
      expect(allIds).toContain("performance.my-reviews");
    });
  });
});
