import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";

const LeavePage = React.lazy(() =>
  import("../features/leave/pages/LeavePage").then((m) => ({ default: m.LeavePage })),
);

export const Route = createFileRoute("/_app/leave/")({
  component: LeaveIndexComponent,
});

function LeaveIndexComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
          Loading Leave Management...
        </div>
      }
    >
      <LeavePage
        sub="leave.apply"
        user={user}
        toast={toast.push}
        triggerConfirm={actions.triggerConfirm}
        onApplyLeave={actions.onApplyLeave}
        setActive={actions.setActive}
      />
    </Suspense>
  );
}
