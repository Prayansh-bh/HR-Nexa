import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { z } from "zod";
import { ProtectedRoute, PERMISSIONS, useAuth } from "../auth";

const EmployeesPage = React.lazy(() =>
  import("../features/employees/pages/EmployeesPage").then((m) => ({ default: m.EmployeesPage })),
);

const employeeSearchSchema = z.object({
  page: z.number().catch(1),
  search: z.string().catch(""),
  department: z.string().catch(""),
  status: z.string().catch(""),
});

export const Route = createFileRoute("/_app/employees/")({
  validateSearch: (search) => employeeSearchSchema.parse(search),
  component: EmployeesListRouteComponent,
});

function EmployeesListRouteComponent() {
  const { user } = useAuth();
  const toast = useToast();
  const actions = useShellActions();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.EMPLOYEES_LIST_VIEW}>
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading Employees...
          </div>
        }
      >
        <EmployeesPage
          sub="employees.list"
          user={user}
          toast={toast.push}
          triggerConfirm={actions.triggerConfirm}
          onAddEmployee={() => navigate({ to: "/employees/new" })}
          onEditEmployee={(e) => navigate({ to: `/employees/${e.id}/edit` })}
          onMessageEmployee={actions.onMessageEmployee}
          onView={(e) => navigate({ to: `/employees/${e.id}` })}
          setActive={(path) => navigate({ to: `/${path.replace(/\./g, "/")}` })}
          searchParams={searchParams}
        />
      </Suspense>
    </ProtectedRoute>
  );
}
