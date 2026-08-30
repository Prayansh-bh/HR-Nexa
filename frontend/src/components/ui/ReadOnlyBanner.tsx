import { Eye } from "lucide-react";

export function ReadOnlyBanner() {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      <Eye className="h-3.5 w-3.5 shrink-0" />
      Read-only view — you don't have permission to make changes in this module.
    </div>
  );
}
