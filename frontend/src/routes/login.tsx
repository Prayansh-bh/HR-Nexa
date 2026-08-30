import { createFileRoute, redirect } from "@tanstack/react-router";
import React from "react";
import { LoginPage } from "../features/auth";
import { useAuth } from "../auth";
import { AuthUser } from "../types";
import { OWNER_APP_URL } from "../config/api";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    const userString = typeof window !== "undefined" ? localStorage.getItem("hrms.user") : null;
    if (userString) {
      try {
        const user = JSON.parse(userString);
        if (user.role === "SuperAdmin") {
          localStorage.removeItem("hrms.user");
          localStorage.removeItem("hrms.token");
          localStorage.removeItem("hrms.refreshToken");
          return;
        }
        throw redirect({
          to: "/dashboard",
        });
      } catch (e) {
        if (e && (e as any).status) throw e;
      }
    }
  },
  component: LoginComponent,
});

function LoginComponent() {
  const { setUser } = useAuth();

  const handleLogin = (user: AuthUser) => {
    if (user.role === "SuperAdmin") {
      window.location.href = `${OWNER_APP_URL}/login`;
      return;
    }
    setUser(user);
    window.location.href = "/dashboard";
  };

  return <LoginPage onLogin={handleLogin} defaultViewMode="login" />;
}
