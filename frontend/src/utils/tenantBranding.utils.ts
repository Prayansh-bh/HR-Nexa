import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";

/**
 * Resolves the authoritative tenant company name for employee documents / payslips.
 * Priority:
 * 1. slip.companyName (from payroll record if attached)
 * 2. emp.company.name (from employee relation)
 * 3. emp.companyName (from employee entity)
 * 4. useUIStore.getState().company (active tenant UI context)
 * 5. useAuthStore.getState().user?.companyName (authenticated tenant session)
 * 6. Fallback: "Company"
 */
export function resolvePayslipCompanyName(slip?: any, emp?: any): string {
  if (slip?.companyName && typeof slip.companyName === "string" && slip.companyName.trim()) {
    return slip.companyName.trim();
  }
  if (emp?.company?.name && typeof emp.company.name === "string" && emp.company.name.trim()) {
    return emp.company.name.trim();
  }
  if (emp?.companyName && typeof emp.companyName === "string" && emp.companyName.trim()) {
    return emp.companyName.trim();
  }
  try {
    const uiCompany = useUIStore.getState().company;
    if (uiCompany && typeof uiCompany === "string" && uiCompany.trim() && uiCompany !== "PLATFORM") {
      return uiCompany.trim();
    }
  } catch {
    // Ignore store access errors in testing environments
  }
  try {
    const authUser = useAuthStore.getState().user;
    if (authUser?.companyName && typeof authUser.companyName === "string" && authUser.companyName.trim() && authUser.companyName !== "PLATFORM") {
      return authUser.companyName.trim();
    }
  } catch {
    // Ignore store access errors in testing environments
  }
  return "Company";
}

/**
 * Extracts 1-2 uppercase letters from the company name to form a brand monogram.
 * E.g.
 * - "Shulka Corp" -> "SC"
 * - "Dezoryn Technologies" -> "DT"
 * - "Acme Corp" -> "AC"
 * - "Acme" -> "A"
 * - "A&B <Technologies>" -> "AT"
 * - "" / null -> "CO"
 */
export function getCompanyInitials(companyName?: string | null): string {
  if (!companyName || typeof companyName !== "string") return "CO";
  const clean = companyName.trim();
  if (!clean) return "CO";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "CO";

  const initials = words
    .slice(0, 2)
    .map((word) => {
      const match = word.match(/[a-zA-Z0-9]/);
      return match ? match[0].toUpperCase() : word[0]?.toUpperCase() || "";
    })
    .join("");

  return initials || "CO";
}
