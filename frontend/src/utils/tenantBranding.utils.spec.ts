import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolvePayslipCompanyName,
  getCompanyInitials,
} from "./tenantBranding.utils";
import { escapeHtml } from "./htmlEscape";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";

describe("Tenant Branding & Payslip Identity Architecture", () => {
  beforeEach(() => {
    useUIStore.setState({ company: "Shulka Corp" });
    useAuthStore.setState({
      user: {
        id: "usr-1",
        email: "admin@shulka.com",
        role: "HRAdmin",
        companyName: "Shulka Corp",
      } as any,
    });
  });

  afterEach(() => {
    useUIStore.setState({ company: "" });
    useAuthStore.setState({ user: null });
  });

  describe("1. Test 1 — Shulka Corp Resolution", () => {
    it("resolves Shulka Corp and initial SC, never displaying HR Nexa / NX", () => {
      const emp = {
        id: "emp-1",
        name: "Ravi Kumar",
        company: { id: "comp-shulka", name: "Shulka Corp" },
      };
      const slip = { id: "slip-1", employeeId: "emp-1" };

      const companyName = resolvePayslipCompanyName(slip, emp);
      const companyInitials = getCompanyInitials(companyName);

      expect(companyName).toBe("Shulka Corp");
      expect(companyInitials).toBe("SC");
      expect(companyName).not.toBe("HR Nexa");
      expect(companyInitials).not.toBe("NX");
    });
  });

  describe("2. Test 2 — Dezoryn Technologies Resolution", () => {
    it("resolves Dezoryn Technologies and initial DT", () => {
      const emp = {
        id: "emp-2",
        name: "Jane Doe",
        companyName: "Dezoryn Technologies",
      };
      const slip = { id: "slip-2", employeeId: "emp-2" };

      const companyName = resolvePayslipCompanyName(slip, emp);
      const companyInitials = getCompanyInitials(companyName);

      expect(companyName).toBe("Dezoryn Technologies");
      expect(companyInitials).toBe("DT");
    });
  });

  describe("3. Test 3 — Single-Word Company Name", () => {
    it("derives valid initials for single-word company without crashing", () => {
      const initials1 = getCompanyInitials("Acme");
      expect(initials1).toBe("A");

      const emp = { id: "emp-3", companyName: "Acme" };
      expect(resolvePayslipCompanyName({}, emp)).toBe("Acme");
    });

    it("derives multi-word initials correctly for Acme Corp", () => {
      const initials = getCompanyInitials("Acme Corp");
      expect(initials).toBe("AC");
    });
  });

  describe("4. Test 4 — Special Characters & XSS HTML Escaping", () => {
    it("handles special characters in company name and escapes HTML correctly", () => {
      const specialName = "A&B <Technologies>";
      const initials = getCompanyInitials(specialName);
      expect(initials).toBe("AT");

      const escaped = escapeHtml(specialName);
      expect(escaped).toBe("A&amp;B &lt;Technologies&gt;");
      expect(escaped).not.toContain("<");
      expect(escaped).not.toContain(">");
    });
  });

  describe("5. Test 5 — Missing / Empty Company Fallback", () => {
    it("provides safe fallback 'Company' and 'CO' when branding data is missing without crashing", () => {
      useUIStore.setState({ company: "" });
      useAuthStore.setState({ user: null });

      const companyName = resolvePayslipCompanyName({}, {});
      const companyInitials = getCompanyInitials(companyName);

      expect(companyName).toBe("Company");
      expect(companyInitials).toBe("C");

      expect(getCompanyInitials("")).toBe("CO");
      expect(getCompanyInitials(null)).toBe("CO");
      expect(getCompanyInitials(undefined)).toBe("CO");
      expect(getCompanyInitials("   ")).toBe("CO");
    });
  });

  describe("6. Test 6 — Strict Tenant Isolation", () => {
    it("ensures Employee A from Company A never resolves Company B branding", () => {
      const empA = {
        id: "emp-a",
        name: "Alice",
        company: { id: "comp-a", name: "Alpha Logistics" },
      };
      const empB = {
        id: "emp-b",
        name: "Bob",
        company: { id: "comp-b", name: "Beta Systems" },
      };

      const slipA = { id: "slip-a", employeeId: "emp-a" };
      const slipB = { id: "slip-b", employeeId: "emp-b" };

      const nameA = resolvePayslipCompanyName(slipA, empA);
      const nameB = resolvePayslipCompanyName(slipB, empB);

      expect(nameA).toBe("Alpha Logistics");
      expect(nameB).toBe("Beta Systems");
      expect(getCompanyInitials(nameA)).toBe("AL");
      expect(getCompanyInitials(nameB)).toBe("BS");
    });
  });
});
