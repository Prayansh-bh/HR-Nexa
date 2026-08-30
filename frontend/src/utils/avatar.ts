import { BASE_API } from "../config/api";

/**
 * Checks if a string represents an image source (URL, data URI, blob, or file with image extension).
 */
export function isImageSource(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("./")
  ) {
    return true;
  }
  // Check for storage references (e.g. tenants/.../employee-photos/..., uploads/...)
  if (
    trimmed.includes("employee-photos") ||
    trimmed.startsWith("tenants/") ||
    trimmed.startsWith("uploads/")
  ) {
    return true;
  }
  // Check for common image extensions (e.g. avatar_a.png, profile.jpeg)
  return /\.(png|jpe?g|webp|svg|gif|bmp|avif)(\?.*)?$/i.test(trimmed);
}

/**
 * Resolves an avatar string to a valid image URL, or returns null if not an image.
 */
export function resolveAvatarUrl(val?: string | null, employeeId?: string | null): string | null {
  if (!isImageSource(val)) return null;
  const trimmed = val!.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (
    employeeId &&
    (trimmed.includes("employee-photos") ||
      trimmed.startsWith("tenants/") ||
      trimmed.startsWith("uploads/") ||
      trimmed.startsWith("/uploads/"))
  ) {
    return `${BASE_API}/employees/${employeeId}/avatar`;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  // Relative filename like "avatar_a.png" -> "/avatar_a.png"
  return `/${trimmed}`;
}

/**
 * Extracts initials from an employee name or initials string.
 */
export function extractInitials(name?: string | null, initials?: string | null): string {
  if (initials && typeof initials === "string" && !isImageSource(initials) && initials.length <= 4) {
    return initials.trim().toUpperCase();
  }
  if (name && typeof name === "string") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
      return parts[0].toUpperCase();
    }
  }
  return "?";
}
