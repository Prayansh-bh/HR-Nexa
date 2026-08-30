import React from "react";
import { useUIStore, useMessagingStore } from "../store";
import { AuthUser } from "../types";
import { NavItem, getPathFromId, getIdFromPath } from "../lib/nav-config";
import { FEATURE_REGISTRY, FeatureDefinition } from "../lib/feature-registry";
import { PERSONA_TEMPLATES, PersonaItem } from "../lib/persona-templates";
import { hasPermission } from "../auth/authorization";
import { useNavigate, useLocation } from "@tanstack/react-router";

/**
 * Dynamically resolves navigation items for a user context.
 *
 * Mode 1: Standard Persona Template (HRAdmin, Manager, Employee, SuperAdmin, Viewer, Accountant)
 * Mode 2: Custom Role Fallback Engine (generates nav dynamically from FEATURE_REGISTRY)
 */
export function resolveNavigationForUser(user: AuthUser): NavItem[] {
  const template = PERSONA_TEMPLATES[user.role];
  const renderedFeatureIds = new Set<string>();

  let baseNav: NavItem[] = [];

  // Stage A: Known Persona Template (Preserves custom labels, ordering, icons & grouping)
  if (template && template.length > 0) {
    baseNav = template
      .map((item) => {
        const feat = item.featureId
          ? FEATURE_REGISTRY[item.featureId]
          : FEATURE_REGISTRY[item.id] || null;
        const mainPerm = feat?.permission;

        if (item.children && item.children.length > 0) {
          const validChildren = item.children
            .map((c) => {
              const cFeat = FEATURE_REGISTRY[c.featureId];
              if (!cFeat) return null;
              if (cFeat.permission && !hasPermission(user, cFeat.permission)) {
                return null;
              }
              renderedFeatureIds.add(c.featureId);
              return {
                id: c.featureId,
                label: c.customLabel || cFeat.label,
                permission: cFeat.permission,
              };
            })
            .filter(Boolean) as { id: string; label: string; permission?: string }[];

          if (validChildren.length === 0) {
            return null;
          }

          if (item.featureId) renderedFeatureIds.add(item.featureId);

          return {
            id: item.id,
            label: item.customLabel || item.label || feat?.label || item.id,
            icon: item.icon || feat?.icon,
            children: validChildren,
          };
        }

        if (mainPerm && !hasPermission(user, mainPerm)) {
          return null;
        }

        if (item.featureId) renderedFeatureIds.add(item.featureId);

        return {
          id: item.id,
          label: item.customLabel || item.label || feat?.label || item.id,
          icon: item.icon || feat?.icon,
          permission: mainPerm,
        };
      })
      .filter(Boolean) as NavItem[];

    // Stage B: Permission Overlay for Known Personas
    // Discover features in FEATURE_REGISTRY marked discoverable that user is authorized for but not in baseNav
    const extraAuthorizedFeatures = Object.values(FEATURE_REGISTRY).filter((feat) => {
      if (renderedFeatureIds.has(feat.id)) return false;
      if (!feat.navigation?.discoverable) return false;
      if (!feat.permission) return false;
      return hasPermission(user, feat.permission);
    });

    if (extraAuthorizedFeatures.length > 0) {
      const categoryLabels: Record<string, string> = {
        general: "General",
        employees: "Employees",
        attendance: "Attendance",
        leave: "Leave",
        performance: "Performance",
        payroll: "Payroll",
        recruitment: "Recruitment",
        documents: "Documents",
        settings: "Settings",
      };

      extraAuthorizedFeatures.forEach((feat) => {
        renderedFeatureIds.add(feat.id);
        const targetCategory = feat.navigation?.category || feat.category;

        // Try to find matching parent group in baseNav (e.g. 'leave', 'payroll', 'employees')
        const parentGroup = baseNav.find(
          (item) => item.id === targetCategory || item.id.startsWith(targetCategory),
        );

        if (parentGroup && parentGroup.children) {
          parentGroup.children.push({
            id: feat.id,
            label: feat.label,
            permission: feat.permission,
          });
        } else {
          // If no parent group exists, append a new category group or standalone item
          baseNav.push({
            id: feat.id,
            label: feat.label,
            icon: feat.icon,
            permission: feat.permission,
          });
        }
      });
    }

    return baseNav;
  }

  // Mode 2: Custom Role Dynamic Navigation (No persona template exists)
  const categoryOrder: FeatureDefinition["category"][] = [
    "general",
    "employees",
    "recruitment",
    "attendance",
    "leave",
    "performance",
    "payroll",
    "documents",
    "settings",
  ];

  const categoryLabels: Record<string, string> = {
    general: "General",
    employees: "Employees",
    attendance: "Attendance",
    leave: "Leave",
    performance: "Performance",
    payroll: "Payroll",
    recruitment: "Recruitment",
    documents: "Documents",
    settings: "Settings",
  };

  const allowedFeatures = Object.values(FEATURE_REGISTRY).filter((feat) => {
    if (!feat.navigation?.discoverable) return false;
    if (!feat.permission) return true;
    return hasPermission(user, feat.permission);
  });

  const grouped: Record<string, FeatureDefinition[]> = {};
  allowedFeatures.forEach((feat) => {
    if (feat.id === "dashboard") return;
    const cat = feat.navigation?.category || feat.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(feat);
  });

  const navItems: NavItem[] = [];

  // Anchor Dashboard as the first/top navigation item if present in allowedFeatures
  const dashboardFeat = allowedFeatures.find((f) => f.id === "dashboard");
  if (dashboardFeat) {
    navItems.push({
      id: dashboardFeat.id,
      label: dashboardFeat.label,
      icon: dashboardFeat.icon,
    });
  }

  categoryOrder.forEach((cat) => {
    const items = grouped[cat];
    if (!items || items.length === 0) return;

    if (items.length === 1) {
      navItems.push({
        id: items[0].id,
        label: items[0].label,
        icon: items[0].icon,
        permission: items[0].permission,
      });
    } else {
      navItems.push({
        id: `cat.${cat}`,
        label: categoryLabels[cat] || cat,
        icon: items[0].icon,
        children: items.map((f) => ({
          id: f.id,
          label: f.label,
          permission: f.permission,
        })),
      });
    }
  });

  return navItems;
}

