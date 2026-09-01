import React from "react";
import { Lock } from "lucide-react";
import { Badge } from "../../../components/ui";

interface RolePermissionAccordionViewProps {
  selectedRole: string;
  selectedRoleObj: { id: string; name: string; description: string | null; isSystem: boolean } | undefined;
  matrix: Record<string, string[]>;
  filteredCategories: any[];
  effectiveFeatures: Record<string, boolean>;
  selectedCompanyId: string;
  permissionToFeature: Record<string, string>;
  hasPermission: (roleId: string, permId: string) => boolean;
  togglePermission: (roleId: string, permId: string) => void;
  toggleSubModuleAll: (roleId: string, actionIds: string[]) => void;
}

export function RolePermissionAccordionView({
  selectedRole,
  selectedRoleObj,
  matrix,
  filteredCategories,
  effectiveFeatures,
  selectedCompanyId,
  permissionToFeature,
  hasPermission,
  togglePermission,
  toggleSubModuleAll,
}: RolePermissionAccordionViewProps) {
  const isSuperAdmin = selectedRoleObj?.name === "SuperAdmin";

  return (
    <div className="space-y-6">
      {/* Role Header */}
      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">
            Configuring Permissions for Role:
          </span>
          <Badge tone="indigo">{selectedRoleObj?.name}</Badge>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {(matrix[selectedRole] || []).length} permissions active
        </div>
      </div>

      {/* Accordion Categories */}
      <div className="space-y-4">
        {filteredCategories.map((category) => (
          <div
            key={category.id}
            className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm"
          >
            {/* Category Header */}
            <div className="flex items-center justify-between bg-muted/40 p-4 border-b border-border">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>▶ {category.name}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  toggleSubModuleAll(
                    selectedRole,
                    category.subModules.flatMap((s: any) => s.actions).map((a: any) => a.id),
                  )
                }
                className="text-xs text-primary font-semibold hover:underline"
              >
                Select All in Category
              </button>
            </div>

            {/* SubModules List */}
            <div className="p-5 space-y-6 divide-y divide-border/40">
              {category.subModules.map((subModule: any) => {
                const subActionIds = subModule.actions.map((a: any) => a.id);

                return (
                  <div key={subModule.id} className="pt-4 first:pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <span className="text-primary">▼</span>
                        <span>{subModule.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSubModuleAll(selectedRole, subActionIds)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-medium"
                      >
                        <span>Select Section</span>
                      </button>
                    </div>

                    {/* Checkbox Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {subModule.actions.map((action: any) => {
                        const checked = hasPermission(selectedRole, action.id);
                        const featKey = permissionToFeature[action.id];
                        const isFeatureEntitled = featKey && selectedCompanyId ? (effectiveFeatures[featKey] ?? true) : true;

                        return (
                          <label
                            key={action.id}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border transition ${
                              !isFeatureEntitled
                                ? "opacity-50 cursor-not-allowed bg-slate-900/30 border-slate-800 text-muted-foreground"
                                : checked
                                ? "bg-primary/10 border-primary/40 text-foreground font-semibold cursor-pointer"
                                : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40 cursor-pointer"
                            }`}
                            title={!isFeatureEntitled ? "Feature is locked by company plan with no override. Grant override in Company Management." : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!isFeatureEntitled || isSuperAdmin}
                              onChange={() => togglePermission(selectedRole, action.id)}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                            />
                            <span className="text-xs truncate flex items-center gap-1">
                              {action.label}
                              {!isFeatureEntitled && <Lock className="w-3 h-3 text-amber-500 inline shrink-0" />}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
