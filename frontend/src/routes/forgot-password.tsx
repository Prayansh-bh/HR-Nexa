import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { LoginPage } from "../features/auth";
import { useLocalStorage } from "../hooks";
import { AuthUser } from "../types";
import { OWNER_APP_URL } from "../config/api";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordComponent,
});

function ForgotPasswordComponent() {
  const [, setUser] = useLocalStorage<AuthUser | null>("hrms.user", null);

  const handleLogin = (user: AuthUser) => {
    if (user.role === "SuperAdmin") {
      window.location.href = `${OWNER_APP_URL}/login`;
      return;
    }
    setUser(user);
    window.location.href = "/dashboard";
  };

  return <LoginPage onLogin={handleLogin} defaultViewMode="forgot" />;
}
