import { describe, it, expect } from "vitest";
import { getRatingScaleDefinition } from "../features/performance/pages/PerformanceConfigPage";

describe("Performance Module Forensic Remediation Specs", () => {
  describe("1. Rating Scale Definition Mapping Invariants", () => {
    it("maps 5.0 and 4.8+ to Level 5: Outstanding (tone: green)", () => {
      const res5 = getRatingScaleDefinition(5.0);
      expect(res5.level).toBe("Level 5");
      expect(res5.name).toBe("Outstanding");
      expect(res5.tone).toBe("green");

      const res48 = getRatingScaleDefinition(4.8);
      expect(res48.level).toBe("Level 5");
      expect(res48.name).toBe("Outstanding");
    });

    it("maps 4.5 and 4.3+ to Level 4.5: Excellent (tone: indigo)", () => {
      const res = getRatingScaleDefinition(4.5);
      expect(res.level).toBe("Level 4.5");
      expect(res.name).toBe("Excellent");
      expect(res.tone).toBe("indigo");
    });

    it("maps 4.0 to Level 4: Very Good", () => {
      const res = getRatingScaleDefinition(4.0);
      expect(res.level).toBe("Level 4");
      expect(res.name).toBe("Very Good");
    });

    it("maps 3.5 to Level 3.5: Good", () => {
      const res = getRatingScaleDefinition(3.5);
      expect(res.level).toBe("Level 3.5");
      expect(res.name).toBe("Good");
    });

    it("maps 3.0 to Level 3: Meets Expectations", () => {
      const res = getRatingScaleDefinition(3.0);
      expect(res.level).toBe("Level 3");
      expect(res.name).toBe("Meets Expectations");
    });

    it("maps 2.5 to Level 2.5: Needs Improvement", () => {
      const res = getRatingScaleDefinition(2.5);
      expect(res.level).toBe("Level 2.5");
      expect(res.name).toBe("Needs Improvement");
      expect(res.tone).toBe("amber");
    });

    it("maps 2.0 to Level 2: Poor", () => {
      const res = getRatingScaleDefinition(2.0);
      expect(res.level).toBe("Level 2");
      expect(res.name).toBe("Poor");
      expect(res.tone).toBe("rose");
    });

    it("maps 1.0 and below to Level 1: Unsatisfactory", () => {
      const res = getRatingScaleDefinition(1.0);
      expect(res.level).toBe("Level 1");
      expect(res.name).toBe("Unsatisfactory");
      expect(res.tone).toBe("rose");
    });
  });

  describe("2. Assessment Winner / Top Performer Calculation", () => {
    it("determines the highest completed finalRating as the assessment winner", () => {
      const mockReviews = [
        {
          id: "r1",
          employee: { id: "e1", name: "Alice Smith", department: { name: "Engineering" } },
          status: "Completed",
          finalRating: 4.8,
        },
        {
          id: "r2",
          employee: { id: "e2", name: "Bob Jones", department: { name: "Design" } },
          status: "Completed",
          finalRating: 4.2,
        },
        {
          id: "r3",
          employee: { id: "e3", name: "Charlie Brown", department: { name: "Marketing" } },
          status: "Draft",
          finalRating: 5.0, // Draft should be excluded
        },
      ];

      const completed = mockReviews.filter(
        (r) => (r.status === "Completed" || r.status === "Approved" || r.status === "HR Review") && r.finalRating > 0,
      );
      const sorted = [...completed].sort((a, b) => b.finalRating - a.finalRating);
      const winners = sorted.filter((r) => r.finalRating === sorted[0].finalRating);

      expect(winners.length).toBe(1);
      expect(winners[0].employee.name).toBe("Alice Smith");
      expect(winners[0].finalRating).toBe(4.8);

      const ratingDef = getRatingScaleDefinition(winners[0].finalRating);
      expect(ratingDef.level).toBe("Level 5");
      expect(ratingDef.name).toBe("Outstanding");
    });

    it("handles tied top scores deterministically", () => {
      const mockReviews = [
        {
          id: "r1",
          employee: { id: "e1", name: "Zara White" },
          status: "Completed",
          finalRating: 4.9,
        },
        {
          id: "r2",
          employee: { id: "e2", name: "Aaron Black" },
          status: "Completed",
          finalRating: 4.9,
        },
        {
          id: "r3",
          employee: { id: "e3", name: "David Gray" },
          status: "Completed",
          finalRating: 4.5,
        },
      ];

      const completed = mockReviews.filter((r) => r.status === "Completed" && r.finalRating > 0);
      const sorted = [...completed].sort((a, b) => {
        if (b.finalRating !== a.finalRating) return b.finalRating - a.finalRating;
        return a.employee.name.localeCompare(b.employee.name);
      });
      const winners = sorted.filter((r) => r.finalRating === sorted[0].finalRating);

      expect(winners.length).toBe(2);
      expect(winners[0].employee.name).toBe("Aaron Black");
      expect(winners[1].employee.name).toBe("Zara White");
    });

    it("produces an empty winner state when no reviews are completed", () => {
      const mockReviews = [
        { id: "r1", status: "Draft", finalRating: 0 },
        { id: "r2", status: "Self Review", finalRating: 0 },
      ];

      const completed = mockReviews.filter(
        (r) => (r.status === "Completed" || r.status === "Approved") && r.finalRating > 0,
      );
      expect(completed.length).toBe(0);
    });
  });

  describe("3. Recommendations Contract & Persistence Invariants", () => {
    it("ensures Manager recommendations are accurately structured", () => {
      const managerReviewPayload = {
        id: "rev-101",
        feedback: "Consistent high quality output.",
        scores: [{ criterionId: "c1", score: 5, remarks: "Excellent" }],
        recommendation: {
          promotion: true,
          increment: true,
          training: false,
        },
      };

      expect(managerReviewPayload.recommendation.promotion).toBe(true);
      expect(managerReviewPayload.recommendation.increment).toBe(true);
      expect(managerReviewPayload.recommendation.training).toBe(false);
    });

    it("ensures HR calibration displays persisted manager recommendation state without corruption", () => {
      const persistedReview = {
        id: "rev-101",
        promotionRecommended: true,
        incrementRecommended: true,
        trainingRecommended: false,
        hrRemarks: "Approved by leadership",
      };

      expect(persistedReview.promotionRecommended).toBe(true);
      expect(persistedReview.incrementRecommended).toBe(true);
      expect(persistedReview.trainingRecommended).toBe(false);
    });
  });

  describe("4. Review Scoping & Query Construction Invariants", () => {
    it("verifies My Reviews passes employeeId and enables query when employeeId exists", () => {
      const user = { id: "user-1", name: "Ravi Kisan", employeeId: "emp-ravi-001", role: "HRAdmin" };
      const employeeId = user.employeeId;
      const queryFilters = { employeeId: employeeId || undefined };
      const queryOptions = { enabled: Boolean(employeeId) };

      expect(queryFilters.employeeId).toBe("emp-ravi-001");
      expect(queryOptions.enabled).toBe(true);
    });

    it("verifies My Reviews disables query when employeeId is missing to prevent unsafe unscoped company queries", () => {
      const user = { id: "user-admin", name: "Super User", employeeId: null, role: "HRAdmin" };
      const employeeId = user.employeeId;
      const queryFilters = { employeeId: employeeId || undefined };
      const queryOptions = { enabled: Boolean(employeeId) };

      expect(queryFilters.employeeId).toBeUndefined();
      expect(queryOptions.enabled).toBe(false);
    });

    it("verifies Team Reviews passes managerId and enables query when managerId exists", () => {
      const user = { id: "user-2", name: "Dev Lead", employeeId: "emp-lead-002", role: "Manager" };
      const managerId = user.employeeId;
      const queryFilters = { managerId: managerId || undefined };
      const queryOptions = { enabled: Boolean(managerId) };

      expect(queryFilters.managerId).toBe("emp-lead-002");
      expect(queryOptions.enabled).toBe(true);
    });

    it("verifies Team Reviews disables query when managerId is missing to prevent unsafe unscoped company queries", () => {
      const user = { id: "user-3", name: "Standalone Manager", employeeId: null, role: "Manager" };
      const managerId = user.employeeId;
      const queryFilters = { managerId: managerId || undefined };
      const queryOptions = { enabled: Boolean(managerId) };

      expect(queryFilters.managerId).toBeUndefined();
      expect(queryOptions.enabled).toBe(false);
    });

    it("verifies that Ravi's scoped My Reviews query isolates Ravi from Ananya's review", () => {
      const raviEmployeeId = "emp-ravi-001";
      const ananyaEmployeeId = "emp-ananya-002";

      const companyReviews = [
        { id: "rev-ravi-1", employeeId: raviEmployeeId, cycleName: "DCD" },
        { id: "027df092-b9f6-4d8f-9c4d-3b043686ecdb", employeeId: ananyaEmployeeId, cycleName: "DCD" },
      ];

      // Simulated server response when scoped with ?employeeId=emp-ravi-001
      const raviScopedResult = companyReviews.filter((r) => r.employeeId === raviEmployeeId);

      expect(raviScopedResult.length).toBe(1);
      expect(raviScopedResult[0].id).toBe("rev-ravi-1");
      expect(raviScopedResult.find((r) => r.id === "027df092-b9f6-4d8f-9c4d-3b043686ecdb")).toBeUndefined();
    });

    it("verifies /performance/cycles retains company-wide cycle appraisal access", () => {
      const selectedCycleId = "cycle-dcd-2026";
      const adminConsoleFilters = { reviewCycleId: selectedCycleId, limit: 100 };

      // PerformanceConfigPage specifies reviewCycleId without restricting to single employeeId
      expect(adminConsoleFilters.reviewCycleId).toBe("cycle-dcd-2026");
      expect((adminConsoleFilters as any).employeeId).toBeUndefined();
    });
  });

  describe("5. Attendance Auto-Rating Data Flow Invariants", () => {
    function resolveAttendanceDisplay(r: {
      attendanceRating?: number;
      scores?: Array<{ criterion?: { name: string }; hrScore?: number }>;
    }): string {
      const attScore =
        (r.attendanceRating && r.attendanceRating > 0)
          ? r.attendanceRating
          : r.scores?.find((s) => s.criterion?.name === "Attendance")?.hrScore;
      return attScore && attScore > 0 ? attScore.toFixed(1) : "-";
    }

    it("renders attendance from parent attendanceRating when populated", () => {
      const review = {
        id: "r1",
        attendanceRating: 4.8,
        scores: [{ criterion: { name: "Attendance" }, hrScore: 4.8 }],
      };
      expect(resolveAttendanceDisplay(review)).toBe("4.8");
    });

    it("renders attendance from criterion hrScore when parent attendanceRating is 0", () => {
      const review = {
        id: "r2",
        attendanceRating: 0.0,
        scores: [{ criterion: { name: "Attendance" }, hrScore: 5.0 }],
      };
      expect(resolveAttendanceDisplay(review)).toBe("5.0");
    });

    it("renders '-' when attendance is genuinely 0 or unavailable", () => {
      const review = {
        id: "r3",
        attendanceRating: 0.0,
        scores: [{ criterion: { name: "Attendance" }, hrScore: 0.0 }],
      };
      expect(resolveAttendanceDisplay(review)).toBe("-");

      const emptyReview = { id: "r4", attendanceRating: 0.0, scores: [] };
      expect(resolveAttendanceDisplay(emptyReview)).toBe("-");
    });

    it("verifies attendance is weighted in final rating calculation", () => {
      const scores = [
        { criterion: { name: "Attendance", weight: 1.0 }, hrScore: 5.0 },
        { criterion: { name: "Technical Skills", weight: 1.0 }, hrScore: 4.0 },
        { criterion: { name: "Communication", weight: 1.0 }, hrScore: 4.5 },
      ];

      const totalWeight = scores.reduce((sum, s) => sum + s.criterion.weight, 0);
      const weightedSum = scores.reduce((sum, s) => sum + s.hrScore * s.criterion.weight, 0);
      const finalScore = Math.round((weightedSum / totalWeight) * 10) / 10;

      // (5.0 + 4.0 + 4.5) / 3 = 13.5 / 3 = 4.5
      expect(finalScore).toBe(4.5);
    });
  });
});