export function useNavigation(user: AuthUser) {
  const mobileOpen = useUIStore((s) => s.mobileOpen);
  const setMobileOpen = useUIStore((s) => s.setMobileOpen);
  const openGroup = useUIStore((s) => s.openGroup);
  const setOpenGroup = useUIStore((s) => s.setOpenGroup);
  const collapsed = useUIStore((s) => s.collapsed);
  const setCollapsed = useUIStore((s) => s.setCollapsed);

  const navigate = useNavigate();
  const location = useLocation();

  const broadcasts = useMessagingStore((s) => s.broadcasts);
  const lastSeenAnnouncements = useMessagingStore((s) => s.lastSeenAnnouncements);
  const setLastSeenAnnouncements = useMessagingStore((s) => s.setLastSeenAnnouncements);
  const unreadMessagesCount = useMessagingStore((s) => s.unreadMessagesCount);

  const currentLastSeen = lastSeenAnnouncements[user.name] ?? 0;
  const unreadAnnouncements = broadcasts.length > currentLastSeen;

  const active = React.useMemo(() => {
    return getIdFromPath(location.pathname);
  }, [location.pathname]);

  const pickNav = (id: string) => {
    const toPath = getPathFromId(id);
    navigate({ to: toPath });
    if (id === "self.announcements" || id === "announcements") {
      setLastSeenAnnouncements(user.name, broadcasts.length);
    }
    setMobileOpen(false);
  };

  const nav = React.useMemo(() => {
    return resolveNavigationForUser(user);
  }, [user]);

  return {
    active,
    mobileOpen,
    openGroup,
    collapsed,
    setMobileOpen,
    setOpenGroup,
    setCollapsed,
    pickNav,
    unreadAnnouncements,
    unreadMessagesCount,
    nav,
  };
}
